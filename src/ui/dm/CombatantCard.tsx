import { useState } from "preact/hooks";
import { openCombatant, removeFromFight, updateEncounter } from "../../app/dm";
import { content } from "../../app/store";
import {
  type Combatant,
  MAX_HP,
  MAX_ROUNDS,
  changeCombatant,
  giveTempHp,
  heal,
  hurt,
  isDown,
  rollInitiative,
  setConditionRounds,
  setHp,
  setInitiative,
  setMaxHp,
  toggleCondition,
} from "../../engine/encounter";
import { inRuleset } from "../../engine/rulesets";
import { ui } from "../../i18n/ui";
import { DamageButtons } from "../play/DamageButtons";
import { MonsterBlock } from "../rules/MonsterBlock";
import { NumberField } from "./NumberField";

const edit = (id: string, change: (c: Combatant) => Combatant) =>
  updateEncounter((e) => changeCombatant(e, id, change));

/** The conditions of the rules the DM can put on a creature, by name. */
function useConditionList(ruleset: string) {
  const c = content.value;
  if (!c) return [];
  return [...c.index.values()]
    .filter(
      (e) => e.kind === "condition" && inRuleset(e.id, ruleset) && !e.id.endsWith("/exhaustion"),
    )
    .map((e) => ({ id: e.id, name: c.name(e.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function Conditions({ c, ruleset }: { c: Combatant; ruleset: string }) {
  const list = useConditionList(ruleset);
  const name = (id: string) => content.value?.name(id) ?? id.split("/")[1] ?? id;
  const free = list.filter((x) => !c.conditions.includes(x.id));
  return (
    <div class="dm-conditions">
      {c.conditions.length > 0 && (
        <ul class="plain dm-chips">
          {c.conditions.map((id) => (
            <li key={id} class="dm-chip">
              <span>{name(id)}</span>
              <NumberField
                class="dm-rounds"
                label={`${ui("play.conditionRounds")}: ${name(id)}`}
                placeholder="—"
                min={0}
                max={MAX_ROUNDS}
                value={c.rounds[id]}
                onChange={(n) => edit(c.id, (x) => setConditionRounds(x, id, n))}
              />
              <button
                type="button"
                class="dm-chip-x"
                aria-label={`${ui("dm.removeCondition")}: ${name(id)}`}
                onClick={() => edit(c.id, (x) => toggleCondition(x, id))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {free.length > 0 && (
        <select
          aria-label={ui("play.addCondition")}
          value=""
          onChange={(e) => {
            const id = e.currentTarget.value;
            e.currentTarget.value = "";
            if (id) edit(c.id, (x) => toggleCondition(x, id));
          }}
        >
          <option value="">{ui("play.addCondition")}</option>
          {free.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function HitPoints({ c }: { c: Combatant }) {
  const [amount, setAmount] = useState("");
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const percent = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
  const state = c.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  const done = (change: (x: Combatant) => Combatant) => {
    edit(c.id, change);
    setAmount("");
  };
  return (
    <div class="dm-hp">
      <div class="dm-hp-line">
        <output class="dm-hp-readout">
          <b class={c.hp === 0 ? "zero" : ""}>{c.hp}</b>
          <span>{ui("play.of", { max: c.maxHp })}</span>
          {c.tempHp > 0 && <em>+{c.tempHp}</em>}
        </output>
        <div
          class="dm-hp-bar"
          data-state={state}
          role="img"
          aria-label={`${c.hp} ${ui("play.of", { max: c.maxHp })}`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div class="dm-hp-quick">
        {[10, 5, 1].map((step) => (
          <button
            type="button"
            key={`d${step}`}
            class="danger-btn"
            aria-label={ui("play.damageBy", { n: step })}
            onClick={() => edit(c.id, (x) => hurt(x, step))}
          >
            −{step}
          </button>
        ))}
        {[1, 5, 10].map((step) => (
          <button
            type="button"
            key={`h${step}`}
            aria-label={ui("play.healBy", { n: step })}
            onClick={() => edit(c.id, (x) => heal(x, step))}
          >
            +{step}
          </button>
        ))}
      </div>
      <div class="dm-hp-amount">
        <input
          type="number"
          min={0}
          max={MAX_HP}
          inputMode="numeric"
          aria-label={ui("play.amount")}
          placeholder={ui("play.amount")}
          value={amount}
          onInput={(e) => setAmount(e.currentTarget.value)}
        />
        <DamageButtons amount={n} apply={(dealt) => done((x) => hurt(x, dealt))} />
        <button type="button" disabled={n === 0} onClick={() => done((x) => heal(x, n))}>
          {ui("play.heal")}
        </button>
        <button type="button" disabled={n === 0} onClick={() => done((x) => giveTempHp(x, n))}>
          {ui("dm.tempHp")}
        </button>
      </div>
    </div>
  );
}

/** One creature of the fight: its place in the order, hit points, conditions and, for a monster, its stat block. */
export function CombatantCard({
  c,
  active,
  ruleset,
}: {
  c: Combatant;
  active: boolean;
  ruleset: string;
}) {
  const open = openCombatant.value === c.id;
  return (
    <li
      class="dm-card"
      data-active={active || undefined}
      data-down={isDown(c) || undefined}
      data-kind={c.kind}
      aria-current={active ? "step" : undefined}
    >
      <div class="dm-card-head">
        <div class="dm-init">
          <NumberField
            class="dm-init-input"
            label={ui("dm.initiative")}
            placeholder="—"
            min={-99}
            max={999}
            value={c.initiative}
            onChange={(n) => updateEncounter((e) => setInitiative(e, c.id, n))}
          />
          <button
            type="button"
            class="dm-roll"
            title={ui("dm.rollOne", {
              bonus: c.initiativeBonus >= 0 ? `+${c.initiativeBonus}` : String(c.initiativeBonus),
            })}
            aria-label={ui("dm.rollOne", {
              bonus: c.initiativeBonus >= 0 ? `+${c.initiativeBonus}` : String(c.initiativeBonus),
            })}
            onClick={() => updateEncounter((e) => setInitiative(e, c.id, rollInitiative(c).total))}
          >
            d20
          </button>
        </div>
        <div class="dm-name">
          <input
            type="text"
            class="dm-name-input"
            value={c.name}
            aria-label={ui("dm.field.name")}
            onInput={(e) => edit(c.id, (x) => ({ ...x, name: e.currentTarget.value }))}
          />
          <span class="dm-kind">
            {c.kind === "character" ? ui("dm.kind.character") : isDown(c) ? ui("dm.down") : ""}
          </span>
        </div>
        <div class="dm-ac">
          <span>{ui("dm.ac")}</span>
          <NumberField
            label={ui("sheet.armorClass")}
            min={0}
            max={99}
            value={c.ac}
            onChange={(n) => n !== undefined && edit(c.id, (x) => ({ ...x, ac: n }))}
          />
        </div>
        <button
          type="button"
          class="dm-remove"
          aria-label={`${ui("dm.removeCombatant")}: ${c.name}`}
          title={ui("dm.removeCombatant")}
          onClick={() => removeFromFight(c.id)}
        >
          ✕
        </button>
      </div>
      <HitPoints c={c} />
      <Conditions c={c} ruleset={ruleset} />
      <details
        class="dm-more"
        open={open}
        onToggle={(e) => {
          if (e.currentTarget.open) openCombatant.value = c.id;
          else if (openCombatant.value === c.id) openCombatant.value = undefined;
        }}
      >
        <summary>{c.kind === "monster" ? ui("dm.statBlock") : ui("dm.details")}</summary>
        {open && (
          <div class="dm-details">
            <div class="dm-fields">
              <div class="field">
                <span>{ui("dm.field.maxHp")}</span>
                <NumberField
                  label={ui("dm.field.maxHp")}
                  min={1}
                  max={MAX_HP}
                  value={c.maxHp}
                  onChange={(n) => n !== undefined && edit(c.id, (x) => setMaxHp(x, n))}
                />
              </div>
              <div class="field">
                <span>{ui("dm.field.hp")}</span>
                <NumberField
                  label={ui("dm.field.hp")}
                  min={0}
                  max={c.maxHp}
                  value={c.hp}
                  onChange={(n) => n !== undefined && edit(c.id, (x) => setHp(x, n))}
                />
              </div>
              <div class="field">
                <span>{ui("dm.field.bonus")}</span>
                <NumberField
                  label={ui("dm.field.bonus")}
                  min={-20}
                  max={30}
                  value={c.initiativeBonus}
                  onChange={(n) =>
                    n !== undefined && edit(c.id, (x) => ({ ...x, initiativeBonus: n }))
                  }
                />
              </div>
            </div>
            <label class="field">
              <span>{ui("dm.notes")}</span>
              <textarea
                rows={2}
                value={c.notes}
                maxLength={2000}
                onInput={(e) => edit(c.id, (x) => ({ ...x, notes: e.currentTarget.value }))}
              />
            </label>
            {c.kind === "monster" && c.source && <MonsterBlock id={c.source} />}
          </div>
        )}
      </details>
    </li>
  );
}
