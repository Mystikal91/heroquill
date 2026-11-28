import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const WARLOCK = "srd51:class/warlock";

/** A subclass of the warlock whose feature (gained at `gainedAt`) carries the effects. */
function patron(effects: Effect[], gainedAt = 1) {
  const feature: Entry = {
    id: "book:feature/list",
    kind: "feature",
    effects,
    data: { class: WARLOCK },
  };
  const sub: Entry = {
    id: "book:subclass/patron",
    kind: "subclass",
    parent: WARLOCK,
    effects: [],
    data: { levels: [{ level: gainedAt, features: [feature.id] }], spells: [] },
  };
  return [feature, sub];
}

function sheet(classes: [slug: string, level: number, subclass?: boolean][], entries: Entry[]) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
  c.classes = classes.map(([slug, level, subclass]) => ({
    classId: `srd51:class/${slug}`,
    level,
    ...(subclass && { subclassId: "book:subclass/patron" }),
  }));
  return deriveSheet(c, new Map([...bothIndex, ...entries.map((e) => [e.id, e] as const)]));
}

const SHIELD = "srd51:spell/shield";
const FIREBALL = "srd51:spell/fireball";

describe("the spellList effect", () => {
  const list = (extra: Partial<Extract<Effect, { type: "spellList" }>> = {}): Effect => ({
    type: "spellList",
    spells: [SHIELD, FIREBALL],
    classes: [WARLOCK],
    ...extra,
  });
  const pool = (level: number, entries: Entry[]) =>
    sheet([["warlock", level, true]], entries).spellcasters[0]?.lists.known?.pool ?? [];

  it("offers the spells to the class it names, up to the level it can cast", () => {
    const entries = patron([list()]);
    expect(pool(1, entries)).toContain(SHIELD);
    expect(pool(1, entries)).not.toContain(FIREBALL);
    expect(pool(5, entries)).toContain(FIREBALL);
    // The class alone, without the feature, does not have them.
    expect(sheet([["warlock", 1]], entries).spellcasters[0]?.lists.known?.pool).not.toContain(
      SHIELD,
    );
  });

  it("offers them, it does not give them", () => {
    const s = sheet([["warlock", 5, true]], patron([list()]));
    expect(s.spellcasters[0]?.lists.alwaysPrepared).toEqual([]);
    expect(s.grantedSpells).not.toContain(SHIELD);
  });

  it("waits for the level of the feature", () => {
    const entries = patron([list()], 3);
    expect(pool(2, entries)).not.toContain(SHIELD);
    expect(pool(3, entries)).toContain(SHIELD);
  });

  it("leaves another class alone, and takes every casting class when it names none", () => {
    expect(pool(1, patron([list({ classes: ["srd51:class/cleric"] })]))).not.toContain(SHIELD);
    // Cure wounds is on neither list: without `classes` both the warlock and the wizard are offered it.
    const cure = "srd51:spell/cure-wounds";
    const entries = patron([{ type: "spellList", spells: [cure] }]);
    const both = sheet(
      [
        ["warlock", 1, true],
        ["wizard", 1],
      ],
      entries,
    );
    expect(both.spellcasters).toHaveLength(2);
    for (const caster of both.spellcasters)
      expect([
        ...(caster.lists.known?.pool ?? []),
        ...(caster.lists.prepared?.pool ?? []),
      ]).toContain(cure);
    expect(sheet([["wizard", 1]], entries).spellcasters[0]?.lists.prepared?.pool).not.toContain(
      cure,
    );
  });

  it("gives a 2024 class the 2024 spell of a book's 2014 list, from a species trait", () => {
    const trait: Entry = {
      id: "book:trait/mark",
      kind: "trait",
      effects: [{ type: "spellList", spells: [SHIELD] }],
      data: {},
    };
    const index = new Map([...bothIndex, [trait.id, trait] as const]);
    const human = index.get("srd52:species/human");
    if (!human) throw new Error("human");
    index.set(human.id, { ...human, effects: [...human.effects, { type: "trait", id: trait.id }] });
    const twin = createCharacter("srd52");
    twin.choices.species = human.id;
    twin.classes = [{ classId: "srd52:class/cleric", level: 1 }];
    const pool = deriveSheet(twin, index).spellcasters[0]?.lists.prepared?.pool ?? [];
    expect(pool).toContain("srd52:spell/shield");
    expect(pool).not.toContain(SHIELD);
  });

  it("adds the whole list of the classes in fromClasses, cantrips too", () => {
    const entries = patron([
      { type: "spellList", spells: [], classes: [WARLOCK], fromClasses: ["srd51:class/cleric"] },
    ]);
    const lists = sheet([["warlock", 1, true]], entries).spellcasters[0]?.lists;
    expect(lists?.known?.pool).toContain("srd51:spell/cure-wounds");
    expect(lists?.cantrips?.pool).toContain("srd51:spell/guidance");
    expect(lists?.known?.pool).not.toContain("srd51:spell/fireball");
  });
});
