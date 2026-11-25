import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { bothIndex } from "../test/srd52";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";

function make(classId: string, level: number, subclass?: string, extra: Partial<Character> = {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [
    { classId: `srd51:class/${classId}`, level, ...(subclass && { subclassId: subclass }) },
  ];
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 16, wis: 16, cha: 14 };
  return Object.assign(c, extra);
}

describe("spells that subclasses always prepare", () => {
  it("gives a life cleric the domain spells from level 1, and the rest as the levels come", () => {
    const sheet = (level: number) =>
      deriveSheet(make("cleric", level, "srd51:subclass/life"), srd51Index).spellcasters[0]?.lists
        .alwaysPrepared;
    expect(sheet(1)).toEqual(["srd51:spell/bless", "srd51:spell/cure-wounds"]);
    expect(sheet(3)).toContain("srd51:spell/spiritual-weapon");
    expect(sheet(3)).not.toContain("srd51:spell/beacon-of-hope");
    expect(sheet(9)).toHaveLength(10);
  });

  it("gives the Circle of the Land the spells of the terrain the druid picked, by level", () => {
    const pick = (terrain: string, level: number) => {
      const c = make("druid", level, "srd51:subclass/land");
      c.selections["srd51:feature/circle-of-the-land/option"] = [
        `srd51:feature/circle-of-the-land-${terrain}`,
      ];
      return deriveSheet(c, srd51Index).grantedSpells;
    };
    expect(pick("forest", 3)).toEqual(
      expect.arrayContaining(["srd51:spell/barkskin", "srd51:spell/spider-climb"]),
    );
    expect(pick("forest", 3)).not.toContain("srd51:spell/call-lightning");
    expect(pick("forest", 5)).toContain("srd51:spell/call-lightning");
    expect(pick("arctic", 5)).toContain("srd51:spell/sleet-storm");
    expect(pick("arctic", 5)).not.toContain("srd51:spell/call-lightning");
    expect(pick("swamp", 3)).toContain("srd51:spell/acid-arrow");
    // No terrain, no circle spells.
    const none = deriveSheet(make("druid", 5, "srd51:subclass/land"), srd51Index);
    expect(none.grantedSpells).toEqual([]);
  });

  it("adds a fiend patron's spells to the list a warlock picks from, without preparing them", () => {
    const lists = deriveSheet(make("warlock", 3, "srd51:subclass/fiend"), srd51Index)
      .spellcasters[0]?.lists;
    expect(lists?.alwaysPrepared).toEqual([]);
    expect(lists?.known?.pool).toContain("srd51:spell/burning-hands");
    expect(lists?.known?.pool).not.toContain("srd51:spell/fireball"); // needs 3rd-level slots
    const plain = deriveSheet(make("warlock", 3), srd51Index).spellcasters[0]?.lists;
    expect(plain?.known?.pool).not.toContain("srd51:spell/burning-hands");
  });
});

/** The Eldritch Knight's tables, as a subclass of the fighter that casts from the wizard list. */
function knight(): Entry {
  const slots: Record<number, number[]> = {
    3: [2],
    4: [3],
    7: [4, 2],
    10: [4, 3],
    13: [4, 3, 2],
    16: [4, 3, 3],
    19: [4, 3, 3, 1],
  };
  const known = [3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13];
  const levels = Array.from({ length: 18 }, (_, i) => {
    const level = i + 3;
    const at = Object.keys(slots)
      .map(Number)
      .filter((l) => l <= level)
      .pop() as number;
    const row = [...(slots[at] ?? []), ...Array(9).fill(0)].slice(0, 9);
    return {
      level,
      features: [],
      cantripsKnown: level >= 10 ? 3 : 2,
      spellsKnown: known[i] ?? 13,
      spellSlots: row,
    };
  });
  return {
    id: "test:subclass/eldritch-knight",
    kind: "subclass",
    parent: "srd51:class/fighter",
    effects: [],
    data: {
      levels,
      spells: [],
      spellcasting: {
        ability: "int",
        list: "srd51:class/wizard",
        startsAtLevel: 3,
        kind: "third",
      },
    },
  };
}

describe("a subclass that gives spellcasting", () => {
  const index = new Map([...srd51Index, ["test:subclass/eldritch-knight", knight()]]);
  const sub = "test:subclass/eldritch-knight";

  it("casts from the other class's list, with its own tables", () => {
    const sheet = deriveSheet(make("fighter", 3, sub), index);
    const caster = sheet.spellcasters[0];
    expect(caster?.classId).toBe("srd51:class/fighter");
    expect(caster?.ability).toBe("int");
    expect(caster?.cantripsKnown).toBe(2);
    expect(caster?.spellsKnown).toBe(3);
    expect(sheet.spellSlots).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(caster?.lists.cantrips?.pool).toContain("srd51:spell/fire-bolt");
    expect(caster?.lists.known?.pool).toContain("srd51:spell/shield");
    expect(caster?.lists.known?.pool).not.toContain("srd51:spell/cure-wounds");
    expect(sheet.warnings.filter((w) => w.code === "unknownEntry")).toEqual([]);
  });

  it("grows with the levels and takes picks stored under the fighter", () => {
    const c = make("fighter", 7, sub);
    c.spells["srd51:class/fighter"] = {
      cantrips: ["srd51:spell/fire-bolt", "srd51:spell/light"],
      known: ["srd51:spell/shield", "srd51:spell/magic-missile", "srd51:spell/sleep"],
      prepared: [],
    };
    const sheet = deriveSheet(c, index);
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters[0]?.spellsKnown).toBe(5);
    expect(sheet.spellcasters[0]?.lists.known?.chosen).toHaveLength(3);
    expect(sheet.warnings.map((w) => w.code)).not.toContain("invalidSpell");
    // Without the subclass the fighter casts nothing.
    expect(deriveSheet(make("fighter", 7), index).spellcasters).toEqual([]);
    // Before level 3 neither.
    expect(deriveSheet(make("fighter", 2, sub), index).spellcasters).toEqual([]);
  });

  it("limits the spells to the schools of the subclass, with a few picks left free", () => {
    const base = knight();
    const limited: Entry = {
      ...base,
      id: "test:subclass/school-knight",
      data: {
        ...base.data,
        spellcasting: {
          ...(base.data.spellcasting as object),
          schools: ["abjuration", "evocation"],
        },
      },
    };
    const schoolIndex = new Map([...index, [limited.id, limited]]);
    const knownAt = (level: number, known: string[]) => {
      const c = make("fighter", level, limited.id);
      c.spells["srd51:class/fighter"] = { cantrips: [], known, prepared: [] };
      return deriveSheet(c, schoolIndex);
    };
    const inSchool = ["srd51:spell/shield", "srd51:spell/magic-missile"];

    // At 3rd level one of the three spells may be of another school.
    const ok = knownAt(3, [...inSchool, "srd51:spell/sleep"]);
    expect(ok.spellcasters[0]?.lists.known?.chosen).toHaveLength(3);
    expect(ok.spellcasters[0]?.lists.known?.restriction).toEqual({
      schools: ["abjuration", "evocation"],
      free: 1,
    });
    expect(ok.warnings.map((w) => w.code)).not.toContain("spellSchool");

    // A second one of another school is not allowed yet...
    const over = knownAt(3, [
      "srd51:spell/sleep",
      "srd51:spell/charm-person",
      inSchool[0] as string,
    ]);
    expect(over.spellcasters[0]?.lists.known?.chosen).toEqual([
      "srd51:spell/sleep",
      "srd51:spell/shield",
    ]);
    expect(over.warnings.map((w) => w.code)).toContain("spellSchool");

    // ...but at 8th level there are two free picks.
    const later = knownAt(8, [
      "srd51:spell/sleep",
      "srd51:spell/charm-person",
      inSchool[0] as string,
    ]);
    expect(later.spellcasters[0]?.lists.known?.chosen).toHaveLength(3);
    expect(later.warnings.map((w) => w.code)).not.toContain("spellSchool");

    // A subclass with no schools is not limited.
    expect(
      deriveSheet(make("fighter", 3, sub), index).spellcasters[0]?.lists.known?.restriction,
    ).toBeUndefined();
  });

  it("counts a third of the levels when multiclassed with a full caster", () => {
    const c = make("fighter", 6, sub);
    c.classes.push({ classId: "srd51:class/wizard", level: 3 });
    const sheet = deriveSheet(c, index);
    // Caster level 6/3 + 3 = 5.
    expect(sheet.spellSlots).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters).toHaveLength(2);
  });
});

describe("spells a subclass gives to those who know their spells", () => {
  const giving = (parent: string, spells: string[]): Entry => ({
    ...knight(),
    id: "test:subclass/giving",
    parent,
    data: {
      ...knight().data,
      spells: spells.map((s) => ({ spell: `srd51:spell/${s}`, classLevel: 3 })),
    },
  });

  it("takes no pick for them, and leaves aside without a warning the pick of an older import", () => {
    const sub = giving("srd51:class/fighter", ["mage-hand", "shield"]);
    const index = new Map([...srd51Index, [sub.id, sub]]);
    const c = make("fighter", 3, sub.id);
    c.spells["srd51:class/fighter"] = {
      cantrips: ["srd51:spell/mage-hand", "srd51:spell/light", "srd51:spell/fire-bolt"],
      known: ["srd51:spell/shield", "srd51:spell/sleep"],
      prepared: [],
    };
    const sheet = deriveSheet(c, index);
    const lists = sheet.spellcasters[0]?.lists;
    expect(lists?.alwaysPrepared).toEqual(["srd51:spell/mage-hand", "srd51:spell/shield"]);
    expect(lists?.cantrips?.pool).not.toContain("srd51:spell/mage-hand");
    expect(lists?.cantrips?.chosen).toEqual(["srd51:spell/light", "srd51:spell/fire-bolt"]);
    expect(lists?.known?.chosen).toEqual(["srd51:spell/sleep"]);
    const codes = sheet.warnings.map((w) => w.code);
    expect(codes).not.toContain("invalidSpell");
    expect(codes).not.toContain("tooManySpells");
  });

  it("gives the 2024 spells to a 2024 fighter, though the list is of the 2014 wizard", () => {
    const sub = giving("srd52:class/fighter", ["shield"]);
    const c = createCharacter("srd52");
    c.classes = [{ classId: "srd52:class/fighter", level: 3, subclassId: sub.id }];
    const sheet = deriveSheet(c, new Map([...bothIndex, [sub.id, sub]]));
    expect(sheet.spellcasters[0]?.lists.alwaysPrepared).toEqual(["srd52:spell/shield"]);
  });

  it("counts Magic Weapon among the spells of the character, for the weapons in Play", () => {
    const sub = giving("srd51:class/fighter", ["magic-weapon"]);
    const index = new Map([...srd51Index, [sub.id, sub]]);
    const attack = (level: number) => {
      const c = make("fighter", level, sub.id);
      c.inventory = [{ itemId: "srd51:item/longsword", quantity: 1, equipped: true }];
      return deriveSheet(c, index).attacks[0];
    };
    expect(attack(3)?.canMagicWeapon).toBe(true);
    expect(attack(2)?.canMagicWeapon).toBeUndefined();
  });
});
