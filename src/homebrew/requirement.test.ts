import { describe, expect, it } from "vitest";
import { clausesFromText, sameMeaning, textFromClauses } from "./requirement";

describe("requirements as a list", () => {
  it("reads a plain word", () => {
    expect(clausesFromText("A")).toEqual([[{ word: "A", not: false }]]);
  });

  it("reads and, or and not", () => {
    expect(clausesFromText("A,!B||C")).toEqual([
      [
        { word: "A", not: false },
        { word: "B", not: true },
      ],
      [{ word: "C", not: false }],
    ]);
  });

  it("pushes a negated group down to its words", () => {
    expect(clausesFromText("!(A||B)")).toEqual([
      [
        { word: "A", not: true },
        { word: "B", not: true },
      ],
    ]);
  });

  it("keeps the meaning when it writes the text again", () => {
    for (const text of [
      "A",
      "A,B",
      "A||B",
      "!(A||B)",
      "!(A,B)",
      "A,(B||C)",
      "ID_X,!ID_Y",
      "(A||B),(C||D)",
    ]) {
      const again = textFromClauses(clausesFromText(text) ?? []);
      expect(sameMeaning(text, again, ["A", "B", "C", "D", "ID_X", "ID_Y"]), text).toBe(true);
    }
  });

  it("keeps a condition on the sheet as one word", () => {
    expect(clausesFromText("[str:13],A")).toEqual([
      [
        { word: "[str:13]", not: false },
        { word: "A", not: false },
      ],
    ]);
  });

  it("asks for nothing when it is empty, and gives up on what is too tangled", () => {
    expect(clausesFromText("")).toEqual([]);
    const tangled = Array.from({ length: 5 }, (_, i) => `(a${i}||b${i}||c${i})`).join(",");
    expect(clausesFromText(tangled)).toBeUndefined();
  });
});
