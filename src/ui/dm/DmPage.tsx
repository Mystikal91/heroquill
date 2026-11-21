import { useEffect } from "preact/hooks";
import {
  advanceTurn,
  canGoBack,
  dmReady,
  dmRuleset,
  duplicateEncounter,
  encounter,
  encounters,
  lastTurn,
  loadDm,
  newEncounter,
  previousTurn,
  removeEncounter,
  resetTurnHistory,
  selectEncounter,
  updateEncounter,
} from "../../app/dm";
import { leavePage } from "../../app/navigation";
import { monstersWanted } from "../../app/rulesView";
import { content } from "../../app/store";
import {
  type Encounter,
  activeCombatant,
  endCombat,
  initiativeOrder,
  isStarted,
  rollAllInitiative,
  startCombat,
} from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { AddCreatures } from "./AddCreatures";
import { CombatantCard } from "./CombatantCard";
import "./dm.css";

function EncounterBar({ e }: { e: Encounter }) {
  const list = encounters.value;
  return (
    <div class="dm-bar">
      <label class="field dm-pick">
        <span>{ui("dm.encounter")}</span>
        <select value={e.id} onChange={(ev) => void selectEncounter(ev.currentTarget.value)}>
          {list.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name.trim() || ui("dm.unnamed")}
            </option>
          ))}
        </select>
      </label>
      <label class="field dm-title-field">
        <span>{ui("dm.field.name")}</span>
        <input
          type="text"
          value={e.name}
          maxLength={80}
          onInput={(ev) => {
            const name = ev.currentTarget.value;
            updateEncounter((x) => ({ ...x, name }));
          }}
        />
      </label>
      <div class="btn-row dm-bar-buttons">
        <button type="button" onClick={() => void newEncounter()}>
          {ui("dm.new")}
        </button>
        <button
          type="button"
          title={ui("dm.duplicateHint")}
          onClick={() => void duplicateEncounter()}
        >
          {ui("dm.duplicate")}
        </button>
        <button type="button" class="danger-btn" onClick={() => void removeEncounter()}>
          {ui("dm.remove")}
        </button>
      </div>
    </div>
  );
}

function Controls({ e }: { e: Encounter }) {
  const started = isStarted(e);
  const active = activeCombatant(e);
  const waiting = e.combatants.filter((c) => c.initiative === undefined).length;
  const ended = lastTurn.value;
  const endedName = ended ? e.combatants.find((c) => c.id === ended.combatant)?.name : undefined;
  const conditionNames = ended
    ? ended.conditions.map((id) => content.value?.name(id) ?? id).join(", ")
    : "";
  return (
    <div class="dm-controls">
      <output class="dm-status">
        {started ? (
          <>
            <b class="dm-round">{ui("dm.round", { n: e.round })}</b>
            {active && <span>{ui("dm.turnOf", { name: active.name })}</span>}
          </>
        ) : (
          <span class="muted">{ui("dm.notStarted")}</span>
        )}
        {waiting > 0 && e.combatants.length > 0 && (
          <span class="muted">{ui("dm.waiting", { n: waiting })}</span>
        )}
      </output>
      {ended && endedName && (
        <output class="dm-ended">
          {ui("dm.endedOn", { name: endedName, list: conditionNames })}
        </output>
      )}
      <div class="btn-row">
        {started ? (
          <>
            <button type="button" disabled={!canGoBack()} onClick={previousTurn}>
              {ui("dm.previous")}
            </button>
            <button type="button" class="primary dm-next" onClick={advanceTurn}>
              {ui("dm.next")}
            </button>
            <button
              type="button"
              onClick={() => {
                resetTurnHistory();
                updateEncounter(endCombat);
              }}
            >
              {ui("dm.end")}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={waiting === 0}
              onClick={() => updateEncounter((x) => rollAllInitiative(x))}
            >
              {ui("dm.rollInitiative")}
            </button>
            <button
              type="button"
              disabled={e.combatants.length === 0}
              onClick={() => {
                resetTurnHistory();
                updateEncounter(startCombat);
              }}
            >
              {ui("dm.start")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The Dungeon Master mode: prepare fights and run them (initiative, turns, hit points, conditions). */
export function DmPage() {
  useEffect(() => {
    // The monsters are a large pack: they come when this page is opened.
    monstersWanted.value = true;
    void loadDm();
  }, []);
  const e = encounter.value;
  const ruleset = dmRuleset.value;
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
          <EncounterBar e={e} />
          <div class="dm-body" data-empty={e.combatants.length === 0 || undefined}>
            <section class="dm-tracker" aria-label={ui("dm.tracker")}>
              <Controls e={e} />
              {e.combatants.length === 0 ? (
                <p class="dm-empty muted">{ui("dm.empty")}</p>
              ) : (
                <ol class="plain dm-order">
                  {initiativeOrder(e.combatants).map((c) => (
                    <CombatantCard key={c.id} c={c} active={c.id === e.turn} ruleset={ruleset} />
                  ))}
                </ol>
              )}
            </section>
            <aside class="dm-side">
              <AddCreatures />
            </aside>
          </div>
        </>
      )}
    </article>
  );
}
