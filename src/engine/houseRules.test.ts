import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { type Character, createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { exhaustionMode, setExhaustion } from "./exhaustion";
import {
  HOUSE_FEAT_SOURCE,
  type HouseRules,
  cleanHouseRules,
  crunchyDice,
  exhaustionRuleset,
  isPotion,
  quickRestHealing,
} from "./houseRules";
import { applyLevelUp, levelUpOptions, previewLevelUp } from "./levelUp";

function fighter(level: number): Character {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/dwarf";
  c.classes = [{ classId: "srd51:class/fighter", level }];
  c.abilityBase = { str: 14, dex: 12, con: 10, int: 8, wis: 10, cha: 10 };
  return c;
}

describe("crunchy critical hits", () => {
  it("adds the highest of the dice to one roll of them", () => {
    expect(crunchyDice("2d6+3")).toBe("2d6+15");
    expect(crunchyDice("1d8+2d6")).toBe("1d8+2d6+20");
    expect(crunchyDice("d4")).toBe("1d4+4");
    expect(crunchyDice("8d6")).toBe("8d6+48");
  });

  it("reads a monster's damage with spaces, and leaves a flat number alone", () => {
    expect(crunchyDice("2d6 + 3")).toBe("2d6+15");
    expect(crunchyDice("5")).toBe("5");
  });
});

describe("quick rests", () => {
  it("give back half the maximum, rounded down", () => {
    expect(quickRestHealing(42)).toBe(21);
    expect(quickRestHealing(41)).toBe(20);
    expect(quickRestHealing(1)).toBe(0);
  });
});

describe("the highest hit points", () => {
  it("counts every level at the highest of the die", () => {
    // A fighter (d10) with Constitution 10 and the dwarf's toughness (+1 a level).
    const book = deriveSheet(fighter(3), srd51Index).hitPoints.max;
    const house = deriveSheet(fighter(3), srd51Index, { maxHitPoints: true }).hitPoints.max;
    expect(house - book).toBe(2 * (10 - 6));
  });

  it("ignores the rolls kept for the levels", () => {
    const c = fighter(2);
    c.classes[0] = { classId: "srd51:class/fighter", level: 2, hpRolls: [10, 1] };
    const low = deriveSheet(c, srd51Index).hitPoints.max;
    expect(deriveSheet(c, srd51Index, { maxHitPoints: true }).hitPoints.max).toBe(low + 9);
  });

  it("is what the level up shows", () => {
    const c = fighter(1);
    const rules: HouseRules = { maxHitPoints: true };
    const summary = previewLevelUp(
      c,
      "srd51:class/fighter",
      { type: "average" },
      srd51Index,
      rules,
    );
    expect(summary.hitPoints[1] - summary.hitPoints[0]).toBe(10 + 1);
  });
});

describe("free multiclassing", () => {
  it("drops the minimums from the warnings and from the classes that can be taken", () => {
    const c = fighter(1);
    c.classes.push({ classId: "srd51:class/wizard", level: 1 });
    const codes = (rules?: HouseRules) =>
      deriveSheet(c, srd51Index, rules).warnings.map((w) => w.code);
    expect(codes()).toContain("multiclassPrerequisite");
    expect(codes({ freeMulticlass: true })).not.toContain("multiclassPrerequisite");

    const one = fighter(1);
    const sheet = deriveSheet(one, srd51Index);
    const wizard = (rules?: HouseRules) =>
      levelUpOptions(one, srd51Index, sheet, rules).find((o) => o.classId === "srd51:class/wizard");
    expect(wizard()?.unmet.length).toBeGreaterThan(0);
    expect(wizard({ freeMulticlass: true })?.unmet).toEqual([]);
  });
});

describe("the 2024 exhaustion for a 2014 character", () => {
  it("lowers the d20 tests and the speed instead of halving it", () => {
    const c = fighter(5);
    const plain = deriveSheet(c, srd51Index);
    c.play = setExhaustion(c.play, 2);
    const book = deriveSheet(c, srd51Index);
    const house = deriveSheet(c, srd51Index, { modernExhaustion: true });
    expect(book.initiative).toBe(plain.initiative);
    expect(book.speed).toBe(Math.floor((plain.speed ?? 0) / 2));
    expect(house.initiative).toBe(plain.initiative - 4);
    expect(house.speed).toBe((plain.speed ?? 0) - 10);
    // And no disadvantage on the checks, as the 2014 first level gives.
    const ruleset = exhaustionRuleset("srd51", { modernExhaustion: true });
    expect(exhaustionMode(ruleset, 2, "check", "normal")).toBe("normal");
    expect(exhaustionMode(exhaustionRuleset("srd51", {}), 2, "check", "normal")).toBe(
      "disadvantage",
    );
  });
});

describe("a feat at the 1st level", () => {
  // The SRD 5.1 data has no feats: an imported one stands in.
  const tough: Entry = {
    id: "test:feat/tough",
    kind: "feat",
    effects: [{ type: "abilityBonus", ability: "con", value: 1 }],
    data: {},
  };
  const index = new Map([...srd51Index, [tough.id, tough]]);

  it("offers a feat once there is a class, and applies the one picked", () => {
    const c = fighter(1);
    const rules: HouseRules = { levelOneFeat: true };
    const choice = deriveSheet(c, index, rules).choices.find((x) => x.source === HOUSE_FEAT_SOURCE);
    expect(choice?.grants).toBe("feat");
    expect(choice?.options).toEqual([tough.id]);
    expect(deriveSheet(createCharacter("srd51"), index, rules).choices).toEqual([]);
    // The 2014 SRD alone has no feat: no choice that could never be made.
    expect(
      deriveSheet(c, srd51Index, rules).choices.some((x) => x.source === HOUSE_FEAT_SOURCE),
    ).toBe(false);

    c.selections[`${HOUSE_FEAT_SOURCE}/feat`] = [tough.id];
    const sheet = deriveSheet(c, index, rules);
    expect(sheet.feats).toEqual([tough.id]);
    expect(sheet.abilities.con.score).toBe(deriveSheet(c, index).abilities.con.score + 1);
    // With the rule off the pick is kept aside, not applied.
    expect(deriveSheet(c, index).feats).toEqual([]);
    expect(deriveSheet(c, index).warnings).toEqual([]);
  });

  it("does not take the place of an ability score improvement", () => {
    const c = fighter(4);
    c.selections[`${HOUSE_FEAT_SOURCE}/feat`] = [tough.id];
    const sheet = deriveSheet(c, index, { levelOneFeat: true });
    expect(sheet.asi.available - sheet.asi.used).toBe(1);
  });
});

describe("the setting", () => {
  it("keeps only the rules it knows that are on", () => {
    expect(cleanHouseRules({ quickRests: true, crunchyCrits: false, other: true })).toEqual({
      quickRests: true,
    });
    expect(cleanHouseRules("nonsense")).toEqual({});
    expect(cleanHouseRules(null)).toEqual({});
  });

  it("knows a potion by its healing or by its id", () => {
    expect(isPotion("srd51:item/potion-of-flying", false)).toBe(true);
    expect(isPotion("imp:item/elixir", true)).toBe(true);
    expect(isPotion("srd51:item/rope-hempen-50-feet", false)).toBe(false);
  });

  it("does not change a level up when no rule is on", () => {
    const c = fighter(1);
    const next = applyLevelUp(c, "srd51:class/fighter", { type: "average" }, srd51Index);
    expect(deriveSheet(next, srd51Index, {}).hitPoints.max).toBe(
      deriveSheet(next, srd51Index).hitPoints.max,
    );
  });
});
