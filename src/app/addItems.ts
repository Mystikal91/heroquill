import { addToInventory, newCustomItemId, packContents } from "../engine/gear";
import { noteRecentItem } from "./recentItems";
import { content, updateCharacter } from "./store";

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
