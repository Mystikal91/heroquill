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
import {
  flushStudio,
  helpOpen,
  history,
  openStudioPack,
  paletteOpen,
  redoChange,
  selectedEntry,
  sidebarOpen,
  startFromOpen,
  undoChange,
} from "../../app/studio";
import { userPacksReady } from "../../app/userPacks";
import { ui } from "../../i18n/ui";
import { Editor } from "./Editor";
import { Explorer, shownEntries } from "./Explorer";
import { Palette } from "./Palette";
import { Shortcuts } from "./Shortcuts";
import { StartFromDialog } from "./StartFrom";
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
      // Without Ctrl: the arrows walk the list, and ? shows the keys, unless a field is being typed in.
      if (
        !(e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !isTyping(e.target) &&
        !document.querySelector("dialog[open]")
      ) {
        if (e.key === "?") {
          helpOpen.value = true;
          return;
        }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const open = history.peek()?.present;
          const ids = open ? shownEntries(open).map((x) => x.id) : [];
          if (ids.length === 0) return;
          e.preventDefault();
          const at = ids.indexOf(selectedEntry.peek() ?? "");
          const next =
            e.key === "ArrowDown"
              ? Math.min(ids.length - 1, at + 1)
              : Math.max(0, at < 0 ? 0 : at - 1);
          selectedEntry.value = ids[next];
        }
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        paletteOpen.value = true;
        return;
      }
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
      {paletteOpen.value && <Palette />}
      {startFromOpen.value && (
        <StartFromDialog
          onClose={() => {
            startFromOpen.value = false;
          }}
        />
      )}
      {helpOpen.value && <Shortcuts />}
      <div class={sidebarOpen.value ? "studio-body" : "studio-body rail"}>
        <Explorer record={record} />
        {record ? (
          <Editor record={record} />
        ) : (
          <section class="studio-empty">
            <p class="muted">{ui("studio.noPackOpen")}</p>
          </section>
        )}
      </div>
    </article>
  );
}
