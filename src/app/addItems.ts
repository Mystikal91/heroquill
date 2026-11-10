import type { InventoryItem } from "../engine/character";
import { NO_COINS } from "../engine/coins";
import { addToInventory, newCustomItemId, packContents, priceOf } from "../engine/gear";
import { spendFromPurse } from "./purse";
import { noteRecentItem } from "./recentItems";
import { character, content, updateCharacter } from "./store";

/** Puts items in the inventory: a pack adds everything it holds, ammunition and the rest as they are. */
export function addItem(itemId: string, quantity = 1) {
  const entry = content.value?.index.get(itemId);
  const parts = entry ? packContents(entry) : [];
  updateCharacter((d) => {
    if (parts.length > 0)
      for (const part of parts) addToInventory(d.inventory, part.item, part.quantity * quantity);
    else addToInventory(d.inventory, itemId, quantity);
  });
  noteRecentItem(itemId);
}

/**
 * Buys items: takes their price from the coins (with change) and adds them. Nothing when the item
 * has no known price or the coins do not cover it. `undo` gives the coins and the inventory back
 * as they were, so it is only good until the next change.
 */
export function buyItem(itemId: string, quantity = 1) {
  const price = priceOf(content.value?.index.get(itemId));
  if (price === undefined) return undefined;
  const before = {
    coins: { ...NO_COINS, ...character.value.coins },
    inventory: JSON.parse(JSON.stringify(character.value.inventory)) as InventoryItem[],
  };
  const paid = spendFromPurse(price * quantity);
  if (!paid) return undefined;
  addItem(itemId, quantity);
  return {
    price: price * quantity,
    paid: paid.paid,
    change: paid.change,
    undo: () =>
      updateCharacter((d) => {
        d.coins = { ...before.coins };
        d.inventory = before.inventory;
      }),
  };
}

/** Takes back some of what `addItem` put (the line goes with the last one). */
export function removeSome(itemId: string, quantity = 1) {
  updateCharacter((d) => {
    const found = d.inventory.find((i) => i.itemId === itemId);
    if (!found) return;
    found.quantity -= quantity;
    if (found.quantity <= 0) d.inventory = d.inventory.filter((i) => i !== found);
  });
}

/** An item the rules do not list, with just a name and a count. */
export function addFreeItem(name: string, quantity = 1) {
  updateCharacter((d) => {
    d.inventory.push({
      itemId: newCustomItemId(),
      quantity,
      equipped: false,
      custom: { name },
    });
  });
}
