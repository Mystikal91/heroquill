import type { Entry } from "../data/schema";
import type { StartingChoice, StartingPart } from "../data/startingEquipment";

/** The items of the SRD that are not weapons and sit in a category the choices pick from. */
const LISTED: Record<string, string[]> = {
  "arcane-foci": ["crystal", "orb", "rod", "staff", "wand"],
  "holy-symbols": ["amulet", "emblem", "reliquary"],
  "druidic-foci": ["sprig-of-mistletoe", "totem", "wooden-staff", "yew-wand"],
  "gaming-sets": ["dice", "dragonchess", "playing-cards", "three-dragon-ante"],
  "musical-instruments": [
    "bagpipes",
    "drum",
    "dulcimer",
    "flute",
    "lute",
    "lyre",
    "horn",
    "pan-flute",
    "shawm",
    "viol",
  ],
};

/** The weapon categories: the weapon's category, and whether only the melee ones count. */
const WEAPONS: Record<string, { category: string; melee: boolean }> = {
  "simple-weapons": { category: "simple", melee: false },
  "martial-weapons": { category: "martial", melee: false },
  "simple-melee-weapons": { category: "simple", melee: true },
  "martial-melee-weapons": { category: "martial", melee: true },
};

/** The ids of the items a starting equipment choice can pick from a category, in the order of the data. */
export function categoryItems(
  category: string,
  index: ReadonlyMap<string, Entry>,
  ruleset = "srd51",
): string[] {
  const listed = LISTED[category];
  if (listed) return listed.map((slug) => `${ruleset}:item/${slug}`).filter((id) => index.has(id));
  const wanted = WEAPONS[category];
  if (!wanted) return [];
  const out: string[] = [];
  for (const [id, entry] of index) {
    if (!id.startsWith(`${ruleset}:item/`)) continue;
    const weapon = (entry.data as { weapon?: { category?: string; kind?: string } }).weapon;
    if (weapon?.category !== wanted.category) continue;
    if (wanted.melee && weapon.kind !== "melee") continue;
    out.push(id);
  }
  return out;
}

/** What a person has decided so far: the option taken for each choice, and the item picked for each category slot. */
export interface StartingPicks {
  /** The option taken for each choice; a choice with one option needs no decision. */
  options: (number | undefined)[];
  /** The item picked for a slot of a category part, by `choice:part:n`. */
  items: Record<string, string>;
}

export const noPicks = (): StartingPicks => ({ options: [], items: {} });

/** The option of a choice that is taken: the one picked, or the only one there is. */
export function takenOption(
  choice: StartingChoice,
  picks: StartingPicks,
  n: number,
): number | undefined {
  return choice.options.length === 1 ? 0 : picks.options[n];
}

/** The slots a part of a category asks the person to fill, as the keys of `StartingPicks.items`. */
export function slotKeys(n: number, part: number, p: StartingPart): string[] {
  return "category" in p ? Array.from({ length: p.count }, (_, i) => `${n}:${part}:${i}`) : [];
}

/** What the choices hand out with the decisions made so far, and whether every decision is made. */
export function resolveStarting(
  choices: StartingChoice[],
  picks: StartingPicks,
): { items: { item: string; quantity: number }[]; gold: number; complete: boolean } {
  const items: { item: string; quantity: number }[] = [];
  let gold = 0;
  let complete = true;
  choices.forEach((choice, n) => {
    const taken = takenOption(choice, picks, n);
    const option = taken === undefined ? undefined : choice.options[taken];
    if (!option) {
      complete = false;
      return;
    }
    option.items.forEach((part, p) => {
      if ("gold" in part) {
        gold += part.gold;
        return;
      }
      if ("item" in part) {
        items.push({ item: part.item, quantity: part.quantity });
        return;
      }
      for (const key of slotKeys(n, p, part)) {
        const picked = picks.items[key];
        if (picked) items.push({ item: picked, quantity: 1 });
        else complete = false;
      }
    });
  });
  return { items, gold, complete };
}
