import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

type Class = { classId: string; level: number; subclassId?: string };

function sheetOf(ruleset: "srd51" | "srd52", ...classes: Class[]) {
  const c = createCharacter(ruleset);
  c.classes = classes;
  return deriveSheet(c, bothIndex);
}
const old = (cls: string, level: number, subclassId?: string) =>
  sheetOf("srd51", { classId: `srd51:class/${cls}`, level, ...(subclassId && { subclassId }) });

describe("attacks per Attack action", () => {
  it("is 1 for a character without an Extra Attack", () => {
    expect(sheetOf("srd51").attacksPerAction).toBe(1);
    expect(old("wizard", 20).attacksPerAction).toBe(1);
    expect(old("fighter", 4).attacksPerAction).toBe(1);
  });

  it("goes 2, 3, 4 for a 2014 Fighter, at the levels 5, 11 and 20", () => {
    expect([5, 10].map((l) => old("fighter", l).attacksPerAction)).toEqual([2, 2]);
    expect([11, 19].map((l) => old("fighter", l).attacksPerAction)).toEqual([3, 3]);
    expect(old("fighter", 20).attacksPerAction).toBe(4);
  });

  it("is 2 at the 5th level for the other classes that have an Extra Attack", () => {
    for (const cls of ["barbarian", "monk", "paladin", "ranger"]) {
      expect(old(cls, 4).attacksPerAction, `${cls} 4`).toBe(1);
      expect(old(cls, 5).attacksPerAction, `${cls} 5`).toBe(2);
      expect(old(cls, 20).attacksPerAction, `${cls} 20`).toBe(2);
    }
  });

  it("does not add up between classes: the most counts", () => {
    const sheet = sheetOf(
      "srd51",
      { classId: "srd51:class/fighter", level: 11 },
      { classId: "srd51:class/ranger", level: 5 },
    );
    expect(sheet.attacksPerAction).toBe(3);
    const two = sheetOf(
      "srd51",
      { classId: "srd51:class/fighter", level: 5 },
      { classId: "srd51:class/paladin", level: 5 },
    );
    expect(two.attacksPerAction).toBe(2);
  });

  it("is the same for a 2024 Fighter, whose steps are three features that replace each other", () => {
    const at = (level: number) =>
      sheetOf("srd52", { classId: "srd52:class/fighter", level }).attacksPerAction;
    expect([4, 5, 10, 11, 19, 20].map(at)).toEqual([1, 2, 2, 3, 3, 4]);
    const high = sheetOf("srd52", { classId: "srd52:class/fighter", level: 20 });
    expect(high.hiddenFeatures).toEqual(
      expect.arrayContaining([
        "srd52:feature/fighter-extra-attack",
        "srd52:feature/fighter-two-extra-attacks",
      ]),
    );
    expect(high.hiddenFeatures).not.toContain("srd52:feature/fighter-three-extra-attacks");
  });
});

describe("what a feature heals when it is used", () => {
  it("is 1d10 plus the Fighter level for Second Wind, in both editions", () => {
    expect(old("fighter", 5).selfHeals["srd51:feature/second-wind"]).toEqual({
      dice: "1d10",
      bonus: 5,
    });
    const newer = sheetOf("srd52", { classId: "srd52:class/fighter", level: 9 });
    expect(newer.selfHeals["srd52:feature/fighter-second-wind"]).toEqual({
      dice: "1d10",
      bonus: 9,
    });
  });

  it("is three times the monk level for Wholeness of Body, with no dice", () => {
    const sheet = old("monk", 6, "srd51:subclass/open-hand");
    expect(sheet.selfHeals["srd51:feature/wholeness-of-body"]).toEqual({ bonus: 18 });
  });

  it("is nothing for a character that has no such feature", () => {
    expect(old("wizard", 5).selfHeals).toEqual({});
  });
});
