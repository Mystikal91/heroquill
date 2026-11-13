/** Where a choice comes from, so that it can be asked in the step that gave it. */
export type ChoiceOrigin = "species" | "background" | "class" | "other";

const ROOTS: Record<string, ChoiceOrigin> = {
  species: "species",
  subspecies: "species",
  background: "background",
  class: "class",
  subclass: "class",
};

/**
 * The origin of the entry a choice belongs to: the entry itself or the one that owns it (a trait
 * of a species, a feature of a class or of a subclass), following `parent`. A feat, an item or an
 * entry the index does not hold is "other": the Choices step asks those.
 */
export function choiceOrigin(
  index: ReadonlyMap<string, { kind: string; parent?: string }>,
  source: string,
): ChoiceOrigin {
  let id: string | undefined = source;
  // A chain of parents is short; the limit only guards against a loop in imported data.
  for (let step = 0; id !== undefined && step < 6; step++) {
    const entry = index.get(id);
    if (!entry) return "other";
    const origin = ROOTS[entry.kind];
    if (origin) return origin;
    id = entry.parent;
  }
  return "other";
}
