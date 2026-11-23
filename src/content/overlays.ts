import type { Effect } from "../data/schema";
import type { PackIndex } from "../engine/derive";

/** What a pack adds to an entry of another pack (the SRD's), without taking its place. */
export interface Overlay {
  effects?: Effect[];
  activation?: string;
  /** Classes of the pack whose spell list holds this spell (a spell of the SRD that a book gives to its new class). */
  spellClasses?: string[];
}

/**
 * Puts what packs add on the entries they belong to: the effects after the ones the entry has
 * (an effect it already has is not added twice), `data.activation` when the entry says nothing
 * of how it is used and the classes of a spell. An entry the index does not have is left alone.
 */
export function applyOverlays(index: PackIndex, overlays: Record<string, Overlay> | undefined) {
  if (!overlays) return;
  for (const [id, overlay] of Object.entries(overlays)) {
    const entry = index.get(id);
    if (!entry) continue;
    const have = new Set(entry.effects.map((e) => JSON.stringify(e)));
    const extra = (overlay.effects ?? []).filter((e) => !have.has(JSON.stringify(e)));
    const data = entry.data as { activation?: string };
    const activation = !data.activation && overlay.activation ? overlay.activation : undefined;
    const known = (entry.data as { classes?: string[] }).classes ?? [];
    const classes =
      entry.kind === "spell" ? (overlay.spellClasses ?? []).filter((c) => !known.includes(c)) : [];
    if (extra.length === 0 && !activation && classes.length === 0) continue;
    index.set(id, {
      ...entry,
      effects: [...entry.effects, ...extra],
      data: {
        ...entry.data,
        ...(activation && { activation }),
        ...(classes.length > 0 && { classes: [...known, ...classes] }),
      },
    });
  }
}
