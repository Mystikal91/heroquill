import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import {
  clearSelection,
  clipboard,
  copyEntriesTo,
  copySelection,
  cutSelection,
  deleteEntries,
  duplicateEntries,
  moveEntriesTo,
  otherPacks,
  pasteHere,
  selectRange,
  selection,
  toggleSelected,
} from "../../app/arrange";
import { legacyForm, selectedEntry } from "../../app/studio";
import { ui } from "../../i18n/ui";

/** The mark that says an entry is being dragged: the ids, as text, since that is what a drop can carry. */
const MIME = "application/x-heroquill-entries";

/** A list of the other packs to send entries to, shown as one menu. */
export function PackPicker({
  label,
  onPick,
}: {
  label: string;
  onPick: (packId: string) => void;
}) {
  const packs = otherPacks();
  if (packs.length === 0) return null;
  return (
    <select
      class="studio-pick"
      value=""
      aria-label={label}
      onChange={(e) => {
        const id = e.currentTarget.value;
        e.currentTarget.value = "";
        if (id) onPick(id);
      }}
    >
      <option value="">{label}</option>
      {packs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

/** What can be done with the ticked entries: copy, cut, paste, duplicate, move, delete. */
export function ArrangeBar({ ids }: { ids: string[] }) {
  const chosen = selection.value;
  const held = clipboard.value;
  if (chosen.length === 0 && !held) return null;
  return (
    <div class="studio-arrange">
      {chosen.length > 0 && (
        <>
          <span class="studio-arrange-count">{ui("studio.selected", { n: chosen.length })}</span>
          <button type="button" onClick={copySelection}>
            {ui("studio.copy")}
          </button>
          <button type="button" onClick={cutSelection}>
            {ui("studio.cut")}
          </button>
          <button type="button" onClick={() => void duplicateEntries()}>
            {ui("studio.duplicate")}
          </button>
          <PackPicker label={ui("studio.moveTo")} onPick={(id) => void moveEntriesTo(id)} />
          <PackPicker label={ui("studio.copyTo")} onPick={(id) => void copyEntriesTo(id)} />
          <button type="button" class="danger" onClick={() => deleteEntries()}>
            {ui("studio.delete")}
          </button>
          <button type="button" onClick={clearSelection}>
            {ui("studio.clear")}
          </button>
        </>
      )}
      {held && (
        <button type="button" class="primary" onClick={() => void pasteHere()}>
          {ui("studio.paste")} ({held.ids.length})
        </button>
      )}
      {chosen.length === 0 && ids.length > 1 && (
        <small class="muted">{ui("studio.dragHint")}</small>
      )}
    </div>
  );
}

/** One entry of the list: a tick, the name to open it, and a handle to drag it to another pack. */
export function EntryRow({
  id,
  label,
  tag,
  ids,
}: {
  id: string;
  label: string;
  tag: string;
  ids: string[];
}) {
  const open = selectedEntry.value === id;
  const ticked = selection.value.includes(id);
  return (
    <div class={`studio-entry-row${open ? " on" : ""}${ticked ? " ticked" : ""}`}>
      <input
        type="checkbox"
        class="studio-tick"
        checked={ticked}
        aria-label={label}
        onClick={(e) => {
          if (e.shiftKey) {
            e.preventDefault();
            selectRange(ids, id);
          }
        }}
        onChange={() => toggleSelected(id)}
      />
      <button
        type="button"
        class={open ? "studio-entry on" : "studio-entry"}
        aria-current={open}
        draggable
        onDragStart={(e) => {
          // Dragging an entry of the selection takes the whole selection.
          const moving = ticked ? [...selection.value] : [id];
          e.dataTransfer?.setData(MIME, JSON.stringify(moving));
          if (e.dataTransfer) e.dataTransfer.effectAllowed = "copyMove";
        }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) return toggleSelected(id);
          if (e.shiftKey) return selectRange(ids, id);
          legacyForm.value = undefined;
          selectedEntry.value = id;
        }}
      >
        <b>{label}</b>
        <span class="pack-tag">{tag}</span>
      </button>
    </div>
  );
}

/** A pack that entries can be dropped on: they move there, or are copied when Alt is held. */
export function PackDrop({ id, children }: { id: string; children: ComponentChildren }) {
  const [over, setOver] = useState(false);
  return (
    <div
      class={over ? "studio-drop-target over" : "studio-drop-target"}
      onDragOver={(e) => {
        if (e.dataTransfer?.types.includes(MIME)) {
          e.preventDefault();
          setOver(true);
          if (e.dataTransfer) e.dataTransfer.dropEffect = e.altKey ? "copy" : "move";
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const raw = e.dataTransfer?.getData(MIME);
        if (!raw) return;
        e.preventDefault();
        const ids = JSON.parse(raw) as string[];
        if (e.altKey) void copyEntriesTo(id, ids);
        else void moveEntriesTo(id, ids);
      }}
    >
      {children}
    </div>
  );
}
