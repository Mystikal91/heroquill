import { classData } from "../data/progression";
import type { Character } from "./character";
import type { SourcedEffect } from "./choices";
import type { PackIndex } from "./derive";
import { subclassDataOn } from "./subclass";

/** Where a feature or trait comes from: the entry that gives it, and the level for a class. */
export interface FeatureSource {
  entry: string;
  level?: number;
}

/**
 * For each feature and trait of the character, where it comes from: a class or subclass at a
 * level, or the species, background or item that grants it. A trait given by a feature is
 * traced back to that feature's class.
 */
export function featureSources(
  index: PackIndex,
  character: Character,
  sourced: SourcedEffect[],
): Record<string, FeatureSource> {
  const found: Record<string, FeatureSource> = {};
  for (const cl of character.classes) {
    const entry = index.get(cl.classId);
    if (entry)
      for (const row of classData(entry).levels)
        if (row.level <= cl.level)
          for (const id of row.features) found[id] ??= { entry: cl.classId, level: row.level };
    const sub = cl.subclassId ? index.get(cl.subclassId) : undefined;
    if (sub)
      for (const row of subclassDataOn(sub, cl.classId).levels)
        if (row.level <= cl.level)
          for (const id of row.features) found[id] ??= { entry: sub.id, level: row.level };
  }

  const parent = new Map<string, string>();
  for (const { effect, source } of sourced)
    if (effect.type === "trait" && !parent.has(effect.id)) parent.set(effect.id, source);

  const resolve = (id: string, depth = 0): FeatureSource | undefined => {
    const known = found[id];
    if (known) return known;
    const from = parent.get(id);
    if (!from || depth > 6) return undefined;
    return resolve(from, depth + 1) ?? { entry: from };
  };
  for (const id of parent.keys()) {
    const source = resolve(id);
    if (source) found[id] = source;
  }
  return found;
}
