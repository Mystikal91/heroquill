import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

/** What the Fighter Features table of the SRD 5.2.1 says, level by level (read from the PDF, page 47). */
const BOOK = {
  secondWind: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  mastery: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6],
  // Ability Score Improvement at levels 4, 6, 8, 12, 14 and 16; the Epic Boon at 19 is not one of them.
  increases: [0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 6],
  proficiency: [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6],
};

function fighter(level: number) {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/soldier";
  c.classes = [
    {
      classId: "srd52:class/fighter",
      level,
      ...(level >= 3 && { subclassId: "srd52:subclass/champion" }),
    },
  ];
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  return deriveSheet(c, bothIndex);
}

const texts = (file: string): Record<string, string> =>
  JSON.parse(readFileSync(`locales/en/srd52/${file}.json`, "utf8"));

describe("the Fighter table of the book, level by level", () => {
  for (let level = 1; level <= 20; level++) {
    it(`matches at level ${level}`, () => {
      const sheet = fighter(level);
      expect(sheet.proficiencyBonus).toBe(BOOK.proficiency[level - 1]);
      expect(sheet.asi.available).toBe(BOOK.increases[level - 1]);
      const mastery = sheet.choices.find((c) => c.source.endsWith("fighter-weapon-mastery"));
      expect(mastery?.choose).toBe(BOOK.mastery[level - 1]);
      const wind = sheet.resources.find((r) => r.entry === "srd52:feature/fighter-second-wind");
      expect(wind?.max).toBe(BOOK.secondWind[level - 1]);
    });
  }
});

describe("the Fighter's skills", () => {
  it("offers the nine skills of the book, Persuasion included", () => {
    const skills = fighter(1).choices.find((c) => c.key.endsWith("fighter-proficiency-1"));
    expect([...(skills?.options ?? [])].sort()).toEqual(
      [
        "skill:acrobatics",
        "skill:animal-handling",
        "skill:athletics",
        "skill:history",
        "skill:insight",
        "skill:intimidation",
        "skill:perception",
        "skill:persuasion",
        "skill:survival",
      ].sort(),
    );
  });
});

describe("names and texts as the book writes them", () => {
  it("writes the names with their hyphens", () => {
    expect(texts("feats")["two-weapon-fighting.name"]).toBe("Two-Weapon Fighting");
    expect(texts("items")["half-plate-armor.name"]).toBe("Half Plate Armor");
    expect(texts("items")["spell-scroll-cantrip.name"]).toBe("Spell Scroll (Cantrip)");
  });

  it("gives the Epic Boons their own ability increase", () => {
    expect(texts("feats")["boon-of-irresistible-offense.desc"]).toContain(
      "Increase your Strength or Dexterity score by 1",
    );
    expect(texts("feats")["boon-of-spell-recall.desc"]).toContain(
      "Increase your Intelligence, Wisdom, or Charisma score by 1",
    );
    expect(texts("feats")["boon-of-fate.desc"]).toContain("one ability score of your choice");
  });

  it("closes the hyphen the PDF broke at the end of a line", () => {
    expect(texts("items")["lamp.desc"]).toContain("15-foot radius");
  });
});

describe("what the equipment packs hold, as the book lists it", () => {
  const holds = (slug: string) =>
    Object.fromEntries(
      (
        (
          bothIndex.get(`srd52:item/${slug}`)?.data.gear as {
            contents: { item: string; quantity: number }[];
          }
        ).contents ?? []
      ).map((c) => [c.item.replace("srd52:item/", ""), c.quantity]),
    );

  it("has one caltrops item and no flask in the Dungeoneer's Pack", () => {
    expect(holds("dungeoneer-pack")).toEqual({
      backpack: 1,
      caltrops: 1,
      crowbar: 1,
      oil: 2,
      rations: 10,
      rope: 1,
      tinderbox: 1,
      torch: 10,
      waterskin: 1,
    });
  });

  it("has the 2024 contents in the Entertainer's Pack", () => {
    expect(holds("entertainers-pack")).toEqual({
      backpack: 1,
      bedroll: 1,
      bell: 1,
      "lantern-bullseye": 1,
      costume: 3,
      mirror: 1,
      oil: 8,
      rations: 9,
      tinderbox: 1,
      waterskin: 1,
    });
  });

  it("has no blanket in the Scholar's Pack, nor in its text", () => {
    expect(holds("scholars-pack")).not.toHaveProperty("blanket");
    expect(texts("items")["scholars-pack.desc"]).not.toContain("Blanket");
  });

  it("never lists a flask next to the flasks of Oil", () => {
    for (const pack of ["burglars-pack", "diplomat-pack", "dungeoneer-pack"])
      expect(holds(pack), pack).not.toHaveProperty("flask");
  });

  it("keeps the packs the database had right", () => {
    expect(holds("explorers-pack")).toMatchObject({ backpack: 1, bedroll: 1, oil: 2, torch: 10 });
    expect(holds("priests-pack")).toMatchObject({ blanket: 1, "holy-water": 1, rations: 7 });
  });
});
