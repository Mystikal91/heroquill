/** Where a choice comes from, so that it can be asked in the step that gave it. */
export type ChoiceOrigin = "species" | "background" | "class" | "other";

interface IndexEntry {
  kind: string;
  parent?: string;
  effects?: unknown[];
  data?: { class?: unknown };
}
type Index = ReadonlyMap<string, IndexEntry>;

const ROOTS: Record<string, ChoiceOrigin> = {
  species: "species",
  subspecies: "species",
  background: "background",
  class: "class",
  subclass: "class",
};

/** The ids an effect list hands on: granted traits, and the options of a choice of traits. */
function handedOn(effects: unknown[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of effects ?? []) {
    const effect = raw as { type?: string; id?: string; grants?: string; from?: string[] } & {
      effects?: unknown[];
    };
    if (effect.type === "trait" && effect.id) out.push(effect.id);
    else if (effect.type === "when") out.push(...handedOn(effect.effects));
    else if (effect.type === "choice" && effect.grants === "trait")
      out.push(...(effect.from ?? []));
  }
  return out;
}

/**
 * Walks from the entries the character picked (species, background, classes) through what they
 * grant, so a trait or a feature knows which step gave it. A feature that names its class in its
 * data counts for that class even when nothing grants it by an effect.
 */
export function originsOf(
  index: Index,
  roots: { species: string[]; background: string[]; class: string[] },
): Map<string, ChoiceOrigin> {
  const found = new Map<string, ChoiceOrigin>();
  const walk = (id: string, origin: ChoiceOrigin) => {
    if (found.has(id)) return;
    found.set(id, origin);
    for (const next of handedOn(index.get(id)?.effects)) walk(next, origin);
  };
  for (const origin of ["species", "background", "class"] as const)
    for (const id of roots[origin]) walk(id, origin);
  for (const [id, entry] of index) {
    const owner = entry.data?.class;
    if (typeof owner === "string" && roots.class.includes(owner)) walk(id, "class");
  }
  return found;
}

/** `originsOf` for what a character has picked. */
export function characterOrigins(
  index: Index,
  ch: {
    choices: { species?: string; subspecies?: string; background?: string };
    classes: { classId: string; subclassId?: string }[];
  },
): Map<string, ChoiceOrigin> {
  const some = (...ids: (string | undefined)[]) => ids.filter((id): id is string => Boolean(id));
  return originsOf(index, {
    species: some(ch.choices.species, ch.choices.subspecies),
    background: some(ch.choices.background),
    class: ch.classes.flatMap((cl) => some(cl.classId, cl.subclassId)),
  });
}

/**
 * The origin of the entry a choice belongs to: the one that granted it (`origins`), the entry
 * itself or the one that owns it, following `parent`. A feat, an item or an entry the index does
 * not hold is "other": the Choices step asks those.
 */
export function choiceOrigin(
  index: Index,
  source: string,
  origins?: ReadonlyMap<string, ChoiceOrigin>,
): ChoiceOrigin {
  let id: string | undefined = source;
  // A chain of parents is short; the limit only guards against a loop in imported data.
  for (let step = 0; id !== undefined && step < 6; step++) {
    const known = origins?.get(id);
    if (known) return known;
    const entry = index.get(id);
    if (!entry) return "other";
    const origin = ROOTS[entry.kind];
    if (origin) return origin;
    id = entry.parent;
  }
  return "other";
}
