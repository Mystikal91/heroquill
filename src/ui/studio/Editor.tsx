import { useEffect, useRef } from "preact/hooks";
import { nameTheId } from "../../app/arrange";
import {
  applyChange,
  history,
  redoChange,
  saveState,
  selectedEntry,
  studioLanguage,
  undoChange,
} from "../../app/studio";
import { setText } from "../../homebrew/entries";
import { canRedo, canUndo } from "../../homebrew/history";
import { ui } from "../../i18n/ui";
import { packTexts } from "../../storage/packs";
import type { UserPackRecord } from "../../storage/packs";
import { TextBox } from "./Controls";
import {
  ClassTabs,
  EntryTools,
  ItemTabs,
  LAYOUT_TABBED,
  LayoutTabs,
  SpeciesTabs,
  SpellTabs,
} from "./EntryTabs";
import { GenericForm } from "./GenericForm";
import { MonsterTabs } from "./MonsterTabs";
import { PackHome } from "./PackHome";
import { Preview } from "./Preview";
import { LanguageBar, TranslationPanel } from "./Translate";
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

/** Undo and redo, and whether the work is safe on the device. */
function Toolbar() {
  const h = history.value;
  return (
    <div class="studio-bar">
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

/** The kinds whose page is in tabs; the others still have a long form with the preview beside it. */
const TABBED = new Set([
  "spell",
  "item",
  "species",
  "subspecies",
  "class",
  "subclass",
  "monster",
  ...LAYOUT_TABBED,
]);

/** The editor: the open entry, with its preview and checks beside it. */
export function Editor({ record }: { record: UserPackRecord }) {
  const entry = record.pack.entries.find((e) => e.id === selectedEntry.value);
  const section = useRef<HTMLElement>(null);
  const openId = entry?.id;
  // A translation that is not in the pack any more is not written in.
  const language =
    studioLanguage.value && record.translations?.[studioLanguage.value]
      ? studioLanguage.value
      : undefined;
  // The preview reads in the language being written, with the original where nothing is translated.
  const shown = language ? { ...record, strings: packTexts(record, [language]) } : record;
  // On a narrow screen the editor is under the list: opening an entry takes the person to it.
  useEffect(() => {
    if (openId && matchMedia("(max-width: 960px)").matches)
      section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openId]);
  if (!entry) return <PackHome record={record} />;

  return (
    <section class="studio-editor" ref={section}>
      <Toolbar />
      {!TABBED.has(entry.kind) && <LanguageBar record={record} entry={entry} />}
      <div class={TABBED.has(entry.kind) ? "studio-work single" : "studio-work"}>
        <div class="studio-edit">
          <>
            <header class="studio-head">
              <p class="muted">{kindName(entry)}</p>
              {TABBED.has(entry.kind) ? (
                <h3 class="studio-entry-title">
                  {record.strings[`${entry.id}.name`] || ui("studio.unnamed")}
                </h3>
              ) : (
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
              )}
            </header>
            {entry.kind === "spell" ? (
              <SpellTabs record={record} shown={shown} entry={entry} language={language} />
            ) : entry.kind === "item" ? (
              <ItemTabs record={record} shown={shown} entry={entry} language={language} />
            ) : entry.kind === "species" || entry.kind === "subspecies" ? (
              <SpeciesTabs record={record} shown={shown} entry={entry} language={language} />
            ) : entry.kind === "class" || entry.kind === "subclass" ? (
              <ClassTabs record={record} shown={shown} entry={entry} language={language} />
            ) : entry.kind === "monster" ? (
              <MonsterTabs record={record} shown={shown} entry={entry} language={language} />
            ) : LAYOUT_TABBED.has(entry.kind) ? (
              <LayoutTabs record={record} shown={shown} entry={entry} language={language} />
            ) : (
              <>
                {language ? (
                  <TranslationPanel record={record} entry={entry} language={language} />
                ) : (
                  <GenericForm record={record} entry={entry} />
                )}
                <EntryTools record={record} entry={entry} />
              </>
            )}
          </>
        </div>
        {!TABBED.has(entry.kind) && <Preview record={shown} entry={entry} />}
      </div>
    </section>
  );
}
