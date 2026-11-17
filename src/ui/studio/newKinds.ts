import { applyChange, selectedEntry } from "../../app/studio";
import { type Variant, startEntry } from "../../homebrew/blanks";
import type { EntryKind } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { kindName } from "./names";

/** What a new entry can start as: a kind, and for items which sort. Beginners see the common ones. */
export interface NewKind {
  id: string;
  kind: EntryKind;
  variant?: Variant;
  label: () => string;
}

export const NEW_KINDS: NewKind[] = [
  { id: "spell", kind: "spell", label: () => ui("hb.kind.spell") },
  {
    id: "weapon",
    kind: "item",
    variant: "weapon",
    label: () => ui("hb.kind.weapon"),
  },
  {
    id: "armor",
    kind: "item",
    variant: "armor",
    label: () => ui("hb.kind.armor"),
  },
  { id: "gear", kind: "item", variant: "gear", label: () => ui("hb.kind.gear") },
  {
    id: "magic",
    kind: "item",
    variant: "magic",
    label: () => ui("studio.kind.magic"),
  },
  {
    id: "enchantment",
    kind: "item",
    variant: "enchantment",
    label: () => ui("studio.kind.enchantment"),
  },
  { id: "species", kind: "species", label: () => ui("hb.kind.species") },
  {
    id: "subspecies",
    kind: "subspecies",
    label: () => ui("search.kind.subspecies"),
  },
  { id: "class", kind: "class", label: () => ui("hb.kind.class") },
  { id: "subclass", kind: "subclass", label: () => ui("hb.kind.subclass") },
  { id: "background", kind: "background", label: () => ui("hb.kind.background") },
  { id: "feat", kind: "feat", label: () => ui("hb.kind.feat") },
  { id: "language", kind: "language", label: () => ui("hb.kind.language") },
  { id: "property", kind: "property", label: () => ui("hb.kind.property") },
  {
    id: "condition",
    kind: "condition",
    label: () => kindName({ kind: "condition", data: {} }),
  },
  ...(
    [
      "option",
      "deity",
      "monster",
      "skill",
      "proficiency",
      "school",
      "alignment",
      "ability",
    ] as EntryKind[]
  ).map((kind) => ({
    id: kind,
    kind,
    label: () => kindName({ kind, data: {} }),
  })),
];

/** Starts an entry of a kind in the open pack and opens it; a beginner is led through it, step by step. */
export function startNew(record: UserPackRecord, id: string): void {
  const found = NEW_KINDS.find((k) => k.id === id);
  if (!found) return;
  const started = startEntry(record, found.kind, found.variant);
  applyChange(started.record);
  selectedEntry.value = started.id;
}
