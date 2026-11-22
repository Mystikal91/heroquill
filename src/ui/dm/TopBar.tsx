import {
  abilityName,
  advanceTurn,
  campaign,
  campaignEncounters,
  canGoBack,
  delayActive,
  dmSection,
  duplicateEncounter,
  endFight,
  groupInitiative,
  infoFor,
  initiativeWait,
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
  startNow,
  startRoll,
  updateEncounter,
} from "../../app/dm";
import { diceOpen } from "../../app/playView";
import { content } from "../../app/store";
import { tableCode, tableState, tableUnread, tableView } from "../../app/table";
import { combatantNumbers } from "../../engine/combatantNumbers";
import {
  type Combatant,
  type Encounter,
  activeCombatant,
  isStarted,
  laterCombatants,
  rollAllInitiative,
} from "../../engine/encounter";
import { actionRolls, resolveRolls } from "../../engine/monsterRolls";
import { signed, ui } from "../../i18n/ui";
import { Popover } from "../Popover";
import { TableChipFace } from "../TableChip";
import { PlusIcon, StepBackIcon, StepForwardIcon, SwordsIcon } from "../icons";
import { abilitiesOf } from "./Abilities";
import { CellPopover } from "./CellPopover";
import { ColumnsEditor } from "./ColumnsEditor";
import { TableBlock } from "./TableBlock";

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
          <button type="button" class="danger-btn dm-menu-end" onClick={endFight}>
            {ui("dm.end")}
          </button>
        )}
      </div>
    </Popover>
  );
}

/**
 * The online table of the campaign, in the header beside the menu: a pill that is always there (a crossed sign while
 * no table is open) and opens the table itself in a panel: open it, the code, who is there, what they share.
 */
export function OnlineChip() {
  const code = tableCode.value;
  const state = tableState.value;
  const open = campaign.value;
  const live = Boolean(code) && state !== "ended";
  const here = tableView.value.players.filter((p) => p.online).length;
  const seats = Math.max(open?.party.length ?? 0, tableView.value.players.length);
  return (
    <CellPopover
      id="dm-online-table"
      title={ui("dm.table.title")}
      class="table-chip"
      align="end"
      trigger={
        live ? (
          <TableChipFace
            state={state}
            code={code}
            count={ui("dm.online.here", { n: here, max: seats })}
            short={String(here)}
            badge={tableUnread.value}
          />
        ) : (
          <TableChipFace state="offline" label={ui("table.closed")} />
        )
      }
    >
      {() => (open ? <TableBlock campaignId={open.id} /> : null)}
    </CellPopover>
  );
}

/**
 * The line at the top of the DM page: the campaign and the encounter (its menu), the two parts as
 * tabs on a wide screen (a phone has them at the bottom), the online table and, in the fight, the
 * tools that change who is in the table.
 */
export function ContextBar({ e }: { e: Encounter }) {
  const fight = dmSection.value === "encounter";
  return (
    <div class="dm-context">
      <nav class="dm-crumbs" aria-label={ui("dm.where")}>
        <button
          type="button"
          class="dm-crumb"
          onClick={() => {
            dmSection.value = "campaign";
          }}
        >
          {campaign.value?.name.trim() || ui("dm.unnamed")}
        </button>
        <span class="dm-crumb-sep" aria-hidden="true">
          /
        </span>
        <EncounterMenu e={e} />
      </nav>
      <nav class="dm-inline-tabs" aria-label={ui("dm.title")}>
        {(["campaign", "encounter"] as const).map((id) => (
          <button
            type="button"
            key={id}
            aria-current={dmSection.value === id ? "page" : undefined}
            onClick={() => {
              dmSection.value = id;
            }}
          >
            {ui(id === "campaign" ? "dm.section.campaign" : "dm.section.encounter")}
          </button>
        ))}
      </nav>
      <span class="dm-context-gap" />
      {fight && (
        <div class="dm-bar-tools">
          <button
            type="button"
            class="dm-tool"
            aria-keyshortcuts="A"
            aria-label={ui("dm.add")}
            title={`${ui("dm.add")} (A)`}
            onClick={openAdd}
          >
            <PlusIcon />
            <span class="dm-tool-label">{ui("dm.addShort")}</span>
            <kbd class="dm-kbd">A</kbd>
          </button>
          <button
            type="button"
            class="dm-tool"
            aria-label={ui("dm.area")}
            title={ui("dm.area.hint")}
            disabled={e.combatants.length === 0}
            onClick={startArea}
          >
            <SwordsIcon />
            <span class="dm-tool-label">{ui("dm.area")}</span>
          </button>
          <ColumnsEditor />
        </div>
      )}
      <button
        type="button"
        class="dm-tool dm-dice"
        title={ui("play.dice")}
        aria-label={ui("play.dice")}
        onClick={() => {
          diceOpen.value = true;
        }}
      >
        d20
      </button>
    </div>
  );
}

/**
 * The buttons that move the fight: before it, rolling initiative and starting; during it, delay,
 * back and the next turn. They are in the turn card on a wide screen and at the bottom of a phone.
 */
export function TurnButtons({ e }: { e: Encounter }) {
  const waiting = e.combatants.filter((c) => c.initiative === undefined).length;
  if (!isStarted(e))
    return (
      <div class="dm-turn-buttons">
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
          onClick={initiativeWait.value ? startNow : startFight}
        >
          {initiativeWait.value
            ? ui("dm.waitInitiative", { n: initiativeWait.value.length })
            : ui("dm.start")}
        </button>
      </div>
    );
  const later = laterCombatants(e);
  return (
    <div class="dm-turn-buttons">
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
        <span class="dm-advance-label">{ui("dm.nextShort")}</span>
        <StepForwardIcon />
        <kbd class="dm-kbd">N</kbd>
      </button>
    </div>
  );
}

/**
 * The attacks of the monster whose turn it is, as buttons in the card of the turn on a narrow screen
 * (a wide one has the whole stat block beside the table). One opens the roll window, as in the stat block.
 */
function TurnAttacks({ c }: { c: Combatant }) {
  const source = c.kind === "monster" ? c.source : undefined;
  const all = content.value;
  const actions =
    source && all
      ? ((all.index.get(source)?.data as { actions?: object[] } | undefined)?.actions ?? [])
      : [];
  const attacks = actions.flatMap((action, i) => {
    const rolls = resolveRolls(actionRolls(action), undefined);
    if (!rolls || rolls.attackBonus === undefined) return [];
    const name = all?.text(`${source}.actions.${i + 1}`, "name") ?? "";
    return [{ key: i, name, rolls }];
  });
  return (
    <div class="dm-turn-attacks">
      {attacks.map((a) => (
        <button type="button" key={a.key} onClick={() => startRoll(c, a.name, a.rolls)}>
          {a.name} {signed(a.rolls.attackBonus ?? 0)}
        </button>
      ))}
      <button
        type="button"
        class="dm-turn-details"
        onClick={() => {
          infoFor.value = c.id;
        }}
      >
        {ui("dm.panel.details")}
      </button>
    </div>
  );
}

/**
 * The card of the turn, above the table: the round and who acts now (on a narrow screen with their
 * hit points and armor class, and a button to their details), the turn buttons, the recharges to roll
 * and what ended with the last turn.
 */
export function TurnCard({ e }: { e: Encounter }) {
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
  const endedNames = ended
    ? [...ended.conditions.map((id) => content.value?.name(id) ?? id), ...ended.effects].join(", ")
    : "";
  const numbers = active ? combatantNumbers(active) : undefined;
  return (
    <div class="dm-turnbar" data-started={started || undefined}>
      <div class="dm-turn-row">
        {started ? (
          <>
            <div class="dm-round-box">
              <small>{ui("dm.roundWord")}</small>
              <b>{e.round}</b>
            </div>
            <output class="dm-status">
              <small class="muted">{ui("dm.nowActs")}</small>
              {active && <b class="dm-turn-of">{active.name}</b>}
            </output>
            {active && numbers && (
              <span class="dm-turn-mini">
                <span class="dm-turn-hp">
                  <b>{active.hp}</b> / {numbers.maxHp}
                </span>
                <span class="dm-turn-ac">
                  {ui("dm.col.ac")} {numbers.ac}
                </span>
              </span>
            )}
          </>
        ) : (
          <output class="dm-status">
            <span class="muted">
              {e.combatants.length === 0
                ? ui("dm.notStarted")
                : waiting > 0
                  ? ui("dm.waiting", { n: waiting })
                  : ui("dm.ready")}
            </span>
          </output>
        )}
        <div class="dm-turn-card-buttons">
          <TurnButtons e={e} />
        </div>
      </div>
      {started && active && <TurnAttacks c={active} />}
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
        <output class="dm-ended">{ui("dm.endedOn", { name: endedName, list: endedNames })}</output>
      )}
    </div>
  );
}
