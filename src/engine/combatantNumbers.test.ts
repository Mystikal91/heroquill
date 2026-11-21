import { describe, expect, it } from "vitest";
import type { Effect } from "../data/schema";
import { combatantNumbers, explainNumber } from "./combatantNumbers";
import {
  type Combatant,
  addCombatants,
  addEffect,
  createEncounter,
  heal,
  initiativeOrder,
  manualCombatant,
  nextTurn,
  readEncounter,
  removeEffect,
  rollInitiative,
  setHp,
  startCombat,
} from "./encounter";

const creature = (init?: number): Combatant => ({
  ...manualCombatant({ name: "Orc", maxHp: 15, ac: 13, speed: 30, initiativeBonus: 1 }),
  ...(init !== undefined && { initiative: init }),
});

const bonus = (target: "ac" | "speed" | "initiative" | "hp", value: number): Effect => ({
  type: "modifier",
  target,
  value,
});

describe("the numbers of a creature with effects", () => {
  it("is the plain numbers with nothing on it", () => {
    const n = combatantNumbers(creature());
    expect([n.ac, n.speed, n.initiativeBonus, n.maxHp]).toEqual([13, 30, 1, 15]);
  });

  it("adds plain bonuses to armor class, speed, initiative and hit points", () => {
    const c = addEffect(creature(), {
      name: "Blessing",
      effects: [bonus("ac", 2), bonus("speed", 10), bonus("initiative", 3), bonus("hp", 5)],
    });
    const n = combatantNumbers(c);
    expect([n.ac, n.speed, n.initiativeBonus, n.maxHp]).toEqual([15, 40, 4, 20]);
    expect(n.parts.ac).toEqual([{ source: "Blessing", value: 2 }]);
  });

  it("raises the armor class to a floor before the bonuses (Barkskin, then Shield of Faith)", () => {
    const c = addEffect(
      addEffect(creature(), {
        name: "Barkskin",
        effects: [{ type: "armorClassFloor", value: 16 }],
      }),
      { name: "Shield of Faith", effects: [bonus("ac", 2)] },
    );
    expect(combatantNumbers(c).ac).toBe(18);
    // A floor under the armor class changes nothing.
    const low = addEffect(creature(), {
      name: "Bark",
      effects: [{ type: "armorClassFloor", value: 11 }],
    });
    expect(combatantNumbers(low).ac).toBe(13);
  });

  it("multiplies the speed after the bonuses (Haste)", () => {
    const c = addEffect(creature(), {
      name: "Haste",
      effects: [{ type: "speedMultiplier", value: 2 }, bonus("speed", 10)],
    });
    expect(combatantNumbers(c).speed).toBe(80);
  });

  it("leaves a speed that is not known unknown", () => {
    const c = addEffect({ ...creature(), speed: undefined } as Combatant, {
      name: "Haste",
      effects: [{ type: "speedMultiplier", value: 2 }],
    });
    expect(combatantNumbers(c).speed).toBeUndefined();
  });

  it("does not count a bonus that depends on a sheet (an ability, a level, a condition)", () => {
    const c = addEffect(creature(), {
      name: "Aura",
      effects: [
        { type: "modifier", target: "ac", value: 1, plus: "cha" },
        { type: "modifier", target: "ac", value: 1, when: "unarmored" },
        { type: "modifier", target: "attack", value: 2 },
      ],
    });
    expect(combatantNumbers(c).ac).toBe(13);
  });

  it("lists the defenses an effect gives", () => {
    const c = addEffect(creature(), {
      name: "Protection",
      effects: [{ type: "defense", kind: "resistance", damage: "fire" }],
    });
    expect(combatantNumbers(c).defenses).toEqual([
      { source: "Protection", kind: "resistance", damage: "fire" },
    ]);
  });

  it("explains a number in a sentence, and says nothing when nothing changes it", () => {
    const c = addEffect(creature(), { name: "Shield of Faith", effects: [bonus("ac", 2)] });
    const n = combatantNumbers(c);
    expect(explainNumber(c.ac, n.parts.ac)).toBe("13 · +2 Shield of Faith");
    expect(explainNumber(13, [])).toBe("");
  });
});

describe("what the effects do to the fight", () => {
  it("lets healing reach the raised maximum and takes hit points back when the effect ends", () => {
    const c = addEffect(creature(), { name: "Aid", effects: [bonus("hp", 5)] });
    const healed = heal({ ...c, hp: 10 }, 100);
    expect(healed.hp).toBe(20);
    expect(removeEffect(healed, c.effects[0]?.id ?? "").hp).toBe(15);
    expect(setHp(c, 50).hp).toBe(20);
  });

  it("rolls and orders initiative with the bonus of the effects", () => {
    const quick = addEffect(creature(10), { name: "Alert", effects: [bonus("initiative", 5)] });
    const plain = creature(10);
    expect(initiativeOrder([plain, quick])[0]?.id).toBe(quick.id);
    expect(rollInitiative(quick, () => 4).total).toBe(5 + 1 + 5);
  });

  it("takes the hit points down when a timed effect that raised the maximum runs out", () => {
    const owner = addEffect(creature(20), { name: "Aid", rounds: 1, effects: [bonus("hp", 5)] });
    const full = { ...owner, hp: 20 };
    const e = startCombat(addCombatants(createEncounter("t"), [full]));
    const next = nextTurn(e).encounter;
    expect(next.combatants[0]?.hp).toBe(15);
  });
});

describe("reading effects with rules from storage", () => {
  it("keeps the rules that are valid and drops the others", () => {
    const read = readEncounter({
      id: "e",
      combatants: [
        {
          id: "a",
          name: "A",
          effects: [
            {
              name: "Bless",
              effects: [{ type: "modifier", target: "ac", value: 2 }, { type: "nonsense" }, 5],
            },
          ],
        },
      ],
    });
    expect(read?.combatants[0]?.effects[0]?.effects).toEqual([
      { type: "modifier", target: "ac", value: 2 },
    ]);
  });
});
