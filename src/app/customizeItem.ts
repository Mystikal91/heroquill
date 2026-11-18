import { signal } from "@preact/signals";
import { itemData } from "../data/items";
import { bundleFromIndex, importBundle } from "../homebrew/arrange";
import { updateEntry } from "../homebrew/entries";
import { newHomebrewPack } from "../homebrew/pack";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { PERSONAL_SPELLS_PACK } from "./customSpell";
import { editingPackId } from "./homebrew";
import { language } from "./language";
import { character, content, updateCharacter } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The id of the item of the inventory whose "Customize" window is open, while it is. */
export const customizing = signal<string | undefined>(undefined);

export const openCustomize = (itemId: string): void => {
  customizing.value = itemId;
};
export const closeCustomize = (): void => {
  customizing.value = undefined;
};

/** Only weapons and armor can be customized. */
export function canCustomize(itemId: string): boolean {
  const entry = content.value?.index.get(itemId);
  if (!entry || entry.kind !== "item") return false;
  try {
    const data = itemData(entry);
    return Boolean(data.weapon ?? data.armor);
  } catch {
    return false;
  }
}

/** The choice that stands for a pack that does not exist yet. */
export const NEW_PACK = "new";

const LAST_PACK_KEY = "customizePack";

/** The pack the last copy went to on this device, if it is remembered. */
export function lastCustomizePack(): string | undefined {
  try {
    return localStorage.getItem(LAST_PACK_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function rememberPack(id: string): void {
  try {
    localStorage.setItem(LAST_PACK_KEY, id);
  } catch {
    // Nothing to remember it with: the default is used next time.
  }
}

/** The packs a copy of an item can go to: the homebrew ones, but not the one of the spells written from characters. */
export const copyTargets = (): UserPackRecord[] =>
  userPacks.value.filter((p) => p.origin === "homebrew" && p.id !== PERSONAL_SPELLS_PACK);

/**
 * The pack a copy goes to: the one chosen; without a choice the one of the last copy, the one open in the
 * studio, the first one there is, and a new one when there is none.
 */
function targetFor(choice: string | undefined): UserPackRecord {
  const targets = copyTargets();
  const fresh = () => newHomebrewPack(ui("hb.myPack"), Date.now(), language.value);
  if (choice === NEW_PACK) return fresh();
  const wanted = (id: string | undefined) => targets.find((p) => p.id === id);
  return (
    wanted(choice) ??
    wanted(lastCustomizePack()) ??
    wanted(editingPackId.value) ??
    targets[0] ??
    fresh()
  );
}

/** What the window needs to open: the pack as it will be saved, and the item in it. */
export interface CustomizePlan {
  /** The pack, with the item in it (a copy of the original, or the item itself when it is homebrew already). */
  record: UserPackRecord;
  /** The id of the item to edit in `record`. */
  id: string;
  /** The item is homebrew already and is edited where it is; otherwise a copy was made. */
  editing: boolean;
  /** The copy goes to a pack that does not exist yet. */
  fresh: boolean;
}

const packOf = (id: string) => id.split(":")[0] ?? "";

/**
 * The item to edit for an item of the inventory. A homebrew item is edited where it is; any other
 * becomes a copy, in the pack the person chose (`target`, or `NEW_PACK`) or, without a choice, in the one
 * of the last copy, the one open in the studio or the first homebrew one (see `targetFor`). The bonus and the magic the old "Magic weapon" box put on the item itself are carried
 * into the item, so that they are not lost. Nothing is stored until the person saves.
 */
export function planCustomize(itemId: string, target?: string): CustomizePlan | undefined {
  const c = content.value;
  const entry = c?.index.get(itemId);
  if (!c || !entry || !canCustomize(itemId)) return undefined;
  const owner = userPacks.value.find((p) => p.origin === "homebrew" && p.id === packOf(itemId));
  let record: UserPackRecord;
  let id = itemId;
  if (owner) {
    record = owner;
  } else {
    const into = targetFor(target);
    const bundle = bundleFromIndex(
      c.index,
      { fields: (i) => c.fields(i), read: (i, f) => c.displayed(i, f) ?? "" },
      [itemId],
      into.lang,
    );
    const done = importBundle(bundle, into, {
      rename: (name) => ui("hb.copyName", { name }),
      restricted: userPacks.value.some((p) => p.origin === "personal" && p.id === packOf(itemId)),
      from: (original) => original,
    });
    record = done.record;
    id = done.newIds[0] ?? itemId;
  }
  const own = record.pack.entries.find((e) => e.id === id);
  const held = character.value.inventory.find((i) => i.itemId === itemId);
  const data = own?.data as { weapon?: unknown; enhancement?: number } | undefined;
  const patch: Record<string, unknown> = {};
  // A copy remembers what it was made from, so a customized club still takes Shillelagh.
  if (!owner) patch.copyOf = itemId;
  if (data?.weapon && held) {
    const bonus = Math.min(3, Math.max(data.enhancement ?? 0, held.bonus ?? 0));
    if (bonus > 0) patch.enhancement = bonus;
    if (held.magical) patch.magical = true;
  }
  if (Object.keys(patch).length > 0) record = updateEntry(record, id, { data: patch });
  return {
    record,
    id,
    editing: Boolean(owner),
    fresh: !owner && !userPacks.value.some((p) => p.id === record.id),
  };
}

/** Resolves when the content has an entry (a pack that was just saved is loaded again in a moment). */
function whenIndexed(id: string): Promise<void> {
  if (content.value?.index.has(id)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      stop();
      clearTimeout(timer);
      resolve();
    };
    const stop = content.subscribe((c) => {
      if (c?.index.has(id)) queueMicrotask(done);
    });
    const timer = setTimeout(done, 3000);
  });
}

/** What the window saves besides the item: what only this character has done to it. */
export interface CharacterPart {
  /** The id of an enchantment put on the weapon, or empty. */
  enchantment: string;
}

/**
 * Saves the pack with the edited item and puts the item in the inventory in place of the original.
 * The bonus and the magic of the old box are in the entry now, so the inventory item is cleared of them.
 */
export async function saveCustomItem(
  from: string,
  plan: CustomizePlan,
  record: UserPackRecord,
  part: CharacterPart,
): Promise<string> {
  await addUserPack(record);
  if (!plan.editing) rememberPack(record.id);
  await whenIndexed(plan.id);
  updateCharacter((d) => {
    const found = d.inventory.find((i) => i.itemId === from);
    if (!found) return;
    found.itemId = plan.id;
    found.bonus = undefined;
    found.magical = undefined;
    found.enchantment = part.enchantment || undefined;
  });
  return plan.id;
}
