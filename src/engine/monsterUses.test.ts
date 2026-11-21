import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import {
  type Combatant,
  activeCombatant,
  addCombatants,
  createEncounter,
  delayTurn,
  initiativeOrder,
  lairCombatant,
  laterCombatants,
  manualCombatant,
  monsterCombatant,
  nextTurn,
  readEncounter,
  resetFight,
  rollAllInitiative,
  setInitiative,
  setSurprised,
  startCombat,
} from "./encounter";
import {
  hasLegendary,
  legendaryOf,
  rechargeDue,
  rollRecharge,
  setLegendary,
  setUsesSpent,
  useDefs,
  usesSpent,
} from "./monsterUses";

const dragon = {
  id: "srd51:monster/adult-red-dragon",
  kind: "monster",
  effects: [],
  data: {
    hitPoints: 256,
    armorClass: [{ value: 19 }],
    abilities: { dex: 10 },
    special: [{}, { usage: { type: "per day", times: 3 } }],
    actions: [{}, {}, {}, { usage: { type: "recharge on roll", dice: "1d6", minValue: 5 } }],
    reactions: [{ usage: { type: "recharge after rest", restTypes: ["short", "long"] } }],
    legendary: [{}, {}, {}],
  },
} as unknown as Entry;

const make = (name: string, init?: number, bonus = 0): Combatant => ({
  ...manualCombatant({ name, maxHp: 10, ac: 12, initiativeBonus: bonus }),
  ...(init !== undefined && { initiative: init }),
});
const fight = (...list: Combatant[]) => addCombatants(createEncounter("t"), list);

describe("the abilities of a monster that have a limit", () => {
  it("reads per day, recharge and rest from the entry, numbered as the texts are", () => {
    expect(useDefs(dragon.data)).toEqual([
      { key: "special.2", list: "special", number: 2, kind: "perDay", times: 3 },
      { key: "actions.4", list: "actions", number: 4, kind: "recharge", dice: "1d6", minValue: 5 },
      { key: "reactions.1", list: "reactions", number: 1, kind: "rest" },
    ]);
    expect(useDefs(undefined)).toEqual([]);
    expect(useDefs({ actions: [{ usage: { type: "unknown" } }] })).toEqual([]);
  });

  it("counts uses spent, within what the ability has", () => {
    const [day] = useDefs(dragon.data);
    const c = monsterCombatant(dragon, "Dragon");
    if (!day) throw new Error("no def");
    const once = setUsesSpent(c, day, 1);
    expect(usesSpent(once, day.key)).toBe(1);
    expect(usesSpent(setUsesSpent(once, day, 99), day.key)).toBe(3);
    expect(setUsesSpent(once, day, 0).uses).toBeUndefined();
  });

  it("brings a recharge back on the roll that is asked for, and not below", () => {
    const def = useDefs(dragon.data)[1];
    if (!def) throw new Error("no def");
    const spent = setUsesSpent(monsterCombatant(dragon, "Dragon"), def, 1);
    expect(rechargeDue(spent, useDefs(dragon.data))).toEqual([def]);
    const low = rollRecharge(spent, def, () => 3); // a 4
    expect(low).toMatchObject({ total: 4, recharged: false });
    expect(usesSpent(low.creature, def.key)).toBe(1);
    const high = rollRecharge(spent, def, () => 4); // a 5
    expect(high).toMatchObject({ total: 5, recharged: true });
    expect(rechargeDue(high.creature, useDefs(dragon.data))).toEqual([]);
  });
});

describe("legendary actions", () => {
  it("are given to a monster that has them, three by default", () => {
    expect(hasLegendary(dragon.data)).toBe(true);
    expect(monsterCombatant(dragon, "Dragon").legendary).toEqual({ max: 3, used: 0 });
    expect(legendaryOf(make("x"), dragon.data)).toEqual({ max: 3, used: 0 });
    expect(legendaryOf(make("x"), {})).toBeUndefined();
  });

  it("come back when the creature's own turn begins", () => {
    const spent = setLegendary(monsterCombatant(dragon, "Dragon"), 3, 2);
    const e = startCombat(
      fight({ ...make("hero", 20) }, { ...spent, initiative: 10 }, make("orc", 5)),
    );
    const spentAfterHero = nextTurn(e).encounter; // the dragon's turn begins
    expect(activeCombatant(spentAfterHero)?.name).toBe("Dragon");
    expect(activeCombatant(spentAfterHero)?.legendary).toEqual({ max: 3, used: 0 });
  });

  it("can be given another number, within limits", () => {
    expect(setLegendary(make("x"), 99, 99).legendary).toEqual({ max: 9, used: 9 });
    expect(setLegendary(make("x"), 0, -3).legendary).toEqual({ max: 1, used: 0 });
  });
});

describe("a surprised creature", () => {
  it("takes no turn in the first round and acts in the second", () => {
    const order = [make("a", 20), setSurprised(make("b", 15), true), make("c", 10)];
    let e = startCombat(fight(...order));
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      seen.push(`${activeCombatant(e)?.name}${e.round}`);
      e = nextTurn(e).encounter;
    }
    expect(seen).toEqual(["a1", "c1", "a2", "b2", "c2"]);
  });

  it("is skipped as the first of the fight too", () => {
    const e = startCombat(fight(setSurprised(make("a", 20), true), make("b", 10)));
    expect(activeCombatant(e)?.name).toBe("b");
  });

  it("is turned off by setting it false", () => {
    expect(setSurprised(setSurprised(make("a"), true), false).surprised).toBeUndefined();
  });
});

describe("delaying a turn", () => {
  const three = () => startCombat(fight(make("a", 20), make("b", 15), make("c", 10)));

  it("lists the creatures that come after the active one", () => {
    expect(laterCombatants(three()).map((c) => c.name)).toEqual(["b", "c"]);
  });

  it("puts the creature right after the chosen one and passes the turn on", () => {
    const e = three();
    const c = e.combatants.find((x) => x.name === "c")?.id ?? "";
    const delayed = delayTurn(e, c);
    expect(activeCombatant(delayed)?.name).toBe("b");
    expect(initiativeOrder(delayed.combatants).map((x) => x.name)).toEqual(["b", "c", "a"]);
    expect(delayed.round).toBe(1);
    // It acts after c, then the round turns.
    const afterB = nextTurn(delayed).encounter;
    expect(activeCombatant(afterB)?.name).toBe("c");
    const afterC = nextTurn(afterB).encounter;
    expect(activeCombatant(afterC)?.name).toBe("a");
    expect(afterC.round).toBe(1);
    expect(nextTurn(afterC).encounter.round).toBe(2);
  });

  it("does not count down what runs out at the end of its turn, since it has not had it", () => {
    const e = three();
    const withEffect = {
      ...e,
      combatants: e.combatants.map((c) =>
        c.name === "a" ? { ...c, effects: [{ id: "x", name: "Bless", rounds: 1 }] } : c,
      ),
    };
    const delayed = delayTurn(
      withEffect,
      withEffect.combatants.find((c) => c.name === "b")?.id ?? "",
    );
    expect(delayed.combatants.find((c) => c.name === "a")?.effects).toHaveLength(1);
  });

  it("is not possible for the last of the order, or to a creature that is not after", () => {
    const e = three();
    const a = e.combatants.find((c) => c.name === "a")?.id ?? "";
    expect(delayTurn(e, a)).toBe(e);
    expect(laterCombatants(nextTurn(nextTurn(e).encounter).encounter)).toEqual([]);
  });

  it("forgets the delay when the initiative is set again", () => {
    const e = three();
    const b = e.combatants.find((c) => c.name === "b")?.id ?? "";
    const delayed = delayTurn(e, e.combatants.find((c) => c.name === "c")?.id ?? "");
    const aId = delayed.combatants.find((c) => c.name === "a")?.id ?? "";
    expect(delayed.combatants.find((c) => c.id === aId)?.rank).toBe(1);
    expect(
      setInitiative(delayed, aId, 12).combatants.find((c) => c.id === aId)?.rank,
    ).toBeUndefined();
    expect(b).toBeTruthy();
  });
});

describe("the lair", () => {
  it("is a combatant at initiative 20 with nothing else to track", () => {
    const lair = lairCombatant("Lair actions");
    expect(lair).toMatchObject({ lair: true, initiative: 20, kind: "manual" });
  });
});

describe("keeping what was spent", () => {
  it("is read back from storage, repaired, and reset with the fight", () => {
    const spent = setLegendary(
      setUsesSpent(monsterCombatant(dragon, "D"), useDefs(dragon.data)[1] as never, 1),
      3,
      2,
    );
    const stored = JSON.parse(
      JSON.stringify(fight({ ...setSurprised(spent, true), initiative: 7 })),
    );
    const read = readEncounter(stored)?.combatants[0];
    expect(read).toMatchObject({
      uses: { "actions.4": 1 },
      legendary: { max: 3, used: 2 },
      surprised: true,
    });
    const damaged = readEncounter({
      id: "e",
      combatants: [
        { id: "a", name: "A", uses: { x: 500, "": 1, y: "no" }, legendary: { max: 99, used: 99 } },
      ],
    })?.combatants[0];
    expect(damaged?.uses).toEqual({ x: 99 });
    expect(damaged?.legendary).toEqual({ max: 9, used: 9 });
    const reset = resetFight(readEncounter(stored) as never).combatants[0];
    expect(reset?.uses).toBeUndefined();
    expect(reset?.legendary).toEqual({ max: 3, used: 0 });
    expect(reset?.surprised).toBe(true);
  });

  it("keeps the lair at initiative 20 when the fight is reset and when initiative is rolled", () => {
    const e = fight(lairCombatant("Lair"), make("orc", undefined, 2));
    expect(resetFight(e).combatants[0]?.initiative).toBe(20);
    expect(
      rollAllInitiative(e, { again: true, characters: true }, () => 0).combatants[0]?.initiative,
    ).toBe(20);
  });
});
