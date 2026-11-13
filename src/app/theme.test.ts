import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, PALETTES, parseTheme, themeAttributes } from "./theme.logic";

describe("parseTheme", () => {
  it("falls back to the defaults for missing or malformed data", () => {
    expect(parseTheme(null)).toEqual(DEFAULT_THEME);
    expect(parseTheme("not json")).toEqual(DEFAULT_THEME);
    expect(parseTheme("null")).toEqual(DEFAULT_THEME);
    expect(parseTheme(JSON.stringify({ palette: "neon", scheme: 3 }))).toEqual(DEFAULT_THEME);
  });

  it("starts dark, and keeps a saved choice to follow the device", () => {
    expect(parseTheme(null)).toEqual({ palette: "notte", scheme: "dark" });
    expect(parseTheme(JSON.stringify({ palette: "notte", scheme: "auto" })).scheme).toBe("auto");
  });

  it("keeps valid saved values", () => {
    expect(parseTheme(JSON.stringify({ palette: "foresta", scheme: "dark" }))).toEqual({
      palette: "foresta",
      scheme: "dark",
    });
    expect(parseTheme(JSON.stringify({ palette: "arcano", scheme: "light" }))).toEqual({
      palette: "arcano",
      scheme: "light",
    });
  });

  it("keeps the old look for a choice saved before the colour sets", () => {
    expect(parseTheme(JSON.stringify({ style: "fantasy", scheme: "dark" }))).toEqual({
      palette: "classico",
      scheme: "dark",
    });
    // The Modern style is gone: whoever had it gets the Fantasy look they would know best.
    expect(parseTheme(JSON.stringify({ style: "modern", scheme: "auto" }))).toEqual({
      palette: "classico",
      scheme: "auto",
    });
  });
});

describe("themeAttributes", () => {
  it("leaves the scheme unset for auto so CSS follows the device", () => {
    expect(themeAttributes({ palette: "notte", scheme: "auto" })).toEqual({ palette: "notte" });
  });

  it("sets an explicit scheme", () => {
    expect(themeAttributes({ palette: "rame", scheme: "dark" })).toEqual({
      palette: "rame",
      scheme: "dark",
    });
  });
});

describe("the colour sets", () => {
  const css = readFileSync("src/ui/theme/palettes.css", "utf8");
  const page = readFileSync("index.html", "utf8");

  it("are all defined in the style sheet", () => {
    for (const name of PALETTES) expect(css).toContain(`[data-palette="${name}"]`);
  });

  it("are all known to the first paint script, which cannot import them", () => {
    for (const name of PALETTES) expect(page).toContain(`"${name}"`);
  });
});
