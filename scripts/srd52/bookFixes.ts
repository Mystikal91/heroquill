/**
 * Where `5e-database` (2024) disagrees with the SRD 5.2.1 text, other than prices, weights and weapon
 * damage (those are in `equipmentFixes.ts`). Each entry was found by comparing the data with the PDF
 * (`SRD_CC_v5.2.1.pdf`) and read again by hand. They stay until the database is corrected: the build
 * warns when a fix is no longer needed, so the tables shrink by themselves.
 */

/** The skills a class chooses from, when the database lists fewer than the book (the Fighter lacks Persuasion). */
export const CLASS_SKILLS: Record<string, string[]> = {
  fighter: [
    "acrobatics",
    "animal-handling",
    "athletics",
    "history",
    "insight",
    "intimidation",
    "persuasion",
    "perception",
    "survival",
  ],
};

/** A feat's name as the book writes it. */
export const FEAT_NAMES: Record<string, string> = {
  "two-weapon-fighting": "Two-Weapon Fighting",
};

/**
 * A sentence of a feat that the database has wrong: the Epic Boons that raise only some abilities have the
 * generic "one ability score of your choice" in the source.
 */
export const FEAT_TEXT: Record<string, { from: string; to: string }> = {
  "boon-of-irresistible-offense": {
    from: "Increase one ability score of your choice by 1",
    to: "Increase your Strength or Dexterity score by 1",
  },
  "boon-of-spell-recall": {
    from: "Increase one ability score of your choice by 1",
    to: "Increase your Intelligence, Wisdom, or Charisma score by 1",
  },
};

/** An item's name as the book writes it (the database lowercases a word or drops the hyphen). */
export const ITEM_NAMES: Record<string, string> = {
  "half-plate-armor": "Half Plate Armor",
  "ball-bearings": "Ball Bearings",
  "block-and-tackle": "Block and Tackle",
  "spell-scroll-cantrip": "Spell Scroll (Cantrip)",
  "spell-scroll-level-1": "Spell Scroll (Level 1)",
};

/** The text of an item the database gives none (the Entertainer's Pack has no description at all). */
export const ITEM_DESCRIPTIONS: Record<string, string> = {
  "entertainers-pack":
    "An Entertainer’s Pack contains the following items: Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, and Waterskin.",
};

/** A sentence of an item's text that the database has wrong. */
export const ITEM_TEXT: Record<string, { from: string; to: string }> = {
  "scholars-pack": { from: "Backpack, Blanket, Book,", to: "Backpack, Book," },
};

/**
 * What an equipment pack holds, where the database differs from the book: it lists a "flask" next to the
 * flasks of Oil (the book's "2 flasks of Oil" are Oil, nothing else), ten caltrops where the book has one
 * item, a blanket the Scholar's Pack does not hold, and the whole 2014 contents for the Entertainer's Pack.
 */
export const PACK_CONTENTS: Record<string, { item: string; quantity: number }[]> = {
  "burglars-pack": [
    ["backpack", 1],
    ["ball-bearings", 1],
    ["bell", 1],
    ["candle", 10],
    ["crowbar", 1],
    ["lantern-hooded", 1],
    ["oil", 7],
    ["rations", 5],
    ["rope", 1],
    ["tinderbox", 1],
    ["waterskin", 1],
  ].map(([item, quantity]) => ({ item: item as string, quantity: quantity as number })),
  "diplomat-pack": [
    ["chest", 1],
    ["clothes-fine", 1],
    ["ink", 1],
    ["ink-pen", 5],
    ["lamp", 1],
    ["case-map-or-scroll", 2],
    ["oil", 4],
    ["paper", 5],
    ["parchment", 5],
    ["perfume", 1],
    ["tinderbox", 1],
  ].map(([item, quantity]) => ({ item: item as string, quantity: quantity as number })),
  "dungeoneer-pack": [
    ["backpack", 1],
    ["caltrops", 1],
    ["crowbar", 1],
    ["oil", 2],
    ["rations", 10],
    ["rope", 1],
    ["tinderbox", 1],
    ["torch", 10],
    ["waterskin", 1],
  ].map(([item, quantity]) => ({ item: item as string, quantity: quantity as number })),
  "entertainers-pack": [
    ["backpack", 1],
    ["bedroll", 1],
    ["bell", 1],
    ["lantern-bullseye", 1],
    ["costume", 3],
    ["mirror", 1],
    ["oil", 8],
    ["rations", 9],
    ["tinderbox", 1],
    ["waterskin", 1],
  ].map(([item, quantity]) => ({ item: item as string, quantity: quantity as number })),
  "scholars-pack": [
    ["backpack", 1],
    ["book", 1],
    ["ink", 1],
    ["ink-pen", 1],
    ["lamp", 1],
    ["oil", 10],
    ["parchment", 10],
    ["tinderbox", 1],
  ].map(([item, quantity]) => ({ item: item as string, quantity: quantity as number })),
};
