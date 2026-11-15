import { useState } from "preact/hooks";
import { applyChange, flushStudio, legacyForm, selectedEntry, studioMode } from "../../app/studio";
import { exportPack } from "../../app/userPacks";
import type { Entry } from "../../data/schema";
import { type Variant, startEntry } from "../../homebrew/blanks";
import { type EntryKind, KIND_META } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import { type UserPackRecord, restrictedIds } from "../../storage/packs";
import { TextBox } from "./Controls";
import { removePack, visibleEntries } from "./Library";
import { kindName } from "./names";

/** What a new entry can start as: a kind, and for items which sort. Beginners see the common ones. */
const NEW_KINDS: {
  id: string;
  kind: EntryKind;
  variant?: Variant;
  label: () => string;
  level: "guided" | "advanced";
}[] = [
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
  ...(
    [
      "option",
      "deity",
      "monster",
      "skill",
      "proficiency",
      "school",
      "condition",
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

function NewMenu({ record }: { record: UserPackRecord }) {
  const [open, setOpen] = useState(false);
  const advanced = studioMode.value === "advanced";
  const choose = (id: string) => {
    setOpen(false);
    const found = NEW_KINDS.find((k) => k.id === id);
    if (!found) return;
    const started = startEntry(record, found.kind, found.variant);
    applyChange(started.record);
    selectedEntry.value = started.id;
    legacyForm.value = undefined;
  };
  return (
    <div class="studio-menu">
      <button type="button" class="primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        + {ui("studio.new")}
      </button>
      {open && (
        <ul class="plain studio-menu-list">
          {NEW_KINDS.filter((k) => advanced || k.level === "guided").map((k) => (
            <li key={k.id}>
              <button type="button" onClick={() => choose(k.id)}>
                {k.label()}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The pack's own details: author, version and the like, kept in the pack as a book. */
function Details({ record }: { record: UserPackRecord }) {
  const meta = record.meta ?? {};
  const setMeta = (key: "author" | "description", value: string) => {
    const { [key]: _old, ...rest } = meta;
    applyChange(
      { ...record, meta: value.trim() ? { ...rest, [key]: value } : rest },
      `pack.${key}`,
    );
  };
  return (
    <details class="studio-details">
      <summary>{ui("studio.details")}</summary>
      <TextBox
        label={ui("studio.author")}
        value={meta.author ?? ""}
        onChange={(v) => setMeta("author", v)}
      />
      <TextBox
        label={ui("studio.version")}
        value={record.pack.manifest.version}
        onChange={(v) =>
          applyChange(
            {
              ...record,
              pack: { ...record.pack, manifest: { ...record.pack.manifest, version: v } },
            },
            "pack.version",
          )
        }
      />
      <TextBox
        label={ui("studio.description")}
        value={meta.description ?? ""}
        area
        rows={3}
        onChange={(v) => setMeta("description", v)}
      />
    </details>
  );
}

/** The pack that is open: its name, its details, and the list of what is in it. */
export function EntryList({ record }: { record: UserPackRecord }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const all = visibleEntries(record);
  const name = (e: Entry) => record.strings[`${e.id}.name`] ?? "";
  const kinds = [...new Set(all.map((e) => kindName(e)))].sort();
  const shown = all
    .filter((e) => !kind || kindName(e) === kind)
    .filter((e) => name(e).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => name(a).localeCompare(name(b)));
  const kept = restrictedIds(record).length;

  return (
    <section class="studio-list">
      <label class="field studio-field studio-title">
        <span>{ui("hb.packName")}</span>
        <input
          type="text"
          value={record.name}
          onInput={(e) => applyChange({ ...record, name: e.currentTarget.value }, "pack.name")}
        />
      </label>
      <Details record={record} />
      <div class="studio-actions">
        <button type="button" onClick={() => void flushStudio().then(() => exportPack(record))}>
          {ui("bar.export")}
        </button>
        <button type="button" class="danger" onClick={() => removePack(record)}>
          {ui("packs.remove")}
        </button>
      </div>
      {kept > 0 && <p class="note">{ui("studio.restricted", { n: kept })}</p>}

      <div class="studio-toolbar">
        <NewMenu record={record} />
        <input
          type="search"
          class="studio-search"
          value={search}
          placeholder={ui("studio.search")}
          aria-label={ui("studio.search")}
          onInput={(e) => setSearch(e.currentTarget.value)}
        />
      </div>
      {kinds.length > 1 && (
        <fieldset class="studio-kinds" aria-label={ui("studio.kinds")}>
          {["", ...kinds].map((k) => (
            <button
              type="button"
              key={k || "all"}
              class={kind === k ? "studio-kind on" : "studio-kind"}
              onClick={() => setKind(k)}
            >
              {k || ui("studio.all")}
            </button>
          ))}
        </fieldset>
      )}

      {all.length === 0 ? (
        <p class="muted">{ui("studio.noEntries")}</p>
      ) : shown.length === 0 ? (
        <p class="muted">{ui("studio.noMatch")}</p>
      ) : (
        <ul class="plain studio-entries">
          {shown.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                class={selectedEntry.value === e.id ? "studio-entry on" : "studio-entry"}
                aria-current={selectedEntry.value === e.id}
                onClick={() => {
                  legacyForm.value = undefined;
                  selectedEntry.value = e.id;
                }}
              >
                <b>{name(e) || ui("studio.unnamed")}</b>
                <span class="pack-tag">{kindName(e)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { KIND_META };
