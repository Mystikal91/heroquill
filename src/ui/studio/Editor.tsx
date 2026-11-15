import { useEffect, useRef } from "preact/hooks";
import { copyEntriesTo, duplicateEntries, moveEntriesTo, nameTheId } from "../../app/arrange";
import {
  applyChange,
  history,
  redoChange,
  saveState,
  selectedEntry,
  setStudioMode,
  studioMode,
  undoChange,
} from "../../app/studio";
import { offerUndo } from "../../app/undo";
import type { Entry } from "../../data/schema";
import { KIND_META } from "../../homebrew/catalog";
import { deleteEntry, setText } from "../../homebrew/entries";
import { canRedo, canUndo } from "../../homebrew/history";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { PackPicker } from "./Arrange";
import { TextBox } from "./Controls";
import { GenericForm } from "./GenericForm";
import { PackHome } from "./PackHome";
import { Preview } from "./Preview";
import { SpellForm } from "./SpellForm";
import { kindName } from "./names";

function SaveState() {
  const state = saveState.value;
  return (
    <span class={`studio-saved ${state}`} aria-live="polite">
      {ui(
        state === "saved"
          ? "studio.saved"
          : state === "saving"
            ? "studio.saving"
            : "studio.pending",
      )}
    </span>
  );
}

/** Guided or advanced, undo and redo, and whether the work is safe on the device. */
function Toolbar() {
  const h = history.value;
  const advanced = studioMode.value === "advanced";
  return (
    <div class="studio-bar">
      <fieldset class="studio-mode" aria-label={ui("studio.mode")}>
        <button
          type="button"
          class={advanced ? "" : "on"}
          onClick={() => setStudioMode("guided")}
          title={ui("studio.guidedHint")}
        >
          {ui("studio.guided")}
        </button>
        <button
          type="button"
          class={advanced ? "on" : ""}
          onClick={() => setStudioMode("advanced")}
          title={ui("studio.advancedHint")}
        >
          {ui("studio.advanced")}
        </button>
      </fieldset>
      <div class="studio-undo">
        <button type="button" disabled={!h || !canUndo(h)} onClick={undoChange} title="Ctrl+Z">
          ↶ {ui("studio.undo")}
        </button>
        <button type="button" disabled={!h || !canRedo(h)} onClick={redoChange} title="Ctrl+Y">
          ↷ {ui("studio.redo")}
        </button>
      </div>
      <SaveState />
    </div>
  );
}

function Delete({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const name = record.strings[`${entry.id}.name`] || ui("studio.unnamed");
  return (
    <button
      type="button"
      class="danger"
      onClick={() => {
        applyChange(deleteEntry(record, entry.id));
        selectedEntry.value = undefined;
        offerUndo(ui("undo.deleted", { name }), undoChange);
      }}
    >
      {ui("studio.delete")}
    </button>
  );
}

/** The editor: the open entry, with its preview and checks beside it. */
export function Editor({ record }: { record: UserPackRecord }) {
  const entry = record.pack.entries.find((e) => e.id === selectedEntry.value);
  const section = useRef<HTMLElement>(null);
  const openId = entry?.id;
  // On a narrow screen the editor is under the list: opening an entry takes the person to it.
  useEffect(() => {
    if (openId && matchMedia("(max-width: 960px)").matches)
      section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openId]);
  if (!entry) return <PackHome record={record} />;

  return (
    <section class="studio-editor" ref={section}>
      <Toolbar />
      <div class="studio-work">
        <div class="studio-edit">
          <header class="studio-head">
            <p class="muted">{kindName(entry)}</p>
            <TextBox
              key={entry.id}
              focusOnMount={!record.strings[`${entry.id}.name`]}
              label={ui("hb.f.name")}
              value={record.strings[`${entry.id}.name`] ?? ""}
              placeholder={ui("studio.unnamed")}
              onChange={(v) =>
                applyChange(setText(record, entry.id, "name", v), `${entry.id}.name`)
              }
              onCommit={() => void nameTheId(entry.id)}
            />
          </header>
          {entry.kind === "spell" ? (
            <SpellForm record={record} entry={entry} />
          ) : (
            <GenericForm record={record} entry={entry} />
          )}
          {KIND_META[entry.kind].role !== "owned" && (
            <div class="studio-actions">
              <button type="button" onClick={() => void duplicateEntries([entry.id])}>
                {ui("studio.duplicate")}
              </button>
              <PackPicker
                label={ui("studio.moveTo")}
                onPick={(id) => void moveEntriesTo(id, [entry.id])}
              />
              <PackPicker
                label={ui("studio.copyTo")}
                onPick={(id) => void copyEntriesTo(id, [entry.id])}
              />
              <Delete record={record} entry={entry} />
            </div>
          )}
        </div>
        <Preview record={record} entry={entry} />
      </div>
    </section>
  );
}
