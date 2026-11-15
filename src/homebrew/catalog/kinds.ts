import { ENTRY_KINDS } from "../../data/schema";
import type { FieldLevel } from "./fields";

export type EntryKind = (typeof ENTRY_KINDS)[number];

/** Where a kind sits in the editor's library. */
export type KindGroup = "character" | "magic" | "items" | "world" | "rules";

/**
 * - `main`: something a person writes on its own (a spell, a class).
 * - `owned`: made together with another entry and kept with it (the features of a class, the
 *   traits of a species); the editor offers it inside its owner, not as a thing of its own.
 * - `vocabulary`: a word of the rules (an ability, a school of magic): rare to add, but possible.
 */
export type KindRole = "main" | "owned" | "vocabulary";

export interface KindMeta {
  group: KindGroup;
  role: KindRole;
  /** Shown to a beginner, or only in the advanced mode. */
  level: FieldLevel;
  /** The kinds of entry this one owns and keeps with it. */
  owns?: readonly EntryKind[];
}

/** Every kind of entry the engine knows. A kind added to the schema fails to compile until it is described here. */
export const KIND_META: Record<EntryKind, KindMeta> = {
  species: { group: "character", role: "main", level: "guided", owns: ["trait"] },
  subspecies: { group: "character", role: "main", level: "guided", owns: ["trait"] },
  class: { group: "character", role: "main", level: "guided", owns: ["feature", "trait"] },
  subclass: { group: "character", role: "main", level: "guided", owns: ["feature", "trait"] },
  feature: { group: "character", role: "owned", level: "guided", owns: ["trait"] },
  background: { group: "character", role: "main", level: "guided" },
  trait: { group: "character", role: "owned", level: "guided" },
  feat: { group: "character", role: "main", level: "guided" },
  option: { group: "character", role: "main", level: "advanced" },
  deity: { group: "world", role: "main", level: "advanced" },
  spell: { group: "magic", role: "main", level: "guided" },
  item: { group: "items", role: "main", level: "guided" },
  property: { group: "items", role: "main", level: "guided" },
  language: { group: "world", role: "main", level: "guided" },
  monster: { group: "world", role: "main", level: "advanced" },
  ability: { group: "rules", role: "vocabulary", level: "advanced" },
  skill: { group: "rules", role: "vocabulary", level: "advanced" },
  proficiency: { group: "rules", role: "vocabulary", level: "advanced" },
  school: { group: "rules", role: "vocabulary", level: "advanced" },
  condition: { group: "rules", role: "vocabulary", level: "advanced" },
  alignment: { group: "rules", role: "vocabulary", level: "advanced" },
};

/** The kinds a person can start an entry of, in the order the library lists them. */
export const MAIN_KINDS: readonly EntryKind[] = ENTRY_KINDS.filter(
  (kind) => KIND_META[kind].role === "main",
);
