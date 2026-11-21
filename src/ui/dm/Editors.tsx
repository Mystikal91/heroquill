import { useEffect, useRef, useState } from "preact/hooks";
import { dmRuleset, editCombatant } from "../../app/dm";
import { content } from "../../app/store";
import {
  type Combatant,
  MAX_HP,
  MAX_ROUNDS,
  giveTempHp,
  heal,
  hurt,
  setConditionRounds,
  toggleCondition,
} from "../../engine/encounter";
import { inRuleset } from "../../engine/rulesets";
import { ui } from "../../i18n/ui";
import { DamageButtons } from "../play/DamageButtons";
import { NumberField } from "./NumberField";

/** The conditions of the rules a creature can have, by name (exhaustion has levels and is left to the sheet). */
export function conditionOptions(ruleset: string): { id: string; name: string }[] {
  const c = content.value;
  if (!c) return [];
  return [...c.index.values()]
    .filter(
      (e) => e.kind === "condition" && inRuleset(e.id, ruleset) && !e.id.endsWith("/exhaustion"),
    )
    .map((e) => ({ id: e.id, name: c.name(e.id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const conditionName = (id: string) => content.value?.name(id) ?? id.split("/")[1] ?? id;

/** Hit points: the amount to type with Damage and Heal side by side, and the quick steps. */
export function HpEditor({ c, close }: { c: Combatant; close: () => void }) {
  const [amount, setAmount] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const percent = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
  const state = c.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  const apply = (change: (x: Combatant) => Combatant) => {
    editCombatant(c.id, change);
    close();
  };
  return (
    <div class="dm-hp-editor">
      <div class="dm-hp-top">
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
      <input
        ref={input}
        type="number"
        min={0}
        max={MAX_HP}
        inputMode="numeric"
        class="dm-amount"
        aria-label={ui("play.amount")}
        placeholder={ui("play.amount")}
        value={amount}
        onInput={(e) => setAmount(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && n > 0) apply((x) => hurt(x, n));
        }}
      />
      <div class="dm-hp-main">
        <DamageButtons
          amount={n}
          kinds={["normal"]}
          apply={(dealt) => apply((x) => hurt(x, dealt))}
        />
        <button type="button" disabled={n === 0} onClick={() => apply((x) => heal(x, n))}>
          {ui("play.heal")}
        </button>
      </div>
      <div class="dm-hp-second">
        <DamageButtons
          amount={n}
          kinds={["resistant", "vulnerable"]}
          apply={(dealt) => apply((x) => hurt(x, dealt))}
        />
        <button type="button" disabled={n === 0} onClick={() => apply((x) => giveTempHp(x, n))}>
          {ui("dm.tempHp")}
        </button>
      </div>
      <fieldset class="dm-hp-chips">
        <legend class="sr-only">{ui("dm.quick")}</legend>
        {[-5, -1, 1, 5].map((step) => (
          <button
            type="button"
            key={step}
            aria-label={
              step < 0 ? ui("play.damageBy", { n: -step }) : ui("play.healBy", { n: step })
            }
            onClick={() => editCombatant(c.id, (x) => (step < 0 ? hurt(x, -step) : heal(x, step)))}
          >
            {step < 0 ? `−${-step}` : `+${step}`}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** Conditions: every one of the rules as a chip to turn on, and the rounds of those in force. */
export function ConditionsEditor({ c }: { c: Combatant }) {
  const list = conditionOptions(dmRuleset.value);
  return (
    <div class="dm-cond-editor">
      <div class="dm-cond-chips">
        {list.map((x) => (
          <button
            type="button"
            key={x.id}
            class="dm-cond-chip"
            aria-pressed={c.conditions.includes(x.id)}
            onClick={() => editCombatant(c.id, (y) => toggleCondition(y, x.id))}
          >
            {x.name}
          </button>
        ))}
      </div>
      {c.conditions.length > 0 && (
        <ul class="plain dm-cond-rounds">
          {c.conditions.map((id) => (
            <li key={id}>
              <span>{conditionName(id)}</span>
              <span class="dm-rounds-field">
                <NumberField
                  label={`${ui("play.conditionRounds")}: ${conditionName(id)}`}
                  placeholder="—"
                  min={0}
                  max={MAX_ROUNDS}
                  value={c.rounds[id]}
                  onChange={(n) => editCombatant(c.id, (y) => setConditionRounds(y, id, n))}
                />
                <small>{ui("play.conditionRounds")}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
