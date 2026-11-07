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

  it("gives the Soldier's Origin feat and +2/+1 among Strength, Dexterity and Constitution", () => {
    const c = pilot();
    c.selections["srd52:background/soldier/ability-increase"] = ["srd52:trait/soldier-ability-2-1"];
    c.selections["srd52:trait/soldier-ability-2-1/plus-2"] = ["str"];
    c.selections["srd52:trait/soldier-ability-2-1/plus-1"] = ["con"];
    const sheet = deriveSheet(c, bothIndex);
    expect(sheet.held).toContain("srd52:feat/savage-attacker");
    expect(sheet.abilities.str.score).toBe(17);
    expect(sheet.abilities.dex.score).toBe(14);
    expect(sheet.abilities.con.score).toBe(14);
    expect(sheet.abilities.int.score).toBe(12);
  });

  it("gives +1 to each of the three abilities for the other way", () => {
    const c = pilot();
    c.selections["srd52:background/soldier/ability-increase"] = [
      "srd52:trait/soldier-ability-1-1-1",
    ];
    const sheet = deriveSheet(c, bothIndex);
    expect([
      sheet.abilities.str.score,
      sheet.abilities.dex.score,
      sheet.abilities.con.score,
    ]).toEqual([16, 15, 14]);
    expect(sheet.abilities.wis.score).toBe(10);
  });

  it("does not let the +2 and the +1 go to the same ability", () => {
    const c = pilot();
    c.selections["srd52:background/soldier/ability-increase"] = ["srd52:trait/soldier-ability-2-1"];
    c.selections["srd52:trait/soldier-ability-2-1/plus-2"] = ["str"];
    c.selections["srd52:trait/soldier-ability-2-1/plus-1"] = ["str"];
    expect(deriveSheet(c, bothIndex).abilities.str.score).toBe(17);
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
