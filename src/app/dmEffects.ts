import { signal } from "@preact/signals";
import type { TrackedEffect } from "../engine/encounter";
import { type SavedEffect, keepEffect, savedEffect } from "../engine/savedEffects";
import { ui } from "../i18n/ui";
import { loadSavedEffects, storeSavedEffects } from "../storage/dmEffects";
import { offerUndo } from "./undo";

/** The effects the DM kept to use again in any fight. */
export const savedEffects = signal<SavedEffect[]>([]);

export async function loadDmEffects() {
  savedEffects.value = await loadSavedEffects();
}

function setAll(list: SavedEffect[]) {
  savedEffects.value = list;
  void storeSavedEffects(list);
}

/** What saving came to: "full" when there is no room for another. */
export type SaveResult = "saved" | "full" | "invalid";

/** Keeps an effect (or the new version of a kept one); what it takes the place of can be put back. */
export function saveEffect(effect: Omit<TrackedEffect, "id">, id?: string): SaveResult {
  const before = savedEffects.value;
  const added = savedEffect(effect, id);
  if (!added) return "invalid";
  const next = keepEffect(before, added);
  if (!next.includes(added)) return "full";
  setAll(next);
  offerUndo(ui("dm.saved.done", { name: added.effect.name }), () => setAll(before));
  return "saved";
}

export function forgetEffect(id: string) {
  const before = savedEffects.value;
  const gone = before.find((s) => s.id === id);
  if (!gone) return;
  setAll(before.filter((s) => s.id !== id));
  offerUndo(ui("dm.saved.removed", { name: gone.effect.name }), () => setAll(before));
}
