import { applyChange, selectedEntry, studioMode, wizardFor } from "../../app/studio";
import { type Variant, startEntry } from "../../homebrew/blanks";
import type { EntryKind } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { WIZARD_KINDS } from "./Wizard";
import { kindName } from "./names";

/** What a new entry can start as: a kind, and for items which sort. Beginners see the common ones. */
export interface NewKind {
  id: string;
  kind: EntryKind;
  variant?: Variant;
  label: () => string;
  level: "guided" | "advanced";
}

export const NEW_KINDS: NewKind[] = [
  { id: "spell", kind: "spell", label: () => ui("hb.kind.spell"), level: "guided" },
  {
    id: "weapon",
    kind: "item",
    variant: "weapon",
    label: () => ui("hb.kind.weapon"),
    level: "guided",
  },
  {
    id: "armor",
    kind: "item",
    variant: "armor",
    label: () => ui("hb.kind.armor"),
    level: "guided",
  },
  { id: "gear", kind: "item", variant: "gear", label: () => ui("hb.kind.gear"), level: "guided" },
  {
    id: "magic",
    kind: "item",
    variant: "magic",
    label: () => ui("studio.kind.magic"),
    level: "guided",
  },
  { id: "species", kind: "species", label: () => ui("hb.kind.species"), level: "guided" },
  {
    id: "subspecies",
    kind: "subspecies",
    label: () => ui("search.kind.subspecies"),
    level: "guided",
  },
  { id: "class", kind: "class", label: () => ui("hb.kind.class"), level: "guided" },
  { id: "subclass", kind: "subclass", label: () => ui("hb.kind.subclass"), level: "guided" },
  { id: "background", kind: "background", label: () => ui("hb.kind.background"), level: "guided" },
  { id: "feat", kind: "feat", label: () => ui("hb.kind.feat"), level: "guided" },
  { id: "language", kind: "language", label: () => ui("hb.kind.language"), level: "guided" },
  { id: "property", kind: "property", label: () => ui("hb.kind.property"), level: "guided" },
  {
    id: "condition",
    kind: "condition",
    label: () => kindName({ kind: "condition", data: {} }),
    level: "guided",
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
    level: "advanced" as const,
  })),
];

/** Starts an entry of a kind in the open pack and opens it; a beginner is led through it, step by step. */
export function startNew(record: UserPackRecord, id: string): void {
  const found = NEW_KINDS.find((k) => k.id === id);
  if (!found) return;
  const started = startEntry(record, found.kind, found.variant);
  applyChange(started.record);
  selectedEntry.value = started.id;
  wizardFor.value =
    studioMode.value !== "advanced" && WIZARD_KINDS.includes(found.id) ? started.id : undefined;
}
