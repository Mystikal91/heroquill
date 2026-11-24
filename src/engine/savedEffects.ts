import { type TrackedEffect, readTrackedEffect } from "./encounter";
import { uuid } from "./uuid";

/** An effect the DM wrote and kept, to use again in any fight of any campaign. */
export interface SavedEffect {
  id: string;
  /** For a creature, or for the lair and what is around. */
  kind: "creature" | "environment";
  effect: Omit<TrackedEffect, "id">;
  updated: number;
}

export const MAX_SAVED = 100;

/** An effect as it is kept: one of the lair at its full length, and never already shown to the players. */
function template(effect: unknown): Omit<TrackedEffect, "id"> | undefined {
  const read = readTrackedEffect(effect);
  if (!read) return undefined;
  const { id: _id, environment, rounds, ...rest } = read;
  if (!environment) return { ...rest, ...(rounds !== undefined && { rounds }) };
  const { shown: _shown, total, ...rule } = environment;
  const full = total ?? rounds;
  return { ...rest, ...(full !== undefined && { rounds: full }), environment: rule };
}

export function savedEffect(
  effect: unknown,
  id: string = uuid(),
  now = Date.now(),
): SavedEffect | undefined {
  const kept = template(effect);
  return (
    kept && { id, kind: kept.environment ? "environment" : "creature", effect: kept, updated: now }
  );
}

const key = (s: SavedEffect) => `${s.kind} ${s.effect.name.trim().toLocaleLowerCase()}`;

/**
 * Keeps an effect, the newest first. It takes the place of the one with its id, or of one of the same kind
 * with the same name; a full list takes no new one (the same effects come back).
 */
export function keepEffect(list: readonly SavedEffect[], added: SavedEffect): SavedEffect[] {
  const rest = list.filter((s) => s.id !== added.id && key(s) !== key(added));
  if (rest.length >= MAX_SAVED) return [...list];
  return [added, ...rest];
}

/** The saved effects read from storage or a file; what is not one is skipped. */
export function readSavedEffects(raw: unknown): SavedEffect[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .flatMap((item): SavedEffect[] => {
      if (!item || typeof item !== "object") return [];
      const r = item as Record<string, unknown>;
      if (typeof r.id !== "string" || r.id === "" || seen.has(r.id)) return [];
      const updated = typeof r.updated === "number" && Number.isFinite(r.updated) ? r.updated : 0;
      const read = savedEffect(r.effect, r.id, updated);
      if (!read) return [];
      seen.add(r.id);
      return [read];
    })
    .slice(0, MAX_SAVED);
}

/** The effects of a file next to the ones here: of two with the same id, or the same kind and name, the newest wins, unless the ones here are kept. */
export function mergeSaved(
  here: readonly SavedEffect[],
  incoming: readonly SavedEffect[],
  keepMine: boolean,
): SavedEffect[] {
  let out = [...here];
  for (const s of incoming) {
    const mine = out.filter((x) => x.id === s.id || key(x) === key(s));
    if (mine.length === 0) {
      if (out.length < MAX_SAVED) out.push(s);
    } else if (!keepMine && mine.every((x) => s.updated > x.updated))
      out = [...out.filter((x) => !mine.includes(x)), s];
  }
  return out;
}
