import { useEffect, useRef } from "preact/hooks";
import {
  advanceTurn,
  areaMode,
  campaign,
  campaigns,
  dmReady,
  dmSection,
  encounter,
  endFight,
  loadDm,
  openAdd,
} from "../../app/dm";
import type { DmSection } from "../../app/dm";
import { leavePage } from "../../app/navigation";
import { monstersWanted } from "../../app/rulesView";
import { type Encounter, isStarted } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { BookIcon, SwordsIcon } from "../icons";
import { neighbour, useSwipe } from "../useSwipe";
import { useTabsBar } from "../useTabsBar";
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
      {isStarted(e) && (
        <button type="button" class="danger-btn dm-end-fight" onClick={endFight}>
          {ui("dm.end")}
        </button>
      )}
    </>
  );
}

const SECTIONS: {
  id: DmSection;
  label: "dm.section.campaign" | "dm.section.encounter";
  icon: typeof BookIcon;
}[] = [
  { id: "campaign", label: "dm.section.campaign", icon: BookIcon },
  { id: "encounter", label: "dm.section.encounter", icon: SwordsIcon },
];

/** The two parts of the page, as the tabs of the app are: a bar at the bottom of a phone, sticky at the top elsewhere. */
function SectionTabs() {
  const nav = useRef<HTMLElement>(null);
  useTabsBar(nav);
  return (
    <nav class="tabs main-tabs no-print" aria-label={ui("dm.title")} ref={nav}>
      {SECTIONS.map((section) => (
        <button
          type="button"
          key={section.id}
          class={`tab${dmSection.value === section.id ? " active" : ""}`}
          aria-current={dmSection.value === section.id ? "page" : undefined}
          onClick={() => {
            dmSection.value = section.id;
          }}
        >
          <section.icon />
          <span class="tab-label">{ui(section.label)}</span>
        </button>
      ))}
    </nav>
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
  // On a phone a swipe sideways moves between the parts, as it does on the sheet.
  const root = useRef<HTMLElement>(null);
  useSwipe(
    root,
    () => matchMedia("(max-width: 42rem)").matches,
    (delta) => {
      const next = neighbour(
        SECTIONS.map((s) => s.id),
        dmSection.value,
        delta,
      );
      if (!next) return false;
      dmSection.value = next;
      return true;
    },
  );
  return (
    <>
      {dmReady.value && e && <SectionTabs />}
      <article class="card dm" ref={root}>
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
          <>{dmSection.value === "campaign" ? <CampaignSection /> : <EncounterSection e={e} />}</>
        )}
        <InfoDialog />
        <AddDialog />
        <AddEffectDialog />
        <PartyDialog />
        <RollPanel />
      </article>
    </>
  );
}
