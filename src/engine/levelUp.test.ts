import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { MAX_LEVEL, applyLevelUp, levelUpOptions, openTasks, previewLevelUp } from "./levelUp";
import { subclassLevel } from "./subclass";

function hero(classes: { id: string; level: number; subclass?: string }[], scores = {}) {
  const c = createCharacter("srd51");
  c.classes = classes.map((x) => ({
    classId: `srd51:class/${x.id}`,
    level: x.level,
    ...(x.subclass && { subclassId: `srd51:subclass/${x.subclass}` }),
  }));
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14, ...scores };
  return c;
}

describe("applyLevelUp", () => {
  it("raises the level and records the rolled hit points", () => {
    const next = applyLevelUp(
      hero([{ id: "wizard", level: 3 }]),
      "srd51:class/wizard",
      { type: "roll", value: 5 },
      index,
    );
    const wizard = next.classes[0];
    expect(wizard?.level).toBe(4);
    expect(wizard?.hpRolls?.[3]).toBe(5);
    // Earlier levels without a roll stay at the average of a d6.
    expect(wizard?.hpRolls?.slice(0, 3)).toEqual([4, 4, 4]);
  });

  it("uses the average when no roll is made", () => {
    const base = hero([{ id: "fighter", level: 1 }]);
    const before = deriveSheet(base, index).hitPoints.max;
    const next = applyLevelUp(base, "srd51:class/fighter", { type: "average" }, index);
    // d10 average is 6, plus the Constitution modifier of 2.
    expect(deriveSheet(next, index).hitPoints.max - before).toBe(8);
  });

  it("starts a new class at level 1 and leaves the original character untouched", () => {
    const base = hero([{ id: "fighter", level: 2 }]);
    const next = applyLevelUp(base, "srd51:class/wizard", { type: "average" }, index);
    expect(next.classes.map((c) => [c.classId, c.level])).toEqual([
      ["srd51:class/fighter", 2],
      ["srd51:class/wizard", 1],
    ]);
    expect(base.classes).toHaveLength(1);
  });
});

describe("levelUpOptions", () => {
  it("offers the current classes and every other class", () => {
    const c = hero([{ id: "fighter", level: 3 }]);
    const options = levelUpOptions(c, index, deriveSheet(c, index));
    const current = options.filter((o) => !o.isNew);
    expect(current).toEqual([
      { classId: "srd51:class/fighter", currentLevel: 3, newLevel: 4, isNew: false, unmet: [] },
    ]);
    expect(options.filter((o) => o.isNew)).toHaveLength(11);
  });

  it("lists the minimums that a new class is missing", () => {
    const c = hero([{ id: "fighter", level: 3 }], { int: 8, cha: 8 });
    const options = levelUpOptions(c, index, deriveSheet(c, index));
    const wizard = options.find((o) => o.classId === "srd51:class/wizard");
    expect(wizard?.unmet).toEqual([{ classId: "srd51:class/wizard", ability: "int", minimum: 13 }]);
    const paladin = options.find((o) => o.classId === "srd51:class/paladin");
    // Strength 14 is enough, Charisma 8 is not.
    expect(paladin?.unmet.map((u) => u.ability)).toEqual(["cha"]);
  });

  it("also asks the current classes for their minimums", () => {
    const c = hero([{ id: "wizard", level: 3 }], { int: 12 });
    const options = levelUpOptions(c, index, deriveSheet(c, index));
    const fighter = options.find((o) => o.classId === "srd51:class/fighter");
    expect(fighter?.unmet.some((u) => u.classId === "srd51:class/wizard")).toBe(true);
  });

  it("offers nothing at level 20", () => {
    const c = hero([{ id: "fighter", level: MAX_LEVEL }]);
    expect(levelUpOptions(c, index, deriveSheet(c, index))).toEqual([]);
  });
});

describe("previewLevelUp", () => {
  it("shows what a wizard gains from level 4 to 5", () => {
    const c = hero([{ id: "wizard", level: 4 }]);
    const summary = previewLevelUp(c, "srd51:class/wizard", { type: "average" }, index);
    expect(summary.classLevel).toBe(5);
    expect(summary.totalLevel).toBe(5);
    expect(summary.proficiencyBonus).toEqual([2, 3]);
    expect(summary.hitPoints[1]).toBeGreaterThan(summary.hitPoints[0]);
    expect(summary.slots[0]).toEqual([4, 3, 0, 0, 0, 0, 0, 0, 0]);
    expect(summary.slots[1]).toEqual([4, 3, 2, 0, 0, 0, 0, 0, 0]);
    expect(summary.casters[0]?.maxSpellLevel).toEqual([2, 3]);
    expect(summary.casters[0]?.spells[1]).toBeGreaterThan(summary.casters[0]?.spells[0] ?? 0);
  });

  it("notices an ability score improvement and new features", () => {
    const c = hero([{ id: "fighter", level: 3 }]);
    const summary = previewLevelUp(c, "srd51:class/fighter", { type: "average" }, index);
    expect(summary.newAsi).toBe(true);
    const names = summary.newFeatures.join(" ");
    expect(names).toContain("ability-score-improvement");
  });

  it("shows a new class's first level", () => {
    const c = hero([{ id: "fighter", level: 4 }]);
    const summary = previewLevelUp(c, "srd51:class/wizard", { type: "average" }, index);
    expect(summary.classLevel).toBe(1);
    expect(summary.totalLevel).toBe(5);
    expect(summary.casters.map((x) => x.classId)).toEqual(["srd51:class/wizard"]);
  });
});

describe("openTasks", () => {
  it("asks for a subclass once the class is at the level that gives one", () => {
    const c = hero([{ id: "wizard", level: 2 }]);
    expect(openTasks(c, deriveSheet(c, index), index)).toContainEqual({
      kind: "subclass",
      classId: "srd51:class/wizard",
    });
    const chosen = hero([{ id: "wizard", level: 2, subclass: "evocation" }]);
    const kinds = openTasks(chosen, deriveSheet(chosen, index), index).map((t) => t.kind);
    expect(kinds).not.toContain("subclass");
  });

  it("does not ask for a subclass too early", () => {
    const c = hero([{ id: "fighter", level: 2 }]);
    expect(openTasks(c, deriveSheet(c, index), index).map((t) => t.kind)).not.toContain("subclass");
    expect(subclassLevel("srd51:class/fighter", index)).toBe(3);
  });

  it("lists improvements and spells still to pick", () => {
    const c = hero([{ id: "wizard", level: 4 }]);
    const tasks = openTasks(c, deriveSheet(c, index), index);
    expect(tasks).toContainEqual({ kind: "asi", left: 1 });
    expect(tasks.some((t) => t.kind === "spells")).toBe(true);
  });
});
