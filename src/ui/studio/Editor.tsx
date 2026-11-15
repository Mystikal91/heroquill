import { useEffect } from "preact/hooks";
import {
  applyChange,
  flushStudio,
  history,
  legacyForm,
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
import { draftFromEntry } from "../../homebrew/model";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { EntryForm } from "../HomebrewPage";
import { TextBox } from "./Controls";
import { Preview } from "./Preview";
import { SpellForm } from "./SpellForm";
import { kindName } from "./names";

/** The kinds the new editor draws itself. Others go to the previous form, or are only shown. */
const NEW_EDITOR = new Set(["spell"]);

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

/** An entry of a kind the new editor does not draw yet: what it holds, to read. */
function RawView({ entry }: { entry: Entry }) {
  return (
    <div class="studio-form">
      <p class="note">{ui("studio.rawNote")}</p>
      <pre class="studio-raw">{JSON.stringify(entry, null, 2)}</pre>
    </div>
  );
}

/** The previous form, for an entry of a kind the new editor does not have yet. */
function LegacyForm({
  draft,
  editing,
  onDone,
}: {
  draft: NonNullable<ReturnType<typeof draftFromEntry>>;
  editing?: string | undefined;
  onDone: () => void;
}) {
  // The form saves through the packs of the device: what waits here goes there first.
  useEffect(() => {
    void flushStudio();
  }, []);
  return (
    <div class="studio-legacy">
      <p class="muted">{ui("studio.legacyNote")}</p>
      <EntryForm initial={draft} editing={editing} onDone={onDone} />
    </div>
  );
}

/** The editor: the open entry, with its preview and checks beside it. */
export function Editor({ record }: { record: UserPackRecord }) {
  const form = legacyForm.value;
  if (form)
    return (
      <section class="studio-editor">
        <LegacyForm
          key={form.editing ?? "new"}
          draft={form.draft}
          editing={form.editing}
          onDone={() => {
            legacyForm.value = undefined;
          }}
        />
      </section>
    );

  const entry = record.pack.entries.find((e) => e.id === selectedEntry.value);
  if (!entry)
    return (
      <section class="studio-editor studio-empty">
        <p class="muted">{ui("studio.pickEntry")}</p>
      </section>
    );

  const legacyDraft = !NEW_EDITOR.has(entry.kind)
    ? draftFromEntry(entry, record.strings, record.pack.entries)
    : undefined;
  if (legacyDraft)
    return (
      <section class="studio-editor">
        <LegacyForm
          key={entry.id}
          draft={legacyDraft}
          editing={entry.id}
          onDone={() => {
            selectedEntry.value = undefined;
          }}
        />
      </section>
    );

  return (
    <section class="studio-editor">
      <Toolbar />
      <div class="studio-work">
        <div class="studio-edit">
          <header class="studio-head">
            <p class="muted">{kindName(entry)}</p>
            <TextBox
              label={ui("hb.f.name")}
              value={record.strings[`${entry.id}.name`] ?? ""}
              placeholder={ui("studio.unnamed")}
              onChange={(v) =>
                applyChange(setText(record, entry.id, "name", v), `${entry.id}.name`)
              }
            />
          </header>
          {entry.kind === "spell" ? (
            <SpellForm record={record} entry={entry} />
          ) : (
            <RawView entry={entry} />
          )}
          {KIND_META[entry.kind].role !== "owned" && (
            <div class="studio-actions">
              <Delete record={record} entry={entry} />
            </div>
          )}
        </div>
        <Preview record={record} entry={entry} />
      </div>
    </section>
  );
}
