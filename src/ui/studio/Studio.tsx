import { useEffect } from "preact/hooks";
import {
  clipboard,
  copySelection,
  cutSelection,
  duplicateEntries,
  pasteHere,
} from "../../app/arrange";
import { editingPackId } from "../../app/homebrew";
import { leavePage } from "../../app/navigation";
import { flushStudio, history, openStudioPack, redoChange, undoChange } from "../../app/studio";
import { userPacksReady } from "../../app/userPacks";
import { ui } from "../../i18n/ui";
import { Editor } from "./Editor";
import { EntryList } from "./EntryList";
import { Library } from "./Library";
import "./studio.css";

/** True for the places where keys are typing, not commands. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)));
}

/** The homebrew studio: the packs, what is in the open one, and the editor for the open entry. */
export function Studio() {
  const packId = editingPackId.value;
  const ready = userPacksReady.value;
  const record = history.value?.present;

  // A pack opened from elsewhere (a new one, a copy of a rules entry) is taken in here.
  useEffect(() => {
    if (!ready) return;
    if (packId !== history.peek()?.present.id) void openStudioPack(packId);
  }, [packId, ready]);

  // Ctrl+S saves now; Ctrl+Z and Ctrl+Y undo and redo, except where the field has its own undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        void flushStudio();
      } else if (!isTyping(e.target) && key === "z") {
        e.preventDefault();
        if (e.shiftKey) redoChange();
        else undoChange();
      } else if (!isTyping(e.target) && key === "y") {
        e.preventDefault();
        redoChange();
      } else if (!isTyping(e.target) && key === "c") {
        copySelection();
      } else if (!isTyping(e.target) && key === "x") {
        cutSelection();
      } else if (!isTyping(e.target) && key === "v" && clipboard.value) {
        e.preventDefault();
        void pasteHere();
      } else if (!isTyping(e.target) && key === "d") {
        e.preventDefault();
        void duplicateEntries();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  // Leaving the page must not lose the last words.
  useEffect(() => () => void flushStudio(), []);

  return (
    <article class="card studio">
      <header class="studio-top">
        <button type="button" class="secondary" onClick={leavePage}>
          {ui("credits.back")}
        </button>
        <div>
          <h2>{ui("studio.title")}</h2>
          <p class="muted">{ui("studio.intro")}</p>
        </div>
      </header>
      <div class="studio-body">
        <Library />
        {record ? (
          <>
            <EntryList record={record} />
            <Editor record={record} />
          </>
        ) : (
          <section class="studio-empty studio-wide">
            <p class="muted">{ui("studio.noPackOpen")}</p>
          </section>
        )}
      </div>
    </article>
  );
}
