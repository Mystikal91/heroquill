import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { breathWeaponOf } from "./actions";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

type Character = ReturnType<typeof createCharacter>;

const SPECIES = [
  "dragonborn",
  "dwarf",
  "elf",
  "gnome",
  "goliath",
  "halfling",
  "human",
  "orc",
  "tiefling",
] as const;

function make(species: string, level = 1, pick?: { choice: string; option: string }): Character {
  const c = createCharacter("srd52");
  c.choices.species = `srd52:species/${species}`;
  c.choices.background = "srd52:background/soldier";
  c.classes = [{ classId: "srd52:class/fighter", level }];
  c.abilityBase = { str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 };
  if (pick) {
    c.selections[`srd52:species/${species}/${pick.choice}`] = [`srd52:trait/${pick.option}`];
  }
  return c;
}
const sheetOf = (c: Character) => deriveSheet(c, bothIndex);

describe("the nine 2024 species", () => {
  it("all derive a sheet with no unknown entry", () => {
    for (const s of SPECIES) {
      const sheet = sheetOf(make(s));
      expect(
        sheet.warnings.filter((w) => w.code === "unknownEntry"),
        s,
      ).toEqual([]);
    }
  });

  it("have the speed of the book (the Goliath 35, the others 30)", () => {
    for (const s of SPECIES) expect(sheetOf(make(s)).speed, s).toBe(s === "goliath" ? 35 : 30);
  });

  it("have the darkvision of the book", () => {
    const range = (s: string) => sheetOf(make(s)).senses.darkvision;
    expect(range("dwarf")).toBe(120);
    expect(range("orc")).toBe(120);
    for (const s of ["dragonborn", "elf", "gnome", "tiefling"]) expect(range(s), s).toBe(60);
    expect(range("halfling")).toBeUndefined();
    expect(range("goliath")).toBeUndefined();
  });

  it("ask for the option of a lineage, ancestry or legacy the species has", () => {
    const asked: Record<string, [string, number]> = {
      dragonborn: ["draconic-ancestry", 10],
      elf: ["elven-lineage", 3],
      gnome: ["gnomish-lineage", 2],
      goliath: ["giant-ancestry", 6],
      tiefling: ["fiendish-legacy", 3],
    };
    for (const [s, [choice, n]] of Object.entries(asked)) {
      const pick = sheetOf(make(s)).choices.find((p) => p.key === `srd52:species/${s}/${choice}`);
      expect(pick?.options.length, s).toBe(n);
      expect(pick?.remaining, s).toBe(1);
    }
  });
});

describe("what the traits do", () => {
  it("the Dwarf resists poison and has one more hit point for each level", () => {
    const at = (level: number) => sheetOf(make("dwarf", level));
    expect(at(1).defenses.resistance).toContain("poison");
    expect(at(1).hitPoints.max).toBe(sheetOf(make("human", 1)).hitPoints.max + 1);
    expect(at(5).hitPoints.max).toBe(sheetOf(make("human", 5)).hitPoints.max + 5);
  });

  it("the Orc has Adrenaline Rush as many times as its proficiency bonus, and Relentless Endurance once", () => {
    const sheet = sheetOf(make("orc", 5));
    const rush = sheet.resources.find((r) => r.entry === "srd52:trait/adrenaline-rush");
    expect(rush?.max).toBe(3);
    const relentless = sheet.resources.find((r) => r.entry === "srd52:trait/relentless-endurance");
    expect(relentless?.max).toBe(1);
  });

  it("the Dragonborn takes resistance and the breath weapon from its ancestor", () => {
    const red = (level: number) =>
      sheetOf(
        make("dragonborn", level, { choice: "draconic-ancestry", option: "draconic-ancestor-red" }),
      );
    expect(red(1).defenses.resistance).toContain("fire");
    const breath = (level: number) => breathWeaponOf(red(level), bothIndex);
    expect(breath(1)).toMatchObject({
      dice: "1d10",
      damageType: "fire",
      save: "dex",
      dc: 8 + 2 + 2,
    });
    expect(breath(5)?.dice).toBe("2d10");
    expect(breath(11)?.dice).toBe("3d10");
    expect(breath(17)?.dice).toBe("4d10");
    const silver = sheetOf(
      make("dragonborn", 1, { choice: "draconic-ancestry", option: "draconic-ancestor-silver" }),
    );
    expect(silver.defenses.resistance).toContain("cold");
    expect(silver.defenses.resistance).not.toContain("fire");
  });

  it("an Elf lineage gives its senses, speed and spells, the higher ones at the 3rd and 5th level", () => {
    const lineage = (option: string, level = 1) =>
      sheetOf(make("elf", level, { choice: "elven-lineage", option }));
    expect(lineage("elven-lineage-drow").senses.darkvision).toBe(120);
    expect(lineage("elven-lineage-wood-elf").speed).toBe(35);
    expect(lineage("elven-lineage-high-elf").speed).toBe(30);
    const spells = (level: number) => lineage("elven-lineage-high-elf", level).grantedSpells;
    expect(spells(1)).toContain("srd52:spell/prestidigitation");
    expect(spells(1)).not.toContain("srd52:spell/detect-magic");
    expect(spells(3)).toContain("srd52:spell/detect-magic");
    expect(spells(3)).not.toContain("srd52:spell/misty-step");
    expect(spells(5)).toContain("srd52:spell/misty-step");
  });

  it("a Tiefling legacy gives its resistance and spells, and Thaumaturgy comes with the species", () => {
    const sheet = sheetOf(
      make("tiefling", 5, { choice: "fiendish-legacy", option: "fiendish-legacy-infernal" }),
    );
    expect(sheet.defenses.resistance).toContain("fire");
    for (const spell of ["thaumaturgy", "fire-bolt", "hellish-rebuke", "darkness"]) {
      expect(sheet.grantedSpells, spell).toContain(`srd52:spell/${spell}`);
    }
  });

  it("a Goliath ancestry is used as many times as the proficiency bonus", () => {
    const sheet = sheetOf(
      make("goliath", 5, { choice: "giant-ancestry", option: "giant-ancestry-fires-burn" }),
    );
    const uses = sheet.resources.find((r) => r.entry === "srd52:trait/giant-ancestry-fires-burn");
    expect(uses?.max).toBe(3);
  });
});

describe("the 2024 backgrounds", () => {
  it("Acolyte, Criminal and Soldier are there, each with its Origin feat", () => {
    const feat: Record<string, string> = {
      acolyte: "magic-initiate",
      criminal: "alert",
      soldier: "savage-attacker",
    };
    for (const [slug, f] of Object.entries(feat)) {
      const entry = bothIndex.get(`srd52:background/${slug}`);
      expect(entry, slug).toBeDefined();
      expect((entry?.data as { feat: string }).feat).toBe(`srd52:feat/${f}`);
    }
  });
});
