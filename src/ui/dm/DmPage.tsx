import { useEffect } from "preact/hooks";
import { advanceTurn, areaMode, dmReady, encounter, loadDm, openAdd } from "../../app/dm";
import { leavePage } from "../../app/navigation";
import { monstersWanted } from "../../app/rulesView";
import { isStarted } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { AddDialog } from "./AddDialog";
import { AddEffectDialog } from "./AddEffectDialog";
import { AreaPanel } from "./AreaPanel";
import { EncounterNotes } from "./EncounterNotes";
import { InfoDialog } from "./InfoDialog";
import { TopBar } from "./TopBar";
import { TrackerTable } from "./TrackerTable";
import "./dm.css";

/** Keys for the table, when nothing is being typed and no window is open: N is the next turn, A adds creatures. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable], button, summary")
      )
        return;
      if (document.querySelector("dialog[open], :popover-open")) return;
      const key = event.key.toLowerCase();
      if (key === "n") {
        const e = encounter.value;
        if (e && isStarted(e)) {
          event.preventDefault();
          advanceTurn();
        }
      } else if (key === "a") {
        event.preventDefault();
        openAdd();
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}

/** The Dungeon Master mode: an initiative table to prepare fights and run them. */
export function DmPage() {
  useEffect(() => {
    // The monsters are a large pack: they come when this page is opened.
    monstersWanted.value = true;
    void loadDm();
  }, []);
  useShortcuts();
  const e = encounter.value;
  return (
    <article class="card dm">
      <header class="dm-top">
        <button type="button" class="secondary" onClick={leavePage}>
          {ui("credits.back")}
        </button>
        <div>
          <h2>{ui("dm.title")}</h2>
          <p class="muted">{ui("dm.subtitle")}</p>
        </div>
      </header>
      {!dmReady.value || !e ? (
        <p>{ui("app.loading")}</p>
      ) : (
        <>
          <TopBar e={e} />
          <EncounterNotes e={e} />
          {areaMode.value && <AreaPanel />}
          {e.combatants.length === 0 ? (
            <div class="dm-empty">
              <p>{ui("dm.empty")}</p>
              <button type="button" class="primary" onClick={openAdd}>
                {ui("dm.add")}
              </button>
            </div>
          ) : (
            <TrackerTable e={e} />
          )}
        </>
      )}
      <InfoDialog />
      <AddDialog />
      <AddEffectDialog />
    </article>
  );
}
