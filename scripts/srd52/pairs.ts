/**
 * Which 2024 item is the same thing as which 2014 item, for converting a character from one edition
 * to the other (and, later, for the content of other tools that exists in both). An item pairs when
 * it has the same slug, or when the book renamed it, which is written here by hand. Pairing says
 * "same thing", not "same numbers": the 2024 table changed some prices and weights.
 */

/** 2024 slug -> 2014 slug, for the items the 2024 table names or splits differently. */
export const RENAMES: Record<string, string> = {
  // Crossbows and ammunition: the 2024 table sorts the name the other way round, and counts bundles.
  "light-crossbow": "crossbow-light",
  "hand-crossbow": "crossbow-hand",
  "heavy-crossbow": "crossbow-heavy",
  arrows: "arrow",
  bolts: "crossbow-bolt",
  "bullets-sling": "sling-bullet",
  needles: "blowgun-needle",
  // Packs and kits.
  "dungeoneer-pack": "dungeoneers-pack",
  "diplomat-pack": "diplomats-pack",
  "entertainers-pack": "entertainers-pack",
  "cartographer-tools": "cartographers-tools",
  dice: "dice-set",
  "playing-cards": "playing-card-set",
  // Gear whose 2014 name carried the amount or the container.
  acid: "acid-vial",
  "alchemists-fire": "alchemists-fire-flask",
  antitoxin: "antitoxin-vial",
  "ball-bearings": "ball-bearings-bag-of-1000",
  chain: "chain-10-feet",
  costume: "clothes-costume",
  flask: "flask-or-tankard",
  "holy-water": "holy-water-flask",
  ink: "ink-1-ounce-bottle",
  jug: "jug-or-pitcher",
  ladder: "ladder-10-foot",
  mirror: "mirror-steel",
  oil: "oil-flask",
  paper: "paper-one-sheet",
  parchment: "parchment-one-sheet",
  perfume: "perfume-vial",
  "poison-basic": "poison-basic-vial",
  pole: "pole-10-foot",
  rations: "rations-1-day",
  robe: "robes",
  "spikes-iron": "spike-iron",
  string: "string-10-feet",
  tent: "tent-two-person",
  // Silk Rope and Hemp Rope became one Rope.
  rope: "rope-hempen-50-feet",
};

export interface ItemPairs {
  /** 2024 item id -> 2014 item id. */
  items: Record<string, string>;
  /** 2024 items with no 2014 twin (new in 2024). */
  onlyIn2024: string[];
}

/** Pairs the items of the 2024 pack with those of the 2014 one, by slug and by `RENAMES`. */
export function pairItems(items52: string[], items51: string[]): ItemPairs {
  const slug = (id: string) => id.split("/")[1] ?? id;
  const have51 = new Map(items51.map((id) => [slug(id), id]));
  const items: Record<string, string> = {};
  const onlyIn2024: string[] = [];
  for (const id of items52) {
    const other = have51.get(slug(id)) ?? have51.get(RENAMES[slug(id)] ?? "");
    if (other) items[id] = other;
    else onlyIn2024.push(id);
  }
  return { items, onlyIn2024 };
}
