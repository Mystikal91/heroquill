import { describe, expect, it } from "vitest";
import { DEFAULT_PRINT_SETTINGS, parsePrintSettings, printsNothing } from "./printSettings.logic";

describe("parsePrintSettings", () => {
  it("falls back to the defaults for missing or malformed data", () => {
    expect(parsePrintSettings(null)).toEqual(DEFAULT_PRINT_SETTINGS);
    expect(parsePrintSettings("{broken")).toEqual(DEFAULT_PRINT_SETTINGS);
    expect(parsePrintSettings("null")).toEqual(DEFAULT_PRINT_SETTINGS);
    expect(
      parsePrintSettings(JSON.stringify({ paper: "tabloid", spellMode: 7, lowInk: "yes" })),
    ).toEqual(DEFAULT_PRINT_SETTINGS);
  });

  it("keeps valid saved values, including options added later", () => {
    const saved = {
      paper: "letter",
      lowInk: true,
      spellMode: "compact",
      spellCards: true,
      includeStory: false,
    };
    expect(parsePrintSettings(JSON.stringify(saved))).toEqual({
      ...DEFAULT_PRINT_SETTINGS,
      ...saved,
    });
  });
});

describe("printsNothing", () => {
  const none = {
    ...DEFAULT_PRINT_SETTINGS,
    includeSheet: false,
    includeStory: false,
    includeFeatureText: false,
    spellMode: "none" as const,
  };

  it("is true only when every page type is off", () => {
    expect(printsNothing(none, true)).toBe(true);
    expect(printsNothing({ ...none, spellCards: true }, true)).toBe(false);
    expect(printsNothing({ ...none, featureCards: true }, false)).toBe(false);
  });

  it("counts only the pages a blank sheet has", () => {
    const blank = { ...none, blank: true, blankSpells: false };
    expect(printsNothing({ ...blank, spellCards: true }, true)).toBe(true);
    expect(printsNothing({ ...blank, blankSpells: true }, false)).toBe(false);
  });

  it("never remembers a blank sheet", () => {
    expect(parsePrintSettings(JSON.stringify({ blank: true })).blank).toBe(false);
  });

  it("ignores the available-spells option for characters who cannot cast", () => {
    expect(printsNothing({ ...none, includeAvailable: true }, false)).toBe(true);
    expect(printsNothing({ ...none, includeAvailable: true }, true)).toBe(false);
  });
});
