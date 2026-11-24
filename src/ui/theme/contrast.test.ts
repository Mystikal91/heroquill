import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PALETTES } from "../../app/theme.logic";

/*
 * The contrast of text on the coloured grounds, in every colour set, light and dark, worked out from
 * the style sheets. A new coloured ground with text on it gets a line in PAIRS.
 */

type Rgb = [number, number, number];
type Vars = Record<string, string>;

const read = (path: string) =>
  readFileSync(path, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
const palettes = read("src/ui/theme/palettes.css");
const sheet = read("src/ui/sheet/sheet.css");
const rolls = read("src/ui/play/rolls.css");

/** What the first rule of a style sheet with exactly this selector says. */
function block(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const found = new RegExp(`(?:^|\\}|,)\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
  if (!found?.[1]) throw new Error(`no rule for ${selector}`);
  return found[1];
}

function value(css: string, selector: string, property: string): string {
  const found = new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+);`).exec(block(css, selector));
  if (!found?.[1]) throw new Error(`${selector} has no ${property}`);
  return found[1].trim();
}

/** Splits at the commas that are not inside parentheses. */
function parts(text: string): string[] {
  const out = [""];
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) out.push("");
    else out[out.length - 1] += ch;
  }
  return out.map((part) => part.trim());
}

/** A colour of the style sheets, as drawn over `under`: hex, var() and color-mix in srgb. */
function color(text: string, vars: Vars, under: Rgb): Rgb {
  if (text === "transparent") return under;
  if (text.startsWith("#")) {
    const hex = text.length === 4 ? text.replace(/[0-9a-f]/gi, "$&$&") : text;
    return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
  }
  const inside = /^([\w-]+)\((.*)\)$/s.exec(text);
  if (!inside?.[2]) throw new Error(`not a colour the test can read: ${text}`);
  if (inside[1] === "var") {
    const [name = "", fallback] = parts(inside[2]);
    const known = vars[name] ?? fallback;
    if (!known) throw new Error(`no value for ${name}`);
    return color(known, vars, under);
  }
  const [, first = "", second = ""] = parts(inside[2]);
  const [, base = "", percent] = /^(.*)\s(\d+)%$/s.exec(first) ?? [];
  const share = Number(percent) / 100;
  if (inside[1] !== "color-mix" || !base) throw new Error(`not read: ${text}`);
  const a = color(base, vars, under);
  const b = color(second, vars, under);
  return a.map((channel, i) => channel * share + (b[i] ?? 0) * (1 - share)) as Rgb;
}

const luminance = (rgb: Rgb) =>
  rgb
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * ([0.2126, 0.7152, 0.0722][i] ?? 0), 0);

function contrast(a: Rgb, b: Rgb): number {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** The variables of the page (`--fg`, `--surface`...) for a colour set, light or dark. */
function themeVars(palette: string, scheme: "l" | "d"): Vars {
  const vars: Vars = {};
  for (const [, name = "", text = ""] of block(palettes, `[data-palette="${palette}"]`).matchAll(
    /--([ld]-\w+):\s*([^;]+);/g,
  ))
    if (name.startsWith(`${scheme}-`)) vars[`--${name.slice(2)}`] = text;
  vars["--surface-2"] = vars["--surface2"] ?? "";
  return vars;
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"].map((a) =>
  value(rolls, `[data-ability="${a}"]`, "--ab"),
);
const TINTS = ["combat", "magic", "bag", "features", "species", "story"].map((t) =>
  value(sheet, `.sheet [data-tint="${t}"]`, "--tint"),
);

/** The text, the ground it is on, the variable whose colours it is tried with, and the contrast it needs. */
const PAIRS: {
  text: [selector: string, property: string];
  ground?: [selector: string, property: string];
  with?: "--ab" | "--tint";
  /** 3 for large text and pictures, 4.5 for the rest. */
  needs: number;
}[] = [
  {
    text: [".ability-name", "color"],
    ground: [".ability-tile", "background"],
    with: "--ab",
    needs: 4.5,
  },
  {
    text: [".ability-score", "color"],
    ground: [".ability-tile", "background"],
    with: "--ab",
    needs: 4.5,
  },
  {
    text: [".ability-mod", "color"],
    ground: [".ability-tile", "background"],
    with: "--ab",
    needs: 3,
  },
  {
    text: [":root[data-style] button.explain-trigger.ability-save.proficient", "color"],
    ground: [":root[data-style] button.explain-trigger.ability-save.proficient", "background"],
    with: "--ab",
    needs: 4.5,
  },
  { text: [".skill-ability", "color"], with: "--ab", needs: 4.5 },
  {
    text: [".skill-ability", "color"],
    ground: [".skill-list .proficient", "background"],
    with: "--ab",
    needs: 4.5,
  },
  {
    text: [":root[data-style][data-style] .sheet .panel[data-tint] > h3", "color"],
    ground: [":root[data-style][data-style] .sheet .panel[data-tint] > h3", "background"],
    with: "--tint",
    needs: 4.5,
  },
  {
    text: [".level-badge small", "color"],
    ground: [".level-badge", "background"],
    with: "--tint",
    needs: 4.5,
  },
  {
    text: [".attack-badge", "color"],
    ground: [".attack-badge", "background"],
    with: "--tint",
    needs: 3,
  },
  { text: [".senses dt", "color"], ground: [".senses > div", "background"], needs: 4.5 },
];

describe("text on coloured grounds", () => {
  for (const palette of PALETTES)
    for (const scheme of ["l", "d"] as const)
      it(`can be read: ${palette}, ${scheme === "l" ? "light" : "dark"}`, () => {
        const low: string[] = [];
        const theme = themeVars(palette, scheme);
        const surface = color("var(--surface)", theme, [0, 0, 0]);
        for (const pair of PAIRS)
          for (const tried of pair.with === "--ab" ? ABILITIES : pair.with ? TINTS : [""]) {
            const vars = pair.with ? { ...theme, [pair.with]: tried } : theme;
            const ground = pair.ground
              ? color(value(sheet, ...pair.ground), vars, surface)
              : surface;
            const ratio = contrast(color(value(sheet, ...pair.text), vars, ground), ground);
            if (ratio < pair.needs)
              low.push(`${pair.text[0]} ${tried}: ${ratio.toFixed(2)} of ${pair.needs}`);
          }
        expect(low).toEqual([]);
      });
});
