import { useEffect } from "preact/hooks";
import {
  advanceTurn,
  areaMode,
  campaign,
  campaigns,
  dmReady,
  dmSection,
  encounter,
  loadDm,
  openAdd,
} from "../../app/dm";
import { leavePage } from "../../app/navigation";
import { monstersWanted } from "../../app/rulesView";
import { type Encounter, isStarted } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { BookIcon, SwordsIcon } from "../icons";
import { AddDialog } from "./AddDialog";
import { AddEffectDialog } from "./AddEffectDialog";
import { AreaPanel } from "./AreaPanel";
import { CampaignSection } from "./CampaignSection";
import { EncounterNotes } from "./EncounterNotes";
import { InfoDialog } from "./InfoDialog";
import { PartyDialog } from "./PartyDialog";
import { RollPanel } from "./RollPanel";
import { TopBar } from "./TopBar";
import { TrackerTable } from "./TrackerTable";
import "./dm.css";

/** Keys for the table, when nothing is being typed and no window is open: N is the next turn, A adds creatures. */
function useShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (dmSection.value !== "encounter") return;
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

/** The fights of the open campaign: the bar, the table and the notes. */
function EncounterSection({ e }: { e: Encounter }) {
  return (
    <>
      <p class="muted dm-campaign-line">
        <button
          type="button"
          class="link"
          onClick={() => {
            dmSection.value = "campaign";
          }}
        >
          {campaign.value?.name.trim() || ui("dm.unnamed")}
        </button>
      </p>
      <TopBar e={e} />
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
      <EncounterNotes e={e} />
    </>
  );
}

/** The Dungeon Master mode: campaigns with their parties, and an initiative table to prepare fights and run them. */
export function DmPage() {
  useEffect(() => {
    // The monsters are a large pack: they come when this page is opened.
    monstersWanted.value = true;
    // The first thing to do on arriving is to choose the campaign: with more than one, that is the part shown.
    void loadDm().then(() => {
      dmSection.value = campaigns.value.length > 1 ? "campaign" : "encounter";
    });
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
          <div class="dm-sections" role="tablist" aria-label={ui("dm.title")}>
            {(
              [
                ["campaign", ui("dm.section.campaign"), BookIcon],
                ["encounter", ui("dm.section.encounter"), SwordsIcon],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                type="button"
                key={id}
                role="tab"
                class="dm-section"
                aria-selected={dmSection.value === id}
                onClick={() => {
                  dmSection.value = id;
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {dmSection.value === "campaign" ? <CampaignSection /> : <EncounterSection e={e} />}
        </>
      )}
      <InfoDialog />
      <AddDialog />
      <AddEffectDialog />
      <PartyDialog />
      <RollPanel />
    </article>
  );
}
