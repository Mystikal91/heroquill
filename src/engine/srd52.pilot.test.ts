import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { inRuleset } from "./rulesets";

/** The pilot character of the 2024 rules: a Human Soldier, Fighter 3 (Champion). */
function pilot(level = 3) {
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
  return c;
}

describe("the 2024 pilot pack", () => {
  it("derives a Fighter 3 (Champion) with the 2024 numbers", () => {
    const sheet = deriveSheet(pilot(), bothIndex);
    expect(sheet.level).toBe(3);
    expect(sheet.proficiencyBonus).toBe(2);
    expect(sheet.hitPoints.hitDice).toEqual({ d10: 3 });
    expect(sheet.critRange).toBe(19);
    // A species gives no ability scores in 2024: the scores are the base ones.
    expect(sheet.abilities.str.score).toBe(15);
    expect(sheet.abilities.cha.score).toBe(8);
  });

  it("raises the critical range again at level 15", () => {
    expect(deriveSheet(pilot(15), bothIndex).critRange).toBe(18);
  });

  it("keeps the Soldier's skills and the Human's open picks", () => {
    const sheet = deriveSheet(pilot(), bothIndex);
    const ids = sheet.choices.map((c) => c.key);
    expect(ids.some((k) => k.endsWith("/versatile-feat"))).toBe(true);
    expect(ids.some((k) => k.endsWith("/skillful-skill"))).toBe(true);
    const feat = sheet.choices.find((c) => c.key.endsWith("/versatile-feat"));
    // Only the Origin feats of the 2024 SRD, and none of the 2014 ones.
    expect(feat?.options.every((o) => o.startsWith("srd52:feat/"))).toBe(true);
    expect(feat?.options.length).toBe(4);
  });

  it("does not offer 2024 feats to a 2014 character", () => {
    expect(inRuleset("srd52:feat/alert", "srd51")).toBe(false);
    expect(inRuleset("srd51:class/fighter", "srd52")).toBe(false);
    // A pack the person added belongs to both.
    expect(inRuleset("aurora1:class/artificer", "srd51")).toBe(true);
    expect(inRuleset("aurora1:class/artificer", "srd52")).toBe(true);
  });

  it("gives every pack entry an id in its own pack", () => {
    for (const [entryId, entry] of bothIndex) {
      expect(entry.id).toBe(entryId);
    }
    expect(bothIndex.get("srd52:feat/savage-attacker")?.data.category).toBe("origin");
    expect(bothIndex.get("srd52:background/soldier")?.data.abilityScores).toEqual([
      "str",
      "dex",
      "con",
    ]);
  });
});
