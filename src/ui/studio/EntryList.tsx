import { useState } from "preact/hooks";
import { applyChange, flushStudio, legacyForm, selectedEntry, studioMode } from "../../app/studio";
import { exportPack } from "../../app/userPacks";
import type { Entry } from "../../data/schema";
import { KIND_META } from "../../homebrew/catalog";
import { addEntry, newEntryId } from "../../homebrew/entries";
import { blankDraft } from "../../homebrew/model";
import type { HomebrewKind } from "../../homebrew/model";
import { ui } from "../../i18n/ui";
import { type UserPackRecord, restrictedIds } from "../../storage/packs";
import { TextBox } from "./Controls";
import { removePack, visibleEntries } from "./Library";
import { kindName } from "./names";

/** The kinds a new entry can start as: the new editor's own first, the rest still on the previous form. */
const NEW_KINDS: { id: string; label: () => string; level: "guided" | "advanced" }[] = [
  { id: "spell", label: () => ui("hb.kind.spell"), level: "guided" },
  { id: "weapon", label: () => ui("hb.kind.weapon"), level: "guided" },
  { id: "armor", label: () => ui("hb.kind.armor"), level: "guided" },
  { id: "gear", label: () => ui("hb.kind.gear"), level: "guided" },
  { id: "species", label: () => ui("hb.kind.species"), level: "guided" },
  { id: "class", label: () => ui("hb.kind.class"), level: "guided" },
  { id: "subclass", label: () => ui("hb.kind.subclass"), level: "guided" },
  { id: "background", label: () => ui("hb.kind.background"), level: "guided" },
  { id: "feat", label: () => ui("hb.kind.feat"), level: "guided" },
  { id: "language", label: () => ui("hb.kind.language"), level: "advanced" },
  { id: "property", label: () => ui("hb.kind.property"), level: "advanced" },
];

/** A spell with nothing written yet: valid, so the engine can read it at once. */
function blankSpell(record: UserPackRecord): Entry {
  return {
    id: newEntryId(record, "spell", ""),
    kind: "spell",
    effects: [],
    data: {
      level: 0,
      school: "evocation",
      components: ["V", "S"],
      ritual: false,
      concentration: false,
      classes: [],
    },
  };
}

function NewMenu({ record }: { record: UserPackRecord }) {
  const [open, setOpen] = useState(false);
  const advanced = studioMode.value === "advanced";
  const choose = async (id: string) => {
    setOpen(false);
    if (id === "spell") {
      const entry = blankSpell(record);
      applyChange(addEntry(record, entry));
      selectedEntry.value = entry.id;
      legacyForm.value = undefined;
      return;
    }
    await flushStudio();
    selectedEntry.value = undefined;
    legacyForm.value = { draft: blankDraft(id as HomebrewKind) };
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
              <button type="button" onClick={() => void choose(k.id)}>
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
