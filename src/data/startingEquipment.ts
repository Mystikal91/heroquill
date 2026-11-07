import type { Entry } from "./schema";

/** What an option hands out: a given item, or `count` items the person picks from a category. */
export type StartingPart =
  | { item: string; quantity: number }
  | { category: string; count: number }
  | { gold: number };

/** One option of a choice: its parts, and the proficiency (a key of the SRD) the rules ask for it. */
export interface StartingOption {
  items: StartingPart[];
  requires?: string;
}

/** A choice the rules give for starting equipment: take one of the options. */
export interface StartingChoice {
  options: StartingOption[];
}

/** Gold the rules let a person start with instead of the equipment: `dice` times `multiplier`. */
export interface StartingWealth {
  dice: string;
  multiplier: number;
}

/** The categories the choices pick from, the same as the SRD's. */
export const STARTING_CATEGORIES = [
  "simple-weapons",
  "martial-weapons",
  "simple-melee-weapons",
  "martial-melee-weapons",
  "arcane-foci",
  "holy-symbols",
  "druidic-foci",
  "musical-instruments",
  "gaming-sets",
] as const;
export type StartingCategory = (typeof STARTING_CATEGORIES)[number];

const isPart = (p: unknown): p is StartingPart => {
  const o = p as Record<string, unknown> | null;
  return (
    typeof o === "object" &&
    o !== null &&
    ((typeof o.item === "string" && typeof o.quantity === "number") ||
      (typeof o.category === "string" && typeof o.count === "number") ||
      typeof o.gold === "number")
  );
};

/** What an entry gives for starting equipment: items without a choice, the choices, and the gold alternative. */
export interface Starting {
  fixed: { item: string; quantity: number }[];
  choices: StartingChoice[];
  wealth?: StartingWealth;
}

/**
 * Classes of other books that the SRD does not have, written once here because Aurora describes
 * their equipment only in prose. Keyed by the slug of the class (the Artificer of Tasha's and the
 * one of Eberron share their equipment); the items are the SRD's.
 */
const OVERLAYS: Record<string, Starting> = {
  artificer: {
    fixed: [
      { item: "srd51:item/crossbow-light", quantity: 1 },
      { item: "srd51:item/crossbow-bolt", quantity: 20 },
      { item: "srd51:item/thieves-tools", quantity: 1 },
      { item: "srd51:item/dungeoneers-pack", quantity: 1 },
    ],
    choices: [
      { options: [{ items: [{ category: "simple-weapons", count: 2 }] }] },
      {
        options: [
          { items: [{ item: "srd51:item/studded-leather-armor", quantity: 1 }] },
          { items: [{ item: "srd51:item/scale-mail", quantity: 1 }] },
        ],
      },
    ],
    wealth: { dice: "5d4", multiplier: 10 },
  },
};

/** The slug of an entry's id, without the number that tells apart two entries of the same name. */
const slugOf = (id: string) => (id.split("/")[1] ?? "").replace(/-\d+$/, "");

/** The starting equipment of a class or background: its own data, or what is written here for its name. */
export function startingOf(entry: Entry | undefined): Starting {
  if (!entry) return { fixed: [], choices: [] };
  const own = {
    fixed: ((entry.data as { startingEquipment?: unknown }).startingEquipment ?? []) as Starting["fixed"],
    choices: startingChoicesOf(entry),
    wealth: startingWealthOf(entry),
  };
  const overlay = entry.kind === "class" ? OVERLAYS[slugOf(entry.id)] : undefined;
  if (overlay && !entry.id.startsWith("srd51:") && own.fixed.length === 0 && own.choices.length === 0)
    return overlay;
  return { fixed: own.fixed, choices: own.choices, ...(own.wealth && { wealth: own.wealth }) };
}

/** The starting equipment choices of a class or background, or none. */
export function startingChoicesOf(entry: Entry | undefined): StartingChoice[] {
  const raw = (entry?.data as { startingChoices?: unknown } | undefined)?.startingChoices;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((c) => {
    const options = (c as { options?: unknown }).options;
    if (!Array.isArray(options)) return [];
    const valid = options.flatMap((o): StartingOption[] => {
      const items = (o as { items?: unknown }).items;
      if (!Array.isArray(items) || !items.every(isPart)) return [];
      const requires = (o as { requires?: unknown }).requires;
      return [{ items, ...(typeof requires === "string" && { requires }) }];
    });
    return valid.length > 0 ? [{ options: valid }] : [];
  });
}

/** The gold a class lets a person start with instead of its equipment, if the data has it. */
export function startingWealthOf(entry: Entry | undefined): StartingWealth | undefined {
  const w = (entry?.data as { startingWealth?: Partial<StartingWealth> } | undefined)
    ?.startingWealth;
  return typeof w?.dice === "string" && typeof w.multiplier === "number"
    ? { dice: w.dice, multiplier: w.multiplier }
    : undefined;
}
