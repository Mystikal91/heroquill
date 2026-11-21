import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { type DefenseLine, areaDamage, damageDealt, defensesOf, innateDefenses } from "./defenses";
import {
  type Combatant,
  addCombatants,
  addEffect,
  characterCombatant,
  createEncounter,
  manualCombatant,
  monsterCombatant,
  readEncounter,
  rollAllInitiative,
  rollGroupInitiative,
} from "./encounter";

const line = (kind: DefenseLine["kind"], damage: string): DefenseLine => ({ kind, damage });

describe("damage against defenses", () => {
  it("leaves a hit with no kind, or a kind nobody defends against, as it is", () => {
    expect(damageDealt(9, undefined, [line("resistance", "fire")])).toEqual({
      dealt: 9,
      applied: [],
    });
    expect(damageDealt(9, "cold", [line("resistance", "fire")])).toEqual({ dealt: 9, applied: [] });
  });

  it("halves for a resistance (rounded down), doubles for a vulnerability, and stops at an immunity", () => {
    expect(damageDealt(9, "fire", [line("resistance", "fire")])).toEqual({
      dealt: 4,
      applied: ["resistance"],
    });
    expect(damageDealt(9, "fire", [line("vulnerability", "fire")]).dealt).toBe(18);
    expect(
      damageDealt(9, "fire", [line("immunity", "fire"), line("vulnerability", "fire")]),
    ).toEqual({
      dealt: 0,
      applied: ["immunity"],
    });
  });

  it("applies resistance before vulnerability, and counts several of a kind once", () => {
    const both = [line("resistance", "fire"), line("vulnerability", "fire")];
    expect(damageDealt(9, "fire", both).dealt).toBe(8);
    expect(
      damageDealt(9, "fire", [line("resistance", "fire"), line("resistance", "fire")]).dealt,
    ).toBe(4);
  });
});

describe("what a creature defends against", () => {
  const ghost = {
    id: "srd51:monster/ghost",
    kind: "monster",
    effects: [],
    data: {
      armorClass: [{ value: 11 }],
      hitPoints: 45,
      abilities: { dex: 13 },
      damageResistances: ["acid", "fire"],
      damageImmunities: ["poison"],
    },
  } as unknown as Entry;

  it("reads the lists of a monster's entry", () => {
    expect(innateDefenses(ghost.data)).toEqual([
      line("resistance", "acid"),
      line("resistance", "fire"),
      line("immunity", "poison"),
    ]);
    expect(innateDefenses(undefined)).toEqual([]);
  });

  it("adds the defenses of a sheet and of the effects in force", () => {
    const pc = characterCombatant({
      characterId: "c",
      name: "Hero",
      hp: 10,
      maxHp: 10,
      tempHp: 0,
      ac: 15,
      initiativeBonus: 0,
      defenses: { resistance: ["cold"], vulnerability: [] },
    });
    const withEffect = addEffect(pc, {
      name: "Protection",
      effects: [{ type: "defense", kind: "immunity", damage: "fire" }],
    });
    const all = defensesOf(withEffect, innateDefenses(ghost.data));
    expect(all).toContainEqual(line("resistance", "cold"));
    expect(all).toContainEqual(line("immunity", "fire"));
    expect(all).toContainEqual(line("immunity", "poison"));
  });

  it("keeps a character's defenses through storage, and nothing when it has none", () => {
    const pc = characterCombatant({
      characterId: "c",
      name: "Hero",
      hp: 10,
      maxHp: 10,
      tempHp: 0,
      ac: 15,
      initiativeBonus: 0,
      defenses: { resistance: ["cold", 5 as unknown as string] },
    });
    const read = readEncounter(
      JSON.parse(JSON.stringify(addCombatants(createEncounter("x"), [pc]))),
    );
    expect(read?.combatants[0]?.defenses).toEqual({ resistance: ["cold"] });
    const plain = manualCombatant({ name: "n", maxHp: 5, ac: 10 });
    expect(plain.defenses).toBeUndefined();
  });
});

describe("area damage", () => {
  const make = (name: string, hp: number): Combatant =>
    manualCombatant({ name, maxHp: hp, ac: 12 });

  it("hits those who failed fully, those who saved by half, and nobody else", () => {
    const [a, b, c] = [make("a", 40), make("b", 40), make("c", 40)] as [
      Combatant,
      Combatant,
      Combatant,
    ];
    const e = addCombatants(createEncounter("fight"), [a, b, c]);
    const out = areaDamage(e, { [a.id]: "fail", [b.id]: "save" }, 28, undefined, () => []);
    expect(out.encounter.combatants.map((x) => x.hp)).toEqual([12, 26, 40]);
    expect(out.taken).toEqual([
      { id: a.id, dealt: 28 },
      { id: b.id, dealt: 14 },
    ]);
  });

  it("goes through each creature's defenses", () => {
    const [a, b] = [make("a", 40), make("b", 40)] as [Combatant, Combatant];
    const e = addCombatants(createEncounter("fight"), [a, b]);
    const out = areaDamage(e, { [a.id]: "fail", [b.id]: "fail" }, 20, "fire", (c) =>
      c.id === a.id ? [line("resistance", "fire")] : [line("immunity", "fire")],
    );
    expect(out.encounter.combatants.map((x) => x.hp)).toEqual([30, 40]);
  });
});

describe("one roll of initiative for a group", () => {
  const goblin = (): Combatant =>
    monsterCombatant(
      {
        id: "srd51:monster/goblin",
        kind: "monster",
        effects: [],
        data: { hitPoints: 7, armorClass: [{ value: 15 }], abilities: { dex: 14 } },
      } as unknown as Entry,
      "Goblin",
    );
  const orc = (): Combatant =>
    monsterCombatant(
      {
        id: "srd51:monster/orc",
        kind: "monster",
        effects: [],
        data: { hitPoints: 15, armorClass: [{ value: 13 }], abilities: { dex: 12 } },
      } as unknown as Entry,
      "Orc",
    );

  it("gives every creature of a kind the same total, and another kind its own", () => {
    const e = addCombatants(createEncounter("f"), [goblin(), goblin(), orc()]);
    let next = 0;
    const dice = [4, 15];
    const rolled = rollAllInitiative(e, { grouped: true }, () => dice[next++] ?? 0);
    const totals = rolled.combatants.map((c) => c.initiative);
    expect(totals[0]).toBe(totals[1]);
    expect(totals[2]).not.toBe(totals[0]);
    expect(next).toBe(2);
  });

  it("rolls each one apart when groups are off", () => {
    const e = addCombatants(createEncounter("f"), [goblin(), goblin()]);
    let next = 0;
    rollAllInitiative(e, {}, () => (next++ === 0 ? 4 : 17));
    expect(next).toBe(2);
  });

  it("rolls once for the group of one creature and sets them all", () => {
    const e = addCombatants(createEncounter("f"), [goblin(), goblin(), orc()]);
    const id = e.combatants[1]?.id ?? "";
    const out = rollGroupInitiative(e, id, () => 9);
    expect(out.combatants.map((c) => c.initiative)).toEqual([12, 12, undefined]);
  });
});
