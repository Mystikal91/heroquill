import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import {
  SRD51_FILES,
  srd51Index as index,
  loadSrd51Pack,
  loadSrd51Strings,
  srd51Packs as packs,
} from "../test/srd51";
import { itemData } from "./items";
import { classData, subclassData } from "./progression";
import { plainEffects } from "../engine/requirements";
import { type Entry, findBrokenReferences } from "./schema";

describe("SRD 5.1 pack", () => {
  it("passes schema validation and has no broken references", () => {
    expect(findBrokenReferences(packs)).toEqual([]);
  });

  it("has a display name for every entry", () => {
    for (const file of SRD51_FILES) {
      const texts = loadSrd51Strings(file);
      for (const entry of loadSrd51Pack(file).entries) {
        const slug = entry.id.split("/")[1] ?? "";
        expect(texts[`${slug}.name`], entry.id).toBeTruthy();
      }
    }
  });

  it("keeps display text out of the data files", () => {
    const spells = loadSrd51Pack("spells").entries;
    expect(spells).toHaveLength(319);
    expect(JSON.stringify(spells)).not.toContain("explosion of flame");
  });

  it("models Fireball structurally", () => {
    const fireball = index.get("srd51:spell/fireball");
    expect(fireball?.data).toMatchObject({
      level: 3,
      school: "evocation",
      concentration: false,
      classes: ["srd51:class/sorcerer", "srd51:class/wizard"],
    });
  });

  it("derives a High Elf from real data, including trait proficiencies", () => {
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/elf";
    c.choices.subspecies = "srd51:subspecies/high-elf";
    const sheet = deriveSheet(c, index);
    expect(sheet.abilities.dex.score).toBe(12);
    expect(sheet.abilities.int.score).toBe(11);
    expect(sheet.proficiencies.skill).toContain("perception");
    expect(sheet.proficiencies.language).toEqual(expect.arrayContaining(["common", "elvish"]));
    expect(sheet.traits).toEqual(
      expect.arrayContaining(["srd51:trait/keen-senses", "srd51:trait/high-elf-cantrip"]),
    );
    expect(sheet.warnings).toEqual([]);
  });

  it("represents choices as data: Half-Elf ability bonuses and High Elf cantrip", () => {
    const halfElf = index.get("srd51:species/half-elf");
    expect(plainEffects(halfElf?.effects ?? [])).toContainEqual(
      expect.objectContaining({ type: "choice", grants: "abilityBonus", choose: 2, value: 1 }),
    );
    const cantrip = index.get("srd51:trait/high-elf-cantrip");
    expect(cantrip?.effects).toContainEqual(
      expect.objectContaining({ type: "choice", grants: "spell", choose: 1 }),
    );
  });

  it("lists the classes of a spell as the SRD 5.1 does, where 5e-database differs", () => {
    const classes = (slug: string) =>
      [...((index.get(`srd51:spell/${slug}`)?.data.classes as string[] | undefined) ?? [])]
        .map((c) => c.split("/")[1])
        .sort();
    expect(classes("faerie-fire")).toEqual(["bard", "druid"]);
    expect(classes("meld-into-stone")).toEqual(["cleric", "druid"]);
    expect(classes("divination")).toEqual(["cleric"]);
    expect(classes("create-food-and-water")).toEqual(["cleric", "paladin"]);
    expect(classes("arcane-eye")).toEqual(["wizard"]);
  });

  it("leaves a choice of your choice open to the languages and cantrips of a book", () => {
    const book: Entry[] = [
      { id: "bk:language/aquan", kind: "language", effects: [], data: { type: "exotic" } },
      { id: "bk:language/druidic", kind: "language", effects: [], data: { type: "secret" } },
      { id: "bk:language/blink-dog", kind: "language", effects: [], data: { type: "monster" } },
      {
        id: "bk:spell/booming-blade",
        kind: "spell",
        effects: [],
        data: { level: 0, school: "evocation", classes: ["srd51:class/wizard"] },
      },
    ];
    const withBook = new Map(index);
    for (const e of book) withBook.set(e.id, e);
    const c = createCharacter("srd51");
    c.choices.species = "srd51:species/elf";
    c.choices.subspecies = "srd51:subspecies/high-elf";
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    const choices = deriveSheet(c, withBook).choices;
    const language = choices.find((p) => p.key.endsWith("extra-language-language"));
    expect(language?.options).toEqual(expect.arrayContaining(["dwarvish", "abyssal", "aquan"]));
    expect(language?.options).not.toContain("druidic");
    expect(language?.options).not.toContain("blink-dog");
    const spell = choices.find((p) => p.key.endsWith("high-elf-cantrip-spell"));
    expect(spell?.options).toEqual(
      expect.arrayContaining(["srd51:spell/fire-bolt", "bk:spell/booming-blade"]),
    );
    expect(spell?.options).not.toContain("srd51:spell/sacred-flame");
    // A language the character speaks already is not offered (the elf's Common and Elvish).
    expect(language?.options).not.toContain("common");
    expect(language?.options).not.toContain("elvish");
    // The SRD's own: two languages of the acolyte's choice, one of the human's.
    for (const id of ["srd51:background/acolyte", "srd51:species/human", "srd51:species/half-elf"])
      expect(index.get(id)?.effects, id).toContainEqual(
        expect.objectContaining({ grants: "language", from: [] }),
      );
  });
});

describe("SRD 5.1 classes", () => {
  const classes = loadSrd51Pack("classes").entries;
  const subclasses = loadSrd51Pack("subclasses").entries;

  it("has all 12 classes with 20 level rows and 12 subclasses", () => {
    expect(classes).toHaveLength(12);
    expect(subclasses).toHaveLength(12);
    for (const entry of classes) expect(classData(entry).levels, entry.id).toHaveLength(20);
  });

  it("resolves every referenced feature, spell and class", () => {
    const missing: string[] = [];
    const need = (from: string, ref: string) => {
      if (!index.has(ref)) missing.push(`${from} -> ${ref}`);
    };
    for (const entry of classes)
      for (const row of classData(entry).levels) for (const f of row.features) need(entry.id, f);
    for (const entry of subclasses) {
      const data = subclassData(entry);
      for (const row of data.levels) for (const f of row.features) need(entry.id, f);
      for (const sp of data.spells) need(entry.id, sp.spell);
    }
    for (const spell of loadSrd51Pack("spells").entries)
      for (const c of spell.data.classes as string[]) need(spell.id, c);
    for (const feature of loadSrd51Pack("features").entries)
      need(feature.id, feature.data.class as string);
    expect(missing).toEqual([]);
  });

  it("describes Wizard spellcasting and the Wizard's saving throws", () => {
    const wizard = index.get("srd51:class/wizard");
    if (!wizard) throw new Error("wizard missing");
    const data = classData(wizard);
    expect(data.hitDie).toBe(6);
    expect(data.spellcasting).toEqual({
      ability: "int",
      startsAtLevel: 1,
      preparation: { type: "spellbook", initial: 6, perLevel: 2 },
    });
    expect(data.levels[4]).toMatchObject({
      level: 5,
      cantripsKnown: 4,
      spellSlots: [4, 3, 2, 0, 0, 0, 0, 0, 0],
    });
    expect(wizard.effects).toContainEqual({ type: "proficiency", category: "save", target: "int" });
  });

  it("models the Fighter's multiclass requirement as a choice of STR or DEX 13", () => {
    const fighter = index.get("srd51:class/fighter");
    if (!fighter) throw new Error("fighter missing");
    expect(classData(fighter).multiclassing.prerequisiteOptions).toEqual({
      choose: 1,
      from: [
        { ability: "str", minimum: 13 },
        { ability: "dex", minimum: 13 },
      ],
    });
  });
});

describe("SRD 5.1 equipment", () => {
  const items = loadSrd51Pack("items").entries;

  it("has structured weapons, armor and a property entry for every weapon property", () => {
    const weapons = items.filter((i) => itemData(i).weapon);
    const armors = items.filter((i) => itemData(i).armor);
    // The equipment of the book and, after it, the magic items (the ones with variants are not listed).
    expect(items.filter((i) => !itemData(i).rarity)).toHaveLength(237);
    expect(items.filter((i) => itemData(i).rarity)).toHaveLength(341);
    expect(weapons).toHaveLength(37);
    expect(armors).toHaveLength(13);
    for (const w of weapons)
      for (const p of itemData(w).weapon?.properties ?? []) expect(index.has(p), p).toBe(true);
  });

  it("resolves every item referenced by classes, backgrounds and packs", () => {
    const missing: string[] = [];
    const need = (from: string, ref: string) => {
      if (!index.has(ref)) missing.push(`${from} -> ${ref}`);
    };
    for (const entry of [
      ...loadSrd51Pack("classes").entries,
      ...loadSrd51Pack("backgrounds").entries,
    ])
      for (const e of entry.data.startingEquipment as { item: string }[]) need(entry.id, e.item);
    for (const item of items) {
      const contents = (item.data.gear as { contents?: { item: string }[] } | undefined)?.contents;
      for (const c of contents ?? []) need(item.id, c.item);
    }
    expect(missing).toEqual([]);
  });

  it("models Chain Mail and the Longsword", () => {
    expect(itemData(index.get("srd51:item/chain-mail") as never).armor).toMatchObject({
      category: "heavy",
      base: 16,
      dexBonus: false,
      strengthMinimum: 13,
      stealthDisadvantage: true,
      proficiency: ["armor:chain-mail", "armor:heavy-armor", "armor:all-armor"],
    });
    expect(itemData(index.get("srd51:item/longsword") as never).weapon).toMatchObject({
      category: "martial",
      kind: "melee",
      damage: { dice: "1d8", type: "slashing" },
      twoHandedDamage: { dice: "1d10", type: "slashing" },
      proficiency: ["weapon:longswords", "weapon:martial-weapons"],
    });
  });
});

describe("features with effects", () => {
  it("can all be reached: every feature that offers a choice is in a class or subclass level", () => {
    const reachable = new Set<string>();
    for (const entry of index.values()) {
      if (entry.kind === "class") for (const l of classData(entry).levels) l.features.forEach((f) => reachable.add(f));
      if (entry.kind === "subclass") for (const l of subclassData(entry).levels) l.features.forEach((f) => reachable.add(f));
    }
    const lost = [...index.values()]
      .filter((e) => e.kind === "feature" && e.effects.some((x) => x.type === "choice"))
      // An option of a feature that is reached (a pact of the warlock) is reached through it.
      .filter((e) => !reachable.has(e.id) && !(e.parent && reachable.has(e.parent)))
      .map((e) => e.id);
    expect(lost).toEqual([]);
  });

  it("gives every terrain of the Circle of the Land its spells, four levels of two", () => {
    const terrains = [...index.values()].filter((e) =>
      e.id.startsWith("srd51:feature/circle-of-the-land-"),
    );
    expect(terrains).toHaveLength(7);
    for (const terrain of terrains)
      expect(terrain.effects.filter((x) => x.type === "grantSpell")).toHaveLength(8);
  });
});
