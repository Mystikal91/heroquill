import { useState } from "preact/hooks";
import { changeHp, infoFor, startRoll } from "../../app/dm";
import { challengeText, sizeText, typeText, usageText } from "../../app/monsterView";
import type { Usage } from "../../app/monsterView";
import { content } from "../../app/store";
import { combatantNumbers } from "../../engine/combatantNumbers";
import {
  type Combatant,
  type Encounter,
  MAX_HP,
  activeCombatant,
  canAct,
  heal,
  hurt,
  initiativeOrder,
  isStarted,
} from "../../engine/encounter";
import { actionRolls, resolveRolls } from "../../engine/monsterRolls";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { damageLabel } from "../rules/ActionButtons";
import { AbilitiesCell } from "./Abilities";
import { CellPopover } from "./CellPopover";
import { EffectsEditor, conditionName } from "./Editors";
import { HpCell, kindLine } from "./TrackerTable";

/** The ones who act after the active creature, wrapping round: who to get ready. */
function comingUp(e: Encounter, count: number): Combatant[] {
  const order = initiativeOrder(e.combatants).filter((c) => c.initiative !== undefined);
  const at = order.findIndex((c) => c.id === e.turn);
  if (at < 0) return [];
  const after = [...order.slice(at + 1), ...order.slice(0, at)];
  return after.filter((c) => canAct(c, e.round)).slice(0, count);
}

/** A number to type and Damage or Heal beside it: the plain change. The hit points open the full editor. */
function QuickHp({ c }: { c: Combatant }) {
  const [amount, setAmount] = useState("");
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const apply = (change: (x: Combatant) => Combatant) => {
    changeHp(c.id, change);
    setAmount("");
  };
  return (
    <div class="dm-panel-hp">
      <input
        type="number"
        min={0}
        max={MAX_HP}
        inputMode="numeric"
        aria-label={ui("play.amount")}
        placeholder={ui("play.amount")}
        value={amount}
        onInput={(ev) => setAmount(ev.currentTarget.value)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" && n > 0) apply((x) => hurt(x, n));
        }}
      />
      <button
        type="button"
        class="danger-btn"
        disabled={n === 0}
        onClick={() => apply((x) => hurt(x, n))}
      >
        {ui("play.damage")}
      </button>
      <button type="button" disabled={n === 0} onClick={() => apply((x) => heal(x, n))}>
        {ui("play.heal")}
      </button>
    </div>
  );
}

interface MonsterAction {
  usage?: Usage;
  attackBonus?: unknown;
  damage?: unknown;
}

interface MonsterFacts {
  size?: string;
  type?: string;
  subtype?: string;
  challenge?: number;
  actions?: MonsterAction[];
  bonusActions?: MonsterAction[];
  reactions?: MonsterAction[];
  legendary?: MonsterAction[];
}

const ACTION_SECTIONS = [
  ["actions", "monster.actions"],
  ["bonusActions", "monster.bonusActions"],
  ["reactions", "monster.reactions"],
  ["legendary", "monster.legendary"],
] as const;

/** The line under the name of a monster: size, type, alignment and challenge, as a stat block opens. */
function monsterLine(source: string): string {
  const all = content.value;
  const m = all?.index.get(source)?.data as MonsterFacts | undefined;
  if (!all || !m) return "";
  const subtype = m.subtype ? ` (${m.subtype.replace(/-/g, " ")})` : "";
  const kind = [m.size && sizeText(m.size), m.type && `${typeText(m.type)}${subtype}`]
    .filter(Boolean)
    .join(" ");
  return [
    [kind, all.text(source, "alignment")].filter(Boolean).join(", "),
    m.challenge !== undefined ? ui("dm.cr", { n: challengeText(m.challenge) }) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * What the monster can do on its turn, as cards: the name, the start of its text, and buttons that
 * open the roll window (the attack, then the damage), as the buttons of the stat block do.
 */
function ActionCards({ c, source }: { c: Combatant; source: string }) {
  const all = content.value;
  const m = all?.index.get(source)?.data as MonsterFacts | undefined;
  if (!all || !m) return null;
  return (
    <>
      {ACTION_SECTIONS.map(([key, title]) => {
        const list = m[key];
        if (!list?.length) return null;
        return (
          <section key={key} class="dm-panel-actions">
            <h4>{ui(title)}</h4>
            {list.map((action, i) => {
              const prefix = `${source}.${key}.${i + 1}`;
              const name = all.text(prefix, "name") ?? "";
              const desc = all.text(prefix, "desc")?.split("\n\n")[0];
              const usage = usageText(action.usage);
              const rolls = resolveRolls(actionRolls(action), undefined);
              return (
                <div key={prefix} class="dm-action-card">
                  <b>
                    {name}
                    {usage && <small> ({usage})</small>}
                  </b>
                  {desc && <p>{desc}</p>}
                  {rolls && (rolls.attackBonus !== undefined || rolls.damage.length > 0) && (
                    <div class="dm-action-rolls">
                      {rolls.attackBonus !== undefined && (
                        <button type="button" onClick={() => startRoll(c, name, rolls)}>
                          {ui("monster.rollAttack", { bonus: signed(rolls.attackBonus) })}
                        </button>
                      )}
                      {rolls.damage.map((part) => (
                        <button
                          type="button"
                          key={`${part.type}${part.dice}`}
                          class="dm-action-damage"
                          onClick={() =>
                            startRoll(c, name, { ...rolls, attackBonus: undefined, damage: [part] })
                          }
                        >
                          {damageLabel(part, part.dice)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}

/** What is in force on the creature, and the editor of it in a small window. */
function PanelEffects({ c }: { c: Combatant }) {
  const names = [...c.conditions.map(conditionName), ...c.effects.map((x) => x.name)];
  return (
    <div class="dm-panel-fx">
      {names.map((name) => (
        <span key={name} class="dm-panel-chip">
          {name}
        </span>
      ))}
      <CellPopover
        title={ui("dm.editConditions", { name: c.name })}
        class="dm-panel-add"
        align="end"
        trigger={<span>+ {ui("dm.panel.effects")}</span>}
      >
        {(close) => (
          <>
            <h4 class="dm-pop-title">{ui("play.activeEffects")}</h4>
            <EffectsEditor c={c} close={close} />
          </>
        )}
      </CellPopover>
    </div>
  );
}

/**
 * On a wide screen, beside the table: the creature whose turn it is, with its numbers, what is in
 * force on it, its limited abilities and, for a monster, the stat block whose actions roll.
 */
export function TurnPanel({ e }: { e: Encounter }) {
  const c = isStarted(e) ? activeCombatant(e) : undefined;
  if (!c)
    return (
      <aside class="dm-turn-panel" data-idle>
        <p class="muted">{ui("dm.panel.idle")}</p>
      </aside>
    );
  const numbers = combatantNumbers(c);
  const next = comingUp(e, 3);
  return (
    <aside class="dm-turn-panel" aria-label={ui("dm.panel.label", { name: c.name })}>
      <header class="dm-panel-head">
        <div>
          <h3>{c.name}</h3>
          <small class="muted">
            {c.kind === "monster" && c.source ? monsterLine(c.source) : kindLine(c)}
          </small>
        </div>
        <button
          type="button"
          class="secondary"
          onClick={() => {
            infoFor.value = c.id;
          }}
        >
          {ui("dm.panel.details")}
        </button>
      </header>
      {!c.lair && (
        <>
          <div class="dm-panel-stats">
            <div class="dm-panel-stat dm-panel-stat-hp">
              <small title={ui("dm.field.hp")}>{ui("dm.col.hp")}</small>
              <HpCell c={c} />
            </div>
            <div class="dm-panel-stat">
              <small title={ui("sheet.armorClass")}>{ui("dm.col.ac")}</small>
              <b>{numbers.ac}</b>
            </div>
            <div class="dm-panel-stat">
              <small title={ui("dm.field.speed")}>{ui("dm.col.speed")}</small>
              <b>{numbers.speed !== undefined ? distance(numbers.speed) : "—"}</b>
            </div>
          </div>
          <QuickHp key={c.id} c={c} />
          <PanelEffects c={c} />
        </>
      )}
      <div class="dm-panel-abilities">
        <AbilitiesCell c={c} />
      </div>
      {c.kind === "monster" && c.source && <ActionCards c={c} source={c.source} />}
      {c.notes.trim() && <p class="dm-panel-notes">{c.notes}</p>}
      {next.length > 0 && (
        <footer class="dm-panel-next">
          <small>{ui("dm.panel.next")}</small>
          {next.map((x) => (
            <span key={x.id} class="dm-panel-chip" data-kind={x.kind}>
              {x.name}
            </span>
          ))}
        </footer>
      )}
    </aside>
  );
}
