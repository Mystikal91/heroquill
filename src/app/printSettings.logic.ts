export type Paper = "a4" | "letter";
export type SpellMode = "none" | "details" | "compact";

export interface PrintSettings {
  paper: Paper;
  /** Black and white, no tints: for printing without spending colored ink. */
  lowInk: boolean;
  /** The main character sheet. */
  includeSheet: boolean;
  /** Story and equipment page: personality, appearance, equipment slots, backpack. */
  includeStory: boolean;
  /** Full text of species traits and class features. */
  includeFeatureText: boolean;
  spellMode: SpellMode;
  /** Also list every spell the class could pick, with the chosen ones marked. */
  includeAvailable: boolean;
  /** Spell cards, nine to a page. */
  spellCards: boolean;
  /** Feature cards for class features and species traits. */
  featureCards: boolean;
  /** Every page with nothing written in it, to fill by hand or in the PDF. */
  blank: boolean;
  /** The pages for spells of the blank sheet. */
  blankSpells: boolean;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper: "a4",
  lowInk: false,
  includeSheet: true,
  includeStory: true,
  includeFeatureText: true,
  spellMode: "details",
  includeAvailable: false,
  spellCards: false,
  featureCards: false,
  blank: false,
  blankSpells: true,
};

// `blank` is left out on purpose: a blank sheet chosen once must not come back the next time the
// person prints their character.
const FLAGS = [
  "blankSpells",
  "lowInk",
  "includeSheet",
  "includeStory",
  "includeFeatureText",
  "includeAvailable",
  "spellCards",
  "featureCards",
] as const;

/** Reads saved settings; anything missing or malformed falls back to the defaults. */
export function parsePrintSettings(raw: string | null): PrintSettings {
  let saved: Partial<Record<keyof PrintSettings, unknown>>;
  try {
    saved = JSON.parse(raw ?? "{}") ?? {};
  } catch {
    return DEFAULT_PRINT_SETTINGS;
  }
  const settings: PrintSettings = {
    ...DEFAULT_PRINT_SETTINGS,
    paper: saved.paper === "letter" ? "letter" : "a4",
    spellMode:
      saved.spellMode === "none" || saved.spellMode === "compact" || saved.spellMode === "details"
        ? saved.spellMode
        : DEFAULT_PRINT_SETTINGS.spellMode,
  };
  for (const flag of FLAGS) {
    const value = saved[flag];
    if (typeof value === "boolean") settings[flag] = value;
  }
  return settings;
}

/** True when the current choices would print no pages at all. */
export function printsNothing(s: PrintSettings, isCaster: boolean): boolean {
  // A blank sheet has no cards and no list of spells to pick from: its spell pages are their own option.
  if (s.blank) return !(s.includeSheet || s.includeStory || s.includeFeatureText || s.blankSpells);
  return !(
    s.includeSheet ||
    s.includeStory ||
    s.includeFeatureText ||
    s.spellMode !== "none" ||
    (s.includeAvailable && isCaster) ||
    s.spellCards ||
    s.featureCards
  );
}
