import type { Entry } from "../data/schema";
import type { InventoryItem } from "./character";
import { toCopper } from "./coins";

/** What an equipment pack (a burglar's pack, an explorer's pack...) holds. Empty for any other item. */
export function packContents(entry: Entry): { item: string; quantity: number }[] {
  const gear = entry.data.gear as
    | { contents?: { item?: unknown; quantity?: unknown }[] }
    | undefined;
  return (gear?.contents ?? []).flatMap((c) =>
    typeof c.item === "string" && typeof c.quantity === "number"
      ? [{ item: c.item, quantity: c.quantity }]
      : [],
  );
}

export type ItemKind =
  | "armor"
  | "weapon"
  | "pack"
  | "magic"
  | "enchantment"
  | "tool"
  | "mount"
  | "gear";

/** What sort of thing an item is, for listing it: armor, a weapon, a pack, a magic item... */
export function itemKind(entry: Entry): ItemKind {
  const d = entry.data as Record<string, unknown>;
  if (d.enchants === true) return "enchantment";
  if (d.armor) return "armor";
  if (d.weapon) return "weapon";
  if (packContents(entry).length > 0) return "pack";
  if (d.rarity) return "magic";
  if (d.category === "tools") return "tool";
  if (d.category === "mounts-and-vehicles") return "mount";
  return "gear";
}

/**
 * How many of an item a starting equipment line puts in the inventory. The rules count pieces
 * ("20 arrows") and the items are the bundles the book sells ("Arrow (20)", one line of 20), so a
 * count of ammunition becomes that many bundles; anything else is taken as it is.
 */
export function startingQuantity(entry: Entry | undefined, quantity: number): number {
  const size = (entry?.data as { gear?: { bundleSize?: unknown } } | undefined)?.gear?.bundleSize;
  return typeof size === "number" && size > 1 ? Math.max(1, Math.round(quantity / size)) : quantity;
}

/** Adds what an entry hands out without a choice; a pack adds everything it holds instead of itself. */
export function addStartingItems(
  inventory: InventoryItem[],
  index: ReadonlyMap<string, Entry>,
  items: { item: string; quantity: number }[],
): void {
  for (const { item, quantity } of items) {
    const contents = packContents(index.get(item) ?? ({ data: {} } as Entry));
    if (contents.length === 0)
      addToInventory(inventory, item, startingQuantity(index.get(item), quantity));
    else
      for (const part of contents) addToInventory(inventory, part.item, part.quantity * quantity);
  }
}

/** Whether an item can be used up in play: everything but weapons, armor and enchantments. */
export function isUsable(kind: ItemKind | "custom"): boolean {
  return kind !== "armor" && kind !== "weapon" && kind !== "enchantment";
}

/** The dice of hit points using an item restores, when the item says so. */
export function healingOf(entry: Entry | undefined): string | undefined {
  const use = (entry?.data as { use?: { heal?: unknown } } | undefined)?.use;
  return typeof use?.heal === "string" ? use.heal : undefined;
}

/** Uses up one of an item: the line goes when the last one is used. False if there is none. */
export function useOne(inventory: InventoryItem[], itemId: string): boolean {
  const index = inventory.findIndex((i) => i.itemId === itemId);
  const item = inventory[index];
  if (!item) return false;
  if (item.quantity > 1) item.quantity -= 1;
  else inventory.splice(index, 1);
  return true;
}

/**
 * What an item costs, in copper pieces, when the data knows. A price of zero is not a price: the
 * SRD gives none for its magic items and Aurora has none for what it leaves empty, so both are
 * written as 0 gp and are read here as "not known".
 */
export function priceOf(entry: Entry | undefined): number | undefined {
  const cost = (entry?.data as { cost?: { amount?: unknown; unit?: unknown } } | undefined)?.cost;
  if (typeof cost?.amount !== "number" || cost.amount <= 0) return undefined;
  if (cost.unit !== "cp" && cost.unit !== "sp" && cost.unit !== "gp") return undefined;
  const copper = toCopper(cost.amount, cost.unit);
  return copper > 0 ? copper : undefined;
}

/** An id for an item the person wrote themselves; it never repeats on one device. */
export function newCustomItemId(): string {
  return `custom:item/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Puts `quantity` of an item in the inventory, adding to what is already there. */
export function addToInventory(inventory: InventoryItem[], itemId: string, quantity = 1): void {
  const existing = inventory.find((i) => i.itemId === itemId);
  if (existing) existing.quantity += quantity;
  else inventory.push({ itemId, quantity, equipped: false });
}
