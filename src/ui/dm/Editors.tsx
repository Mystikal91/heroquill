import { useEffect, useRef, useState } from "preact/hooks";
import {
  changeHp,
  conditionImmunities,
  defensesFor,
  dmRuleset,
  editCombatant,
  effectFor,
  toggleConditionOf,
  updateEncounter,
} from "../../app/dm";
import { content } from "../../app/store";
import { effectiveMaxHp } from "../../engine/combatantNumbers";
import { DAMAGE_KINDS, damageDealt } from "../../engine/defenses";
import {
  type Combatant,
  MAX_HP,
  MAX_ROUNDS,
  giveTempHp,
  heal,
  hurt,
  removeEffect,
  rollGroupInitiative,
  setConditionRounds,
  setEffectRounds,
  setInitiative,
  toggleCondition,
} from "../../engine/encounter";
import { inRuleset } from "../../engine/rulesets";
import { type UiKey, ui } from "../../i18n/ui";
import { damageName } from "../damageName";
import { effectLine } from "../play/ActiveEffects";
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

/** The kinds of damage as chips, one at a time (or none): what the amount is, so a resistance can be taken off. */
export function DamageTypeChips({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (kind: string | undefined) => void;
}) {
  return (
    <fieldset class="dm-types">
      <legend class="sr-only">{ui("dm.damageType")}</legend>
      {DAMAGE_KINDS.map((kind) => (
        <button
          type="button"
          key={kind}
          class="dm-type-chip"
          aria-pressed={value === kind}
          onClick={() => onChange(value === kind ? undefined : kind)}
        >
          {damageName(kind)}
        </button>
      ))}
    </fieldset>
  );
}

/** Hit points: the amount to type with Damage and Heal side by side, and the quick steps. */
export function HpEditor({ c, close }: { c: Combatant; close: () => void }) {
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<string | undefined>(undefined);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const maxHp = effectiveMaxHp(c);
  const result = damageDealt(Math.max(0, Number.parseInt(amount, 10) || 0), kind, defensesFor(c));
  const percent = maxHp > 0 ? Math.round((c.hp / maxHp) * 100) : 0;
  const state = c.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  const apply = (change: (x: Combatant) => Combatant) => {
    changeHp(c.id, change);
    close();
  };
  return (
    <div class="dm-hp-editor">
      <div class="dm-hp-top">
        <output class="dm-hp-readout">
          <b class={c.hp === 0 ? "zero" : ""}>{c.hp}</b>
          <span>{ui("play.of", { max: maxHp })}</span>
          {c.tempHp > 0 && <em>+{c.tempHp}</em>}
        </output>
        <div
          class="dm-hp-bar"
          data-state={state}
          role="img"
          aria-label={`${c.hp} ${ui("play.of", { max: maxHp })}`}
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
      <DamageTypeChips value={kind} onChange={setKind} />
      {result.applied.length > 0 && kind && (
        <p class="dm-defense-note">
          {result.applied
            .map((k) => ui(`dm.defense.${k}` as UiKey, { damage: damageName(kind) }))
            .join(" · ")}
        </p>
      )}
      <div class="dm-hp-main">
        <button
          type="button"
          class="danger-btn damage-kind"
          disabled={n === 0}
          onClick={() => apply((x) => hurt(x, result.dealt))}
        >
          {ui("play.damage")}
          {kind && result.dealt !== n && <small>→ {result.dealt}</small>}
        </button>
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
            onClick={() => changeHp(c.id, (x) => (step < 0 ? hurt(x, -step) : heal(x, step)))}
          >
            {step < 0 ? `−${-step}` : `+${step}`}
          </button>
        ))}
      </fieldset>
    </div>
  );
}

/** A small field for the rounds left of something in force; empty is no limit. */
function RoundsField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
}) {
  return (
    <span class="dm-rounds-field">
      <NumberField
        label={label}
        placeholder="—"
        min={0}
        max={MAX_ROUNDS}
        value={value}
        onChange={onChange}
      />
      <small>{ui("dm.rounds")}</small>
    </span>
  );
}

/**
 * What is in force on a creature, as the Active effects panel of the play screen has it: the conditions
 * and the effects with their rounds, the conditions of the rules to turn on, and the window that adds a
 * spell or an effect (a concentration, a note). `close` shuts the editor that holds this one, if any.
 */
export function EffectsEditor({ c, close }: { c: Combatant; close?: () => void }) {
  const list = conditionOptions(dmRuleset.value);
  const immune = conditionImmunities(c);
  const inForce = c.conditions.length + c.effects.length;
  return (
    <div class="dm-fx">
      <section>
        <h5 class="dm-fx-title">{ui("dm.inForce")}</h5>
        {inForce === 0 ? (
          <p class="muted dm-fx-none">{ui("dm.noEffects")}</p>
        ) : (
          <ul class="plain dm-fx-list">
            {c.conditions.map((id) => (
              <li key={id} class="dm-fx-item" data-condition={id.split("/")[1]}>
                <span class="dm-fx-name">{conditionName(id)}</span>
                <RoundsField
                  label={`${ui("play.conditionRounds")}: ${conditionName(id)}`}
                  value={c.rounds[id]}
                  onChange={(n) => editCombatant(c.id, (y) => setConditionRounds(y, id, n))}
                />
                <button
                  type="button"
                  class="dm-fx-x"
                  aria-label={ui("dm.endEffect", { name: conditionName(id) })}
                  onClick={() => editCombatant(c.id, (y) => toggleCondition(y, id))}
                >
                  ✕
                </button>
              </li>
            ))}
            {c.effects.map((x) => (
              <li key={x.id} class="dm-fx-item" data-focus={x.concentration || undefined}>
                <span class="dm-fx-name">
                  {x.name}
                  {x.concentration && <span class="dm-tag">{ui("dm.effect.concentration")}</span>}
                  {x.note && <small>{x.note}</small>}
                  {(x.effects ?? []).length > 0 && (
                    <small class="dm-fx-lines">
                      {(x.effects ?? []).map(effectLine).join(" · ")}
                    </small>
                  )}
                </span>
                <RoundsField
                  label={`${ui("play.conditionRounds")}: ${x.name}`}
                  value={x.rounds}
                  onChange={(n) => editCombatant(c.id, (y) => setEffectRounds(y, x.id, n))}
                />
                <button
                  type="button"
                  class="dm-fx-x"
                  aria-label={ui("dm.endEffect", { name: x.name })}
                  onClick={() => editCombatant(c.id, (y) => removeEffect(y, x.id))}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h5 class="dm-fx-title">{ui("play.conditions")}</h5>
        <div class="dm-cond-chips">
          {list.map((x) => (
            <button
              type="button"
              key={x.id}
              class="dm-cond-chip"
              data-condition={x.id.split("/")[1]}
              data-immune={immune.includes(x.id.split("/")[1] ?? "") || undefined}
              title={
                immune.includes(x.id.split("/")[1] ?? "")
                  ? ui("dm.immuneHint", { name: c.name })
                  : undefined
              }
              aria-pressed={c.conditions.includes(x.id)}
              onClick={() => toggleConditionOf(c, x.id)}
            >
              {x.name}
              {immune.includes(x.id.split("/")[1] ?? "") && <small> · {ui("dm.immuneTag")}</small>}
            </button>
          ))}
        </div>
      </section>
      <button
        type="button"
        class="dm-add-effect"
        onClick={() => {
          effectFor.value = c.id;
          close?.();
        }}
      >
        {ui("dm.addEffect")}
      </button>
    </div>
  );
}

/** Initiative: the number to type (Enter sets it) and the die to roll it; a value already set can be cleared. */
export function InitEditor({
  c,
  bonus,
  close,
  roll,
  groupSize,
}: {
  c: Combatant;
  bonus: string;
  close: () => void;
  roll: () => number;
  groupSize: number;
}) {
  const [text, setText] = useState(c.initiative === undefined ? "" : String(c.initiative));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);
  const apply = (value: number | undefined) => {
    updateEncounter((e) => setInitiative(e, c.id, value));
    close();
  };
  const typed = Number.parseInt(text, 10);
  return (
    <div class="dm-init-editor">
      <div class="dm-init-row">
        <input
          ref={input}
          type="number"
          class="dm-amount"
          inputMode="numeric"
          min={-99}
          max={999}
          aria-label={ui("dm.initiative")}
          placeholder={ui("dm.initiative")}
          value={text}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && Number.isFinite(typed)) apply(typed);
          }}
        />
        <button
          type="button"
          class="primary"
          disabled={!Number.isFinite(typed)}
          onClick={() => apply(typed)}
        >
          {ui("dm.initSet")}
        </button>
      </div>
      <button type="button" onClick={() => apply(roll())}>
        {ui("dm.initRoll", { bonus })}
      </button>
      {groupSize > 1 && (
        <button
          type="button"
          onClick={() => {
            updateEncounter((e) => rollGroupInitiative(e, c.id));
            close();
          }}
        >
          {ui("dm.initRollGroup", { n: groupSize, bonus })}
        </button>
      )}
      {c.initiative !== undefined && (
        <button type="button" class="secondary" onClick={() => apply(undefined)}>
          {ui("dm.initClear")}
        </button>
      )}
    </div>
  );
}
