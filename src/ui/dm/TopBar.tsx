import {
  abilityName,
  advanceTurn,
  campaign,
  campaignEncounters,
  canGoBack,
  delayActive,
  duplicateEncounter,
  endFight,
  groupInitiative,
  lastTurn,
  missingPlayers,
  newEncounter,
  offerParty,
  openAdd,
  previousTurn,
  rechargeNote,
  removeEncounter,
  resetCurrentFight,
  rollRechargeFor,
  selectEncounter,
  setGroupInitiative,
  startArea,
  startFight,
  updateEncounter,
} from "../../app/dm";
import { content } from "../../app/store";
import {
  type Encounter,
  activeCombatant,
  isStarted,
  laterCombatants,
  rollAllInitiative,
} from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { Popover } from "../Popover";
import { PlusIcon, StepBackIcon, StepForwardIcon, SwordsIcon } from "../icons";
import { abilitiesOf } from "./Abilities";
import { CellPopover } from "./CellPopover";
import { ColumnsEditor } from "./ColumnsEditor";

/** The encounter: which one, its name, and what can be done with it or with the fight. */
function EncounterMenu({ e }: { e: Encounter }) {
  const started = isStarted(e);
  return (
    <Popover
      align="start"
      class="dm-encounter"
      title={ui("dm.encounter")}
      label={
        <>
          <span class="dm-encounter-name">{e.name.trim() || ui("dm.unnamed")}</span>
          <span aria-hidden="true">▾</span>
        </>
      }
    >
      <div class="dm-menu">
        <h4 class="popover-heading">{ui("dm.encounters")}</h4>
        <ul class="plain dm-menu-list">
          {campaignEncounters.value.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                aria-current={x.id === e.id ? "true" : undefined}
                onClick={() => void selectEncounter(x.id)}
              >
                {x.name.trim() || ui("dm.unnamed")}
              </button>
            </li>
          ))}
        </ul>
        <label class="field">
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
        <label class="dm-check">
          <input
            type="checkbox"
            checked={groupInitiative.value}
            onChange={(ev) => setGroupInitiative(ev.currentTarget.checked)}
          />
          <span>{ui("dm.groupInit")}</span>
        </label>
        <div class="dm-menu-actions">
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
        {(campaign.value?.party.length ?? 0) > 0 && (
          <button type="button" class="secondary dm-menu-end" onClick={offerParty}>
            {ui("dm.addParty")}
          </button>
        )}
        <button
          type="button"
          class="secondary dm-menu-end"
          title={ui("dm.resetHint")}
          onClick={resetCurrentFight}
        >
          {ui("dm.reset")}
        </button>
        {started && (
          <button type="button" class="secondary dm-menu-end" onClick={endFight}>
            {ui("dm.end")}
          </button>
        )}
      </div>
    </Popover>
  );
}

/** The bar above the table: the encounter, the round and turn buttons, adding, and the columns. */
export function TopBar({ e }: { e: Encounter }) {
  const started = isStarted(e);
  const active = activeCombatant(e);
  const waiting = e.combatants.filter((c) => c.initiative === undefined).length;
  const ended = lastTurn.value;
  const endedName = ended ? e.combatants.find((c) => c.id === ended.combatant)?.name : undefined;
  const due =
    started && active
      ? abilitiesOf(active).defs.filter(
          (d) => d.kind === "recharge" && (active.uses?.[d.key] ?? 0) > 0,
        )
      : [];
  const later = started ? laterCombatants(e) : [];
  const endedNames = ended
    ? [...ended.conditions.map((id) => content.value?.name(id) ?? id), ...ended.effects].join(", ")
    : "";
  return (
    <>
      <div class="dm-bar">
        <div class="dm-bar-row">
          <EncounterMenu e={e} />
          <div class="dm-bar-tools">
            <button
              type="button"
              class="dm-tool"
              aria-keyshortcuts="A"
              title={`${ui("dm.add")} (A)`}
              onClick={openAdd}
            >
              <PlusIcon />
              <span class="dm-tool-label">{ui("dm.addShort")}</span>
            </button>
            <button
              type="button"
              class="dm-tool"
              title={ui("dm.area.hint")}
              disabled={e.combatants.length === 0}
              onClick={startArea}
            >
              <SwordsIcon />
              <span class="dm-tool-label">{ui("dm.area")}</span>
            </button>
            <ColumnsEditor />
          </div>
        </div>
      </div>
      <div class="dm-turnbar">
        <div class="dm-bar-row dm-turn-row">
          <output class="dm-status">
            {started ? (
              <>
                <b class="dm-round">{ui("dm.round", { n: e.round })}</b>
                {active && <span class="dm-turn-of">{ui("dm.turnOf", { name: active.name })}</span>}
              </>
            ) : (
              <span class="muted">
                {e.combatants.length === 0
                  ? ui("dm.notStarted")
                  : waiting > 0
                    ? ui("dm.waiting", { n: waiting })
                    : ui("dm.ready")}
              </span>
            )}
          </output>
          <div class="dm-turn-buttons">
            {started ? (
              <>
                {later.length > 0 && (
                  <CellPopover
                    title={ui("dm.delayHint")}
                    class="dm-delay"
                    align="end"
                    trigger={<span>{ui("dm.delay")}</span>}
                  >
                    {(close) => (
                      <div class="dm-menu">
                        <h4 class="dm-pop-title">{ui("dm.delay")}</h4>
                        <p class="muted">{ui("dm.delayHint")}</p>
                        <ul class="plain dm-menu-list">
                          {later.map((x) => (
                            <li key={x.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  delayActive(x.id);
                                  close();
                                }}
                              >
                                {ui("dm.delayAfter", { name: x.name, n: x.initiative ?? 0 })}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CellPopover>
                )}
                <button
                  type="button"
                  class="dm-prev"
                  disabled={!canGoBack()}
                  title={ui("dm.previous")}
                  aria-label={ui("dm.previous")}
                  onClick={previousTurn}
                >
                  <StepBackIcon />
                </button>
                <button
                  type="button"
                  class="primary dm-next dm-advance"
                  aria-keyshortcuts="N"
                  aria-label={ui("dm.next")}
                  title={`${ui("dm.next")} (N)`}
                  onClick={advanceTurn}
                >
                  <StepForwardIcon />
                  <span class="dm-advance-label">{ui("dm.next")}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={waiting === 0}
                  title={ui("dm.rollInitiativeHint")}
                  onClick={() =>
                    updateEncounter((x) => rollAllInitiative(x, { grouped: groupInitiative.value }))
                  }
                >
                  {ui("dm.rollInitiative")}
                </button>
                <button
                  type="button"
                  class="primary dm-next"
                  disabled={e.combatants.length === 0 && missingPlayers().length === 0}
                  onClick={startFight}
                >
                  {ui("dm.start")}
                </button>
              </>
            )}
          </div>
        </div>
        {due.length > 0 && active && (
          <div class="dm-recharge">
            {due.map((d) => (
              <button type="button" key={d.key} onClick={() => rollRechargeFor(active.id, d)}>
                {ui("dm.rollRecharge", { name: abilityName(active, d), min: d.minValue ?? 6 })}
              </button>
            ))}
          </div>
        )}
        {rechargeNote.value && <output class="dm-ended">{rechargeNote.value}</output>}
        {ended && endedName && (
          <output class="dm-ended">
            {ui("dm.endedOn", { name: endedName, list: endedNames })}
          </output>
        )}
      </div>
    </>
  );
}
