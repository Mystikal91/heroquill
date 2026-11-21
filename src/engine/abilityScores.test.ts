import { describe, expect, it } from "vitest";
import { ABILITIES } from "../data/schema";
import {
  POINT_BUY_BUDGET,
  STANDARD_ARRAY,
  applyAbilityMethod,
  assignValue,
  assignableValues,
  canLower,
  canRaise,
  defaultPointCost,
  pointBuyProblem,
  pointBuyRemaining,
  pointBuySpent,
  restartPointBuy,
  rollAbilityScores,
  rollOneScore,
  standardPointBuy,
} from "./abilityScores";
import { createCharacter } from "./character";

/** A deterministic "random" source cycling through the given values in [0, 1). */
const cycle = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
};

describe("point buy", () => {
  it("starts at 8 everywhere with the full budget", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "pointbuy");
    expect(Object.values(c.abilityBase)).toEqual([8, 8, 8, 8, 8, 8]);
    expect(pointBuyRemaining(c.abilityBase)).toBe(POINT_BUY_BUDGET);
  });

  it("prices scores per the SRD table and stops at 15 and at the budget", () => {
    const base = { str: 15, dex: 15, con: 15, int: 8, wis: 8, cha: 8 };
    expect(pointBuySpent(base)).toBe(27);
    expect(canRaise(base, "int")).toBe(false);
    expect(canRaise({ ...base, con: 13 }, "con")).toBe(true);
    expect(canRaise({ ...base, str: 14, con: 8 }, "str")).toBe(true);
    expect(canRaise(base, "str")).toBe(false);
    expect(canLower(base, "int")).toBe(false);
    expect(canLower(base, "str")).toBe(true);
  });

  it("treats scores outside 8-15 as unaffordable", () => {
    expect(pointBuySpent({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

describe("point buy with custom rules", () => {
  const rules = () => {
    const r = standardPointBuy();
    r.budget = 40;
    r.min = 6;
    r.max = 18;
    for (let n = 6; n <= 18; n++) r.costs[n] = r.costs[n] ?? defaultPointCost(n);
    return r;
  };

  it("the book's rules have the table of the SRD", () => {
    const r = standardPointBuy();
    expect(r.costs).toEqual({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 });
    expect(pointBuyProblem(r)).toBeUndefined();
  });

  it("allows scores beyond 15 when the rules do, and stops at their maximum and budget", () => {
    const r = rules();
    expect(r.costs[16]).toBe(11);
    expect(canRaise({ str: 15, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, "str", r)).toBe(true);
    expect(canRaise({ str: 18, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, "str", r)).toBe(false);
    expect(canLower({ str: 6, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, "str", r)).toBe(false);
    expect(pointBuySpent({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, r)).toBe(11);
    expect(pointBuyRemaining({ str: 16, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, r)).toBe(29);
  });

  it("starting again puts every score at the minimum, and the book's rules bring 8 back", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "pointbuy");
    c.abilityBase.str = 14;
    restartPointBuy(c, rules());
    expect(Object.values(c.abilityBase)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(pointBuyRemaining(c.abilityBase, c.pointBuyRules)).toBe(40 - 6 * -2);
    restartPointBuy(c, undefined);
    expect(Object.values(c.abilityBase)).toEqual([8, 8, 8, 8, 8, 8]);
    expect(c.pointBuyRules).toBeUndefined();
  });

  it("refuses rules that cannot work", () => {
    const r = standardPointBuy();
    expect(pointBuyProblem({ ...r, min: 16 })).toBe("range");
    expect(pointBuyProblem({ ...r, max: 31 })).toBe("range");
    expect(pointBuyProblem({ ...r, costs: { ...r.costs, 10: 1.5 } })).toBe("range");
    expect(pointBuyProblem({ ...r, costs: { ...r.costs, 8: 10 }, budget: 20 })).toBe("budget");
  });
});

describe("standard array and rolls", () => {
  it("assigns the standard array in ability order", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "standard");
    expect(ABILITIES.map((a) => c.abilityBase[a])).toEqual(STANDARD_ARRAY);
    expect(assignableValues(c)).toEqual(STANDARD_ARRAY);
  });

  it("swaps with the ability that holds the chosen value", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "standard");
    const next = assignValue(c.abilityBase, "str", 8);
    expect(next).toMatchObject({ str: 8, cha: 15 });
    expect(Object.values(next).sort()).toEqual([...STANDARD_ARRAY].sort());
  });

  it("rolls 4d6 dropping the lowest", () => {
    // Dice 6, 5, 4, 1 -> 15.
    expect(rollOneScore(cycle([0.99, 0.8, 0.5, 0]))).toBe(15);
    // All ones -> 3, the minimum.
    expect(rollOneScore(() => 0)).toBe(3);
  });

  it("keeps the rolled values and assigns them highest first", () => {
    expect(rollAbilityScores(() => 0.5)).toHaveLength(6);
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "roll", cycle([0.99, 0.99, 0.99, 0.99, 0, 0, 0, 0]));
    expect(c.abilityRolls).toEqual([18, 18, 18, 3, 3, 3].slice(0, 6).sort((a, b) => b - a));
    expect(ABILITIES.map((a) => c.abilityBase[a])).toEqual(c.abilityRolls);
  });

  it("clears rolls and keeps scores when switching to manual", () => {
    const c = createCharacter("srd51");
    applyAbilityMethod(c, "roll");
    const scores = { ...c.abilityBase };
    applyAbilityMethod(c, "manual");
    expect(c.abilityRolls).toBeUndefined();
    expect(c.abilityBase).toEqual(scores);
  });
});
