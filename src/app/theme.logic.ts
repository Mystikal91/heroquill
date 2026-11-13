/**
 * The colour sets the person can choose from. Their colours are in `ui/theme/palettes.css`, each
 * with a light and a dark look. The first is the one a new person starts with.
 */
export const PALETTES = [
  "notte",
  "classico",
  "bordeaux",
  "foresta",
  "arcano",
  "ghiaccio",
  "rame",
  "ossidiana",
] as const;
export type PaletteName = (typeof PALETTES)[number];
/** `auto` follows the device's light or dark setting. */
export type Scheme = "auto" | "light" | "dark";

export interface ThemeSettings {
  palette: PaletteName;
  scheme: Scheme;
}

/** A new person starts with Night and gold in its dark look, the one the app is drawn for. */
export const DEFAULT_THEME: ThemeSettings = { palette: "notte", scheme: "dark" };

/** The look the app had before there were colour sets: whoever saved a choice then keeps it. */
export const CLASSIC_PALETTE: PaletteName = "classico";

export const THEME_STORAGE_KEY = "theme";

const isPalette = (value: unknown): value is PaletteName => PALETTES.includes(value as PaletteName);

/** Reads saved settings; anything missing or malformed falls back to the defaults. */
export function parseTheme(raw: string | null): ThemeSettings {
  try {
    const saved = JSON.parse(raw ?? "{}") as Record<string, unknown> | null;
    if (!saved || typeof saved !== "object") return DEFAULT_THEME;
    // A saved "auto" is kept: it cannot be told from a choice (the app saved it for everyone
    // while it was the default), so only who has nothing saved gets the dark look.
    const scheme =
      saved.scheme === "light" || saved.scheme === "dark" || saved.scheme === "auto"
        ? saved.scheme
        : DEFAULT_THEME.scheme;
    // A choice saved before the colour sets (it has a style, no set) keeps the look it had.
    const before = !("palette" in saved) && ("style" in saved || "scheme" in saved);
    return {
      palette: isPalette(saved.palette)
        ? saved.palette
        : before
          ? CLASSIC_PALETTE
          : DEFAULT_THEME.palette,
      scheme,
    };
  } catch {
    return DEFAULT_THEME;
  }
}

/** The `data-` attributes the stylesheet keys on. `auto` sets no scheme: CSS follows the device. */
export function themeAttributes(theme: ThemeSettings): {
  palette: PaletteName;
  scheme?: "light" | "dark";
} {
  return theme.scheme === "auto"
    ? { palette: theme.palette }
    : { palette: theme.palette, scheme: theme.scheme };
}
