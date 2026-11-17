import { useEffect, useRef, useState } from "preact/hooks";
import { createHomebrewPack, editingPackId } from "../../app/homebrew";
import { fold } from "../../app/search";
import {
  entryKind,
  entrySearch,
  entrySort,
  openStudioPack,
  selectedEntry,
  setSidebarOpen,
  sidebarOpen,
  startFromOpen,
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
import { KIND_META } from "../../homebrew/catalog";
import { entryProblems } from "../../homebrew/entries";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { ArrangeBar, EntryRow, PackDrop } from "./Arrange";
import { PickerPanel } from "./SearchSelect";
import { kindName } from "./names";
import { NEW_KINDS, startNew } from "./newKinds";

/** How many entries a pack shows in its list: the ones that belong to others (traits, features) are not counted. */
export const visibleEntries = (record: UserPackRecord) =>
  record.pack.entries.filter((e) => KIND_META[e.kind].role !== "owned");

/** Removes a pack, with a way back for a few seconds. */
export function removePack(record: UserPackRecord) {
  void removeUserPack(record.id).then(() =>
    offerUndo(ui("undo.packRemoved", { name: record.name }), () => addUserPack(record)),
  );
}

function NewMenu({ record }: { record: UserPackRecord }) {
  const [open, setOpen] = useState(false);
  // One column with a search: "start from an entry" first, then the kinds, each with the dot of its colour.
  const kinds = NEW_KINDS.map((k) => ({
    id: k.id,
    label: k.label(),
    dot: KIND_META[k.kind].group,
  }));
  return (
    <div class="studio-menu">
      <button type="button" class="primary" aria-expanded={open} onClick={() => setOpen(!open)}>
        + {ui("studio.new")}
      </button>
      {open && (
        <div class="studio-menu-panel">
          <PickerPanel
            options={[{ id: "start", label: ui("studio.startFrom") }, ...kinds]}
            onClose={() => setOpen(false)}
            onPick={(id) => {
              setOpen(false);
              if (id === "start") startFromOpen.value = true;
              else if (id) startNew(record, id);
            }}
          />
        </div>
      )}
    </div>
  );
}

/** The entries the list shows now: filtered by the search and the kind, in the order chosen. */
export function shownEntries(record: UserPackRecord): Entry[] {
  const name = (e: Entry) => record.strings[`${e.id}.name`] ?? "";
  const search = fold(entrySearch.value.trim());
  const kind = entryKind.value;
  return visibleEntries(record)
    .filter((e) => !kind || kindName(e) === kind)
    .filter((e) => fold(name(e)).includes(search))
    .sort((a, b) =>
      entrySort.value === "kind"
        ? kindName(a).localeCompare(kindName(b)) || name(a).localeCompare(name(b))
        : name(a).localeCompare(name(b)),
    );
}

/** Whether an entry has something that will not work (data the engine cannot read): remembered for each entry as it is. */
const problems = new WeakMap<Entry, boolean>();
function hasProblem(entry: Entry): boolean {
  let known = problems.get(entry);
  if (known === undefined) {
    known = entryProblems(entry).length > 0;
    problems.set(entry, known);
  }
  return known;
}

/** What is in the open pack: a button to start an entry, a search, the kinds, and the entries. */
function Contents({ record }: { record: UserPackRecord }) {
  const search = entrySearch.value;
  const kind = entryKind.value;
  const all = visibleEntries(record);
  const name = (e: Entry) => record.strings[`${e.id}.name`] ?? "";
  const kinds = [...new Set(all.map((e) => kindName(e)))].sort();
  const shown = shownEntries(record);
  // The search is a button with a lens; it opens its box under the line, and closing it clears it.
  const [searching, setSearching] = useState(search !== "");
  const searchBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searching) searchBox.current?.focus();
  }, [searching]);
  const closeSearch = () => {
    entrySearch.value = "";
    setSearching(false);
  };

  return (
    <div class="studio-children">
      <div class="studio-toolbar">
        <NewMenu record={record} />
        <button
          type="button"
          class={searching ? "studio-searchbtn on" : "studio-searchbtn"}
          aria-pressed={searching}
          aria-label={ui("studio.search")}
          title={ui("studio.search")}
          onClick={() => (searching ? closeSearch() : setSearching(true))}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="M15 15l6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      {searching && (
        <input
          type="search"
          class="studio-search studio-search-row"
          value={search}
          ref={searchBox}
          placeholder={ui("studio.search")}
          aria-label={ui("studio.search")}
          onInput={(e) => {
            entrySearch.value = e.currentTarget.value;
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeSearch();
            }
          }}
        />
      )}
      {kinds.length > 1 && (
        <fieldset class="studio-kinds" aria-label={ui("studio.kinds")}>
          {["", ...kinds].map((k) => (
            <button
              type="button"
              key={k || "all"}
              class={kind === k ? "studio-kind on" : "studio-kind"}
              onClick={() => {
                entryKind.value = k;
              }}
            >
              {k || ui("studio.all")}
            </button>
          ))}
        </fieldset>
      )}
      {all.length > 1 && (
        <select
          class="studio-pick studio-sort"
          value={entrySort.value}
          aria-label={ui("studio.sortName")}
          onChange={(e) => {
            entrySort.value = e.currentTarget.value === "kind" ? "kind" : "name";
          }}
        >
          <option value="name">{ui("studio.sortName")}</option>
          <option value="kind">{ui("studio.sortKind")}</option>
        </select>
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
                group={KIND_META[e.kind].group}
                bad={hasProblem(e)}
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
          placeholder={ui("hb.f.name")}
          aria-label={ui("studio.newPackName")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" class="primary">
          {ui("studio.create")}
        </button>
        <button
          type="button"
          class="studio-openbtn"
          aria-label={ui("hb.addFile")}
          title={ui("hb.addFile")}
          onClick={() => fileInput.current?.click()}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <path
              d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 9.7V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </form>
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
    </nav>
  );
}
