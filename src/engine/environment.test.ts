import { describe, expect, it } from "vitest";
import { readTracker } from "../relay/protocol";
import { trackerViewOf } from "../relay/trackerView";
import {
  type Combatant,
  type EnvironmentRule,
  addCombatants,
  addEffect,
  createEncounter,
  freshCombatant,
  lairCombatant,
  manualCombatant,
  nextTurn,
  readEncounter,
  resetFight,
  setEffectRounds,
  setEffectShown,
  startCombat,
} from "./encounter";
import {
  applyEnvironment,
  giveCondition,
  rollSaves,
  saveBonus,
  saveHindrance,
} from "./environment";
import { MAX_SAVED, keepEffect, mergeSaved, readSavedEffects, savedEffect } from "./savedEffects";

const POISONED = "srd51:condition/poisoned";
const swamp: EnvironmentRule = {
  damage: { dice: "2d6", type: "poison" },
  save: { ability: "con", dc: 13, half: true },
  condition: { id: POISONED, rounds: 2 },
};
const creature = (name: string) => ({ ...manualCombatant({ name, maxHp: 30, ac: 12 }), id: name });
const fightOf = (...list: Combatant[]) => addCombatants(createEncounter("Fight"), list);
const none = () => [];
const lairWith = (rounds?: number, environment: EnvironmentRule = swamp) =>
  addEffect(lairCombatant("Lair"), {
    name: "Swamp",
    ...(rounds && { rounds }),
    environment,
  });

describe("applying an effect of the lair", () => {
  const e = fightOf(creature("a"), creature("b"), creature("c"));
  const hp = (x: typeof e) => x.combatants.map((c) => c.hp);

  it("full damage and the condition to who fails, half to who saves, nothing to who is outside", () => {
    const out = applyEnvironment(e, swamp, { a: "fail", b: "save" }, 9, none);
    expect(hp(out.encounter)).toEqual([21, 26, 30]);
    expect(out.encounter.combatants.map((c) => c.conditions)).toEqual([[POISONED], [], []]);
    expect(out.encounter.combatants[0]?.rounds).toEqual({ [POISONED]: 2 });
  });

  it("nothing to who saves when there is no half", () => {
    const rule: EnvironmentRule = { ...swamp, save: { ability: "con", dc: 13, half: false } };
    const out = applyEnvironment(e, rule, { a: "fail", b: "save" }, 9, none);
    expect(hp(out.encounter)).toEqual([21, 30, 30]);
    expect(out.taken).toEqual([{ id: "a", dealt: 9 }]);
    expect(out.conditioned).toEqual(["a"]);
  });

  it("everybody inside in full when there is no save", () => {
    const { save: _save, ...rule } = swamp;
    const out = applyEnvironment(e, rule, { a: "save", b: "fail" }, 9, none);
    expect(hp(out.encounter)).toEqual([21, 21, 30]);
    expect(out.conditioned).toEqual(["a", "b"]);
  });

  it("goes through resistance and immunity, to the damage and to the condition apart", () => {
    const out = applyEnvironment(
      e,
      swamp,
      { a: "fail", b: "fail" },
      9,
      (c) => [{ kind: c.id === "a" ? "resistance" : "immunity", damage: "poison" }],
      (c) => (c.id === "a" ? ["poisoned"] : []),
    );
    expect(hp(out.encounter)).toEqual([26, 30, 30]);
    expect(out.conditioned).toEqual(["b"]);
  });

  it("does not shorten a condition that lasts longer or has no limit", () => {
    const longer = giveCondition(creature("a"), POISONED, 5);
    expect(giveCondition(longer, POISONED, 2).rounds).toEqual({ [POISONED]: 5 });
    const endless = giveCondition(creature("a"), POISONED, undefined);
    expect(giveCondition(endless, POISONED, 2).rounds).toEqual({});
  });
});

describe("saves", () => {
  it("takes the bonus of the stat block, else the modifier, else none", () => {
    expect(saveBonus({ abilities: { con: 14 }, saves: { con: 5 } }, "con")).toBe(5);
    expect(saveBonus({ abilities: { con: 14 } }, "con")).toBe(2);
    expect(saveBonus(undefined, "con")).toBeUndefined();
  });

  it("meets the DC to succeed, and leaves out who has no bonus", () => {
    const list = [
      { id: "a", bonus: 3 },
      { id: "b", bonus: 2 },
      { id: "c", bonus: undefined },
    ];
    const rolled = rollSaves(list, 13, () => 10);
    const [a, b] = rolled;
    expect(rolled).toHaveLength(2);
    expect((a?.total ?? 0) - (b?.total ?? 0)).toBe(1);
    for (const r of rolled) expect(r.passed).toBe((r.total ?? 0) >= 13);
    expect(rolled.map((r) => r.passed)).toContain(true);
  });
});

describe("conditions and saves", () => {
  const held = (slug: string) => ({ conditions: [`srd51:condition/${slug}`] });

  it("fail Strength and Dexterity outright when the creature cannot move", () => {
    for (const slug of ["paralyzed", "petrified", "stunned", "unconscious"]) {
      expect(saveHindrance(held(slug), "dex")).toEqual({ fails: true });
      expect(saveHindrance(held(slug), "str")).toEqual({ fails: true });
      expect(saveHindrance(held(slug), "con")).toEqual({});
    }
    expect(rollSaves([{ id: "a", bonus: 20, fails: true }], 5)).toEqual([
      { id: "a", passed: false },
    ]);
  });

  it("make Dexterity harder when restrained", () => {
    expect(saveHindrance(held("restrained"), "dex")).toEqual({ disadvantage: true });
    expect(saveHindrance(held("restrained"), "str")).toEqual({});
  });
});

describe("the rounds of the lair", () => {
  it("count down at the end of its turn and say when it ends", () => {
    let e = startCombat(fightOf(lairWith(2), { ...creature("a"), initiative: 5 }));
    e = nextTurn(e).encounter;
    expect(e.combatants[0]?.effects[0]?.rounds).toBe(1);
    e = nextTurn(e).encounter;
    expect(e.combatants[0]?.effects[0]?.rounds).toBe(1);
    const report = nextTurn(e);
    expect(report.ended.effects).toEqual(["Swamp"]);
  });

  it("are whole again when the fight is reset or copied, and the lair keeps its place", () => {
    const e = nextTurn(startCombat(fightOf(lairWith(3), creature("a")))).encounter;
    const again = resetFight(e).combatants[0];
    expect(again?.effects[0]?.rounds).toBe(3);
    const lair = e.combatants[0];
    expect(lair && freshCombatant(lair).initiative).toBe(20);
  });

  it("drop what is not of the lair on a reset", () => {
    const c = addEffect(creature("a"), { name: "Bless" });
    expect(freshCombatant(c).effects).toEqual([]);
  });

  it("keep the whole length when fewer are left, and follow when more are given", () => {
    const lair = lairWith(5);
    const id = lair.effects[0]?.id ?? "";
    expect(setEffectRounds(lair, id, 2).effects[0]).toMatchObject({
      rounds: 2,
      environment: { total: 5 },
    });
    expect(setEffectRounds(lair, id, 8).effects[0]?.environment?.total).toBe(8);
    expect(setEffectRounds(lair, id, undefined).effects[0]?.environment?.total).toBeUndefined();
  });
});

describe("reading", () => {
  it("gives back what was saved", () => {
    const e = fightOf(lairWith(3));
    expect(readEncounter(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });

  it("drops what is broken and keeps the rest", () => {
    const e = fightOf(lairWith());
    const raw = JSON.parse(JSON.stringify(e));
    raw.combatants[0].effects[0].environment = {
      damage: { dice: "lots" },
      save: { ability: "luck", dc: 10 },
      condition: 4,
      shown: "yes",
      total: -3,
    };
    expect(readEncounter(raw)?.combatants[0]?.effects[0]?.environment).toEqual({});
  });
});

describe("saved effects", () => {
  const saved = (name: string, id = name, at = 1) => {
    const s = savedEffect({ name, rounds: 3 }, id, at);
    if (!s) throw new Error("not saved");
    return s;
  };

  it("are kept at their full length and hidden from the players", () => {
    const lair = setEffectRounds(lairWith(5), "", 1);
    const effect = lair.effects[0];
    const kept = savedEffect({
      ...effect,
      rounds: 2,
      environment: { ...effect?.environment, shown: true },
    });
    expect(kept?.kind).toBe("environment");
    expect(kept?.effect).toEqual({ name: "Swamp", rounds: 5, environment: swamp });
  });

  it("replace one of the same name and kind, and stop at the limit", () => {
    expect(keepEffect([saved("Mark", "1")], saved(" mark", "2")).map((s) => s.id)).toEqual(["2"]);
    const full = Array.from({ length: MAX_SAVED }, (_, i) => saved(`E${i}`));
    expect(keepEffect(full, saved("New"))).toEqual(full);
    expect(keepEffect(full, saved("Renamed", "E4"))).toHaveLength(MAX_SAVED);
  });

  it("are read without what is broken", () => {
    const good = saved("Mark");
    expect(readSavedEffects([good, good, null, { id: "x" }, 3])).toEqual([good]);
    expect(readSavedEffects("no")).toEqual([]);
  });

  it("merge with a file by date, unless the ones here are kept", () => {
    const here = [saved("Old", "1", 1)];
    const file = [saved("New", "1", 2), saved("Other", "2", 1)];
    expect(mergeSaved(here, file, false).map((s) => s.effect.name)).toEqual(["New", "Other"]);
    expect(mergeSaved(here, [saved("old ", "9", 2)], false).map((s) => s.id)).toEqual(["9"]);
    expect(mergeSaved(here, file, true).map((s) => s.effect.name)).toEqual(["Old", "Other"]);
  });
});

describe("what the players see of the lair", () => {
  const lair = lairWith(3);
  const shown = setEffectShown(lair, lair.effects[0]?.id ?? "", true);

  it("nothing while it is hidden, or before the fight", () => {
    expect(trackerViewOf(startCombat(fightOf(lair)), []).environment).toBeUndefined();
    expect(trackerViewOf(fightOf(shown), []).environment).toBeUndefined();
  });

  it("the name and the rounds alone once shown", () => {
    const view = trackerViewOf(startCombat(fightOf(shown)), []);
    expect(view.environment).toEqual([{ name: "Swamp", rounds: 3 }]);
    expect(readTracker(JSON.parse(JSON.stringify(view)))).toEqual(view);
  });

  it("is read by the relay without anything else", () => {
    const raw = { round: 1, order: [], environment: [{ name: "X", dc: 13, note: "no" }, 4, {}] };
    expect(readTracker(raw)?.environment).toEqual([{ name: "X" }]);
  });
});
