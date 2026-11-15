import { describe, expect, it } from "vitest";
import { itemData } from "../data/items";
import { parsePack } from "../data/schema";
import type { Entry } from "../data/schema";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import { srd51Index } from "../test/srd51";
import { startEntry } from "./blanks";
import {
  type ClassCasting,
  applyClassCasting,
  applySubclassCasting,
  readClassCasting,
  readSubclassCasting,
  slotsFor,
  thirdSlots,
} from "./casting";
import { addOwned, entryProblems, setText, updateEntry } from "./entries";
import { newHomebrewPack } from "./pack";
import { syncItemData } from "./sync";

const pack = () => newHomebrewPack("Mine", 1000);
const indexWith = (entries: Entry[]) =>
  new Map<string, Entry>([...srd51Index, ...entries.map((e) => [e.id, e] as const)]);

describe("what the studio makes works in a character", () => {
  it("a species and a feat change the sheet", () => {
    let record = pack();
    const species = startEntry(record, "species");
    record = updateEntry(species.record, species.id, {
      effects: [{ type: "abilityBonus", ability: "con", value: 2 }],
      data: { speed: 25 },
    });
    const feat = startEntry(record, "feat");
    record = updateEntry(feat.record, feat.id, {
      effects: [{ type: "abilityBonus", ability: "str", value: 1 }],
    });
    expect(() => parsePack(record.pack)).not.toThrow();
    const c = createCharacter("srd51");
    c.choices.species = species.id;
    c.classes = [{ classId: "srd51:class/fighter", level: 4 }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    c.feats = [feat.id];
    const sheet = deriveSheet(c, indexWith(record.pack.entries));
    expect(sheet.abilities.con.score).toBe(12);
    expect(sheet.abilities.str.score).toBe(11);
    expect(sheet.speed).toBe(25);
  });

  it("a weapon adds its own bonus to attack and damage and counts as magic", () => {
    const made = startEntry(pack(), "item", "weapon");
    const weapon = made.record.pack.entries[0] as Entry;
    const data = syncItemData({
      ...weapon.data,
      enhancement: 1,
      weapon: {
        ...(weapon.data.weapon as object),
        category: "martial",
        damage: { dice: "1d8", type: "slashing" },
      },
    });
    const record = updateEntry(made.record, made.id, { data });
    const entry = record.pack.entries[0] as Entry;
    expect(entryProblems(entry)).toEqual([]);
    expect(itemData(entry).weapon?.proficiency).toEqual(["weapon:martial-weapons"]);
    const attackOf = (itemId: string) => {
      const c = createCharacter("srd51");
      c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
      c.abilityBase = { str: 14, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
      c.inventory = [{ itemId, quantity: 1, equipped: true }];
      return deriveSheet(c, indexWith(record.pack.entries)).attacks.find(
        (a) => a.itemId === itemId,
      );
    };
    const mine = attackOf(made.id);
    const plain = attackOf("srd51:item/longsword");
    expect(mine?.enhancement).toBe(1);
    expect(mine?.magical).toBe(true);
    expect(mine?.attackBonus).toBe((plain?.attackBonus ?? 0) + 1);
    expect(mine?.damage?.bonus).toBe((plain?.damage?.bonus ?? 0) + 1);
  });

  it("an armor keeps its properties", () => {
    const made = startEntry(pack(), "item", "armor");
    const armor = made.record.pack.entries[0] as Entry;
    const record = updateEntry(made.record, made.id, {
      data: { armor: { ...(armor.data.armor as object), properties: ["srd51:property/heavy"] } },
    });
    expect(itemData(record.pack.entries[0] as Entry).armor?.properties).toEqual([
      "srd51:property/heavy",
    ]);
  });

  it("a class with a subclass casts by its level tables", () => {
    let record = startEntry(pack(), "class").record;
    const classId = record.pack.entries[0]?.id as string;
    const casting: ClassCasting = {
      kind: "half",
      ability: "int",
      preparation: "prepared",
      cantrips: 2,
    };
    const { spellcasting, levels } = applyClassCasting(record.pack.entries[0]?.data ?? {}, casting);
    record = updateEntry(record, classId, { data: { spellcasting, levels } });
    record = setText(record, classId, "name", "Tinker Mage");
    const sub = startEntry(record, "subclass");
    record = updateEntry(sub.record, sub.id, { parent: classId as Entry["id"] });
    record = addOwned(record, sub.id, "feature", { level: 3 }).record;
    expect(() => parsePack(record.pack)).not.toThrow();
    const c = createCharacter("srd51");
    c.classes = [{ classId, level: 5, subclassId: sub.id }];
    c.abilityBase = { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 };
    const sheet = deriveSheet(c, indexWith(record.pack.entries));
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters[0]?.cantripsKnown).toBe(3);
  });

  it("a subclass gives a fighter the tables of a third caster", () => {
    const made = startEntry(pack(), "subclass");
    const entry = made.record.pack.entries[0] as Entry;
    const { spellcasting, levels } = applySubclassCasting(entry.data, {
      enabled: true,
      ability: "int",
      list: "srd51:class/wizard",
      schools: [],
      cantrips: 2,
    });
    const record = updateEntry(made.record, made.id, {
      parent: "srd51:class/fighter",
      data: { spellcasting, levels },
    });
    expect(() => parsePack(record.pack)).not.toThrow();
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 7, subclassId: made.id }];
    const sheet = deriveSheet(c, indexWith(record.pack.entries));
    expect(sheet.spellSlots).toEqual([4, 2, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheet.spellcasters[0]?.cantripsKnown).toBe(2);
    expect(sheet.spellcasters[0]?.spellsKnown).toBe(5);
  });
});

describe("spellcasting of a class", () => {
  const blank = () => startEntry(pack(), "class").record.pack.entries[0]?.data ?? {};

  it("is read back as it was chosen", () => {
    const casting: ClassCasting = {
      kind: "pact",
      ability: "cha",
      preparation: "known",
      cantrips: 2,
    };
    const { spellcasting, levels } = applyClassCasting(blank(), casting);
    expect(readClassCasting({ spellcasting, levels })).toEqual(casting);
    expect(readClassCasting({ ...blank() })).toMatchObject({ kind: "none", cantrips: 0 });
    const half = applyClassCasting(blank(), { ...casting, kind: "half" });
    expect(readClassCasting({ spellcasting: half.spellcasting, levels: half.levels }).kind).toBe(
      "half",
    );
  });

  it("makes Pact Magic slots of one growing level, and half casters start at 2", () => {
    expect(slotsFor("pact", 1)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(slotsFor("pact", 9)).toEqual([0, 0, 0, 0, 2, 0, 0, 0, 0]);
    expect(slotsFor("pact", 17)).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0]);
    expect(slotsFor("half", 1)).toEqual(Array(9).fill(0));
    const { levels } = applyClassCasting(blank(), {
      kind: "half",
      ability: "wis",
      preparation: "prepared",
      cantrips: 0,
    });
    expect(levels[0]?.spellSlots).toBeUndefined();
    expect(levels[1]?.spellSlots).toEqual(slotsFor("half", 2));
  });

  it("takes the tables away when the class stops casting, and keeps features and increases", () => {
    const withCasting = applyClassCasting(blank(), {
      kind: "full",
      ability: "int",
      preparation: "prepared",
      cantrips: 3,
    });
    const off = applyClassCasting(
      { levels: withCasting.levels },
      { kind: "none", ability: "int", preparation: "prepared", cantrips: 0 },
    );
    expect(off.spellcasting).toBeUndefined();
    expect(
      off.levels.every((r) => r.spellSlots === undefined && r.cantripsKnown === undefined),
    ).toBe(true);
    expect(off.levels[3]?.abilityScoreImprovements).toBe(1);
  });

  it("gives more cantrips as the level grows, and spells known to a class that knows its spells", () => {
    const { levels } = applyClassCasting(blank(), {
      kind: "full",
      ability: "cha",
      preparation: "known",
      cantrips: 2,
    });
    expect(levels.map((r) => r.cantripsKnown).filter((_, i) => [0, 3, 9].includes(i))).toEqual([
      2, 3, 4,
    ]);
    expect(levels[0]?.spellsKnown).toBe(2);
  });
});

describe("spellcasting of a subclass", () => {
  it("builds the tables of a third caster and takes them away again", () => {
    const base = { levels: [{ level: 3, features: ["x:feature/a"] }] };
    const on = applySubclassCasting(base, {
      enabled: true,
      ability: "int",
      list: "srd51:class/wizard",
      schools: ["abjuration"],
      cantrips: 2,
    });
    expect(on.spellcasting).toMatchObject({
      kind: "third",
      startsAtLevel: 3,
      schools: ["abjuration"],
    });
    expect(on.levels).toHaveLength(18);
    expect(on.levels[0]).toMatchObject({
      level: 3,
      features: ["x:feature/a"],
      spellSlots: thirdSlots(3),
      cantripsKnown: 2,
    });
    expect(on.levels[17]?.spellSlots).toEqual(thirdSlots(20));
    expect(readSubclassCasting({ spellcasting: on.spellcasting, levels: on.levels })).toMatchObject(
      { enabled: true, schools: ["abjuration"], cantrips: 2 },
    );
    const off = applySubclassCasting(
      { levels: on.levels },
      { enabled: false, ability: "int", list: "", schools: [], cantrips: 0 },
    );
    expect(off.spellcasting).toBeUndefined();
    expect(off.levels).toEqual([{ level: 3, features: ["x:feature/a"] }]);
  });
});
