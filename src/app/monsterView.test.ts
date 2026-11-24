// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import {
  challengeText,
  modifier,
  scoreText,
  sensesText,
  speedText,
  usageText,
} from "./monsterView";

describe("reading a stat block", () => {
  it("works out modifiers and writes scores the way a stat block does", () => {
    expect([modifier(1), modifier(9), modifier(10), modifier(17), modifier(30)]).toEqual([
      -5, -1, 0, 3, 10,
    ]);
    expect(scoreText(16)).toBe("16 (+3)");
    expect(scoreText(8)).toBe("8 (-1)");
  });

  it("writes the fractions of a challenge rating", () => {
    expect([0, 0.125, 0.25, 0.5, 1, 30].map(challengeText)).toEqual([
      "0",
      "1/8",
      "1/4",
      "1/2",
      "1",
      "30",
    ]);
  });

  it("lists speeds with the walking speed first and unnamed, hover with flying", () => {
    expect(speedText({ walk: 10, fly: 80 })).toBe("10 ft., fly 80 ft.");
    expect(speedText({ swim: 40, walk: 20, fly: 30, hover: true })).toBe(
      "20 ft., fly 30 ft. (hover), swim 40 ft.",
    );
  });

  it("lists senses with the passive Perception last", () => {
    expect(sensesText({ darkvision: 60 }, [], 12)).toBe("darkvision 60 ft., passive Perception 12");
    // A file from outside may write a sense in capitals or invent one: it must not break the page.
    expect(sensesText({ Darkvision: 30 })).toBe("darkvision 30 ft.");
    expect(sensesText({ "Echo sense": 10 })).toBe("Echo sense 10 ft.");
    expect(sensesText({ blindsight: 30 }, ["blindsight"])).toBe(
      "blindsight 30 ft. (blind beyond this radius)",
    );
  });

  it("says how often an action can be used", () => {
    expect(usageText({ type: "per day", times: 3 })).toBe("3/Day");
    expect(usageText({ type: "recharge on roll", minValue: 5 })).toBe("Recharge 5-6");
    expect(usageText({ type: "recharge after rest", restTypes: ["short", "long"] })).toBe(
      "Recharges after a short or long rest",
    );
    expect(usageText(undefined)).toBeUndefined();
  });
});
