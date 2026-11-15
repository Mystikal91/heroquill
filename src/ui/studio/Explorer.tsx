import { useRef, useState } from "preact/hooks";
import { createHomebrewPack, editingPackId } from "../../app/homebrew";
import {
  applyChange,
  openStudioPack,
  selectedEntry,
  setSidebarOpen,
  sidebarOpen,
  studioMode,
} from "../../app/studio";
import { offerUndo } from "../../app/undo";
import {
  addUserPack,
  importPackFile,
  packError,
  removeUserPack,
  userPacks,
} from "../../app/userPacks";
import type { Entry } from "../../data/schema";
import { type Variant, startEntry } from "../../homebrew/blanks";
import { type EntryKind, KIND_META } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { ArrangeBar, EntryRow, PackDrop } from "./Arrange";
import { kindName } from "./names";

/** How many entries a pack shows in its list: the ones that belong to others (traits, features) are not counted. */
export const visibleEntries = (record: UserPackRecord) =>
  record.pack.entries.filter((e) => KIND_META[e.kind].role !== "owned");

/** Removes a pack, with a way back for a few seconds. */
export function removePack(record: UserPackRecord) {
  void removeUserPack(record.id).then(() =>
    offerUndo(ui("undo.packRemoved", { name: record.name }), () => addUserPack(record)),
  );
}

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

/** What is in the open pack: a button to start an entry, a search, the kinds, and the entries. */
function Contents({ record }: { record: UserPackRecord }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const all = visibleEntries(record);
  const name = (e: Entry) => record.strings[`${e.id}.name`] ?? "";
  const kinds = [...new Set(all.map((e) => kindName(e)))].sort();
  const shown = all
    .filter((e) => !kind || kindName(e) === kind)
    .filter((e) => name(e).toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => name(a).localeCompare(name(b)));

  return (
    <div class="studio-children">
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
      <ArrangeBar ids={shown.map((e) => e.id)} />
      {all.length === 0 ? (
        <p class="muted">{ui("studio.noEntries")}</p>
      ) : shown.length === 0 ? (
        <p class="muted">{ui("studio.noMatch")}</p>
      ) : (
        <ul class="plain studio-entries">
          {shown.map((e) => (
            <li key={e.id}>
              <EntryRow
                id={e.id}
                label={name(e) || ui("studio.unnamed")}
                tag={kindName(e)}
                ids={shown.map((x) => x.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The whole left side in one column: the packs as folders, the open one unfolded to its entries.
 * It folds into a narrow strip to leave the room to the editor.
 */
export function Explorer({ record }: { record: UserPackRecord | undefined }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  // The open pack can be folded to see the others; opening another unfolds it.
  const [folded, setFolded] = useState(false);
  const packs = userPacks.value.filter((p) => p.origin === "homebrew");
  const error = packError.value;
  const open = editingPackId.value;

  if (!sidebarOpen.value)
    return (
      <nav class="studio-explorer rail" aria-label={ui("studio.packs")}>
        <button
          type="button"
          class="studio-rail-button"
          aria-label={ui("studio.showSidebar")}
          title={ui("studio.showSidebar")}
          onClick={() => setSidebarOpen(true)}
        >
          »
        </button>
        {record && <span class="studio-rail-name">{record.name}</span>}
      </nav>
    );

  return (
    <nav class="studio-explorer" aria-label={ui("studio.packs")}>
      <header class="studio-explorer-head">
        <h3>{ui("studio.packs")}</h3>
        <button
          type="button"
          class="studio-rail-button"
          aria-label={ui("studio.hideSidebar")}
          title={ui("studio.hideSidebar")}
          onClick={() => setSidebarOpen(false)}
        >
          «
        </button>
      </header>

      {packs.length === 0 ? (
        <p class="muted">{ui("studio.noPacks")}</p>
      ) : (
        <ul class="plain studio-tree">
          {packs.map((pack) => {
            const isOpen = open === pack.id;
            const live = isOpen && record ? record : pack;
            return (
              <li key={pack.id}>
                <PackDrop id={pack.id}>
                  <div class={isOpen ? "studio-node on" : "studio-node"}>
                    <button
                      type="button"
                      class="studio-node-main"
                      aria-expanded={isOpen && !folded}
                      aria-current={isOpen}
                      onClick={() => {
                        if (isOpen) setFolded(!folded);
                        else {
                          setFolded(false);
                          void openStudioPack(pack.id);
                        }
                      }}
                    >
                      <span class="studio-chevron" aria-hidden="true">
                        {isOpen && !folded ? "▾" : "▸"}
                      </span>
                      <b>{live.name}</b>
                      <span class="muted">{visibleEntries(live).length}</span>
                    </button>
                    {isOpen && (
                      <button
                        type="button"
                        class="studio-node-gear"
                        aria-label={ui("studio.packSettings")}
                        title={ui("studio.packSettings")}
                        onClick={() => {
                          setFolded(false);
                          selectedEntry.value = undefined;
                        }}
                      >
                        ⚙
                      </button>
                    )}
                  </div>
                </PackDrop>
                {isOpen && !folded && record && <Contents record={record} />}
              </li>
            );
          })}
        </ul>
      )}

      <form
        class="studio-newpack"
        onSubmit={(e) => {
          e.preventDefault();
          setFolded(false);
          void createHomebrewPack(name);
          setName("");
        }}
      >
        <input
          type="text"
          value={name}
          placeholder={ui("studio.newPackName")}
          aria-label={ui("studio.newPackName")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" class="primary">
          {ui("studio.create")}
        </button>
      </form>

      <button type="button" class="studio-link" onClick={() => fileInput.current?.click()}>
        {ui("hb.addFile")}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void importPackFile(file);
        }}
      />
      {(error === "exists" || error === "invalid") && (
        <p class="note" role="alert">
          {ui(error === "exists" ? "packs.exists" : "packs.invalid")}
        </p>
      )}
    </nav>
  );
}
