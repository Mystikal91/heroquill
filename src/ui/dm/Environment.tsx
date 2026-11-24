import {
  applyEnvironmentFlow,
  areaAmount,
  areaPicks,
  editCombatant,
  effectFor,
  encounter,
  environmentFlow,
  leaveArea,
  pickCreatures,
  rollEnvironmentDamage,
  rollEnvironmentSaves,
  startEnvironment,
} from "../../app/dm";
import {
  type Combatant,
  MAX_HP,
  type TrackedEffect,
  removeEffect,
  setEffectShown,
} from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { NumberField } from "./NumberField";
import { environmentLine } from "./environmentLine";

/** The button that applies an effect of the lair, when there is something to apply. */
export function EnvironmentApply({
  c,
  effect,
  named,
}: {
  c: Combatant;
  effect: TrackedEffect;
  /** The button says which effect (where it stands alone). */
  named?: boolean;
}) {
  const rule = effect.environment;
  if (!rule?.damage && !rule?.condition) return null;
  return (
    <button type="button" onClick={() => startEnvironment(c, effect)}>
      {ui("dm.env.apply")}
      {named && `: ${effect.name}`}
    </button>
  );
}

/** The effects the lair carries, as cards: the rounds left, what each does, applying it and showing it to the players. */
export function EnvironmentCards({ c }: { c: Combatant }) {
  return (
    <section class="dm-panel-actions">
      <h4>{ui("dm.env.title")}</h4>
      {c.effects.map((x) => {
        const line = x.environment ? environmentLine(x.environment) : "";
        return (
          <div key={x.id} class="dm-action-card dm-env-card">
            <div class="dm-env-head">
              <b>
                {x.name}
                {x.rounds !== undefined && (
                  <small> · {ui("play.roundsLeft", { n: x.rounds })}</small>
                )}
              </b>
              <button
                type="button"
                class="dm-fx-x"
                aria-label={ui("dm.endEffect", { name: x.name })}
                onClick={() => editCombatant(c.id, (y) => removeEffect(y, x.id))}
              >
                ✕
              </button>
            </div>
            {line && <small>{line}</small>}
            {x.note && <p>{x.note}</p>}
            <div class="dm-action-rolls">
              <EnvironmentApply c={c} effect={x} />
            </div>
            {x.environment && (
              <label class="dm-check">
                <input
                  type="checkbox"
                  checked={x.environment.shown === true}
                  onChange={(e) => {
                    const on = e.currentTarget.checked;
                    editCombatant(c.id, (y) => setEffectShown(y, x.id, on));
                  }}
                />
                <span>{ui("dm.env.show")}</span>
              </label>
            )}
          </div>
        );
      })}
      <button
        type="button"
        class="dm-add-effect"
        onClick={() => {
          effectFor.value = c.id;
        }}
      >
        {ui("dm.env.add")}
      </button>
    </section>
  );
}

/**
 * Applying an effect of the lair: who is inside is marked in the table, the saves are rolled (the players at
 * the table are asked), then the damage, and everything lands in one step.
 */
export function EnvironmentPanel() {
  const flow = environmentFlow.value;
  if (!flow) return null;
  const { rule } = flow;
  const picks = Object.entries(areaPicks.value);
  const full = picks.filter(([, p]) => p === "fail").length;
  const names = new Map((encounter.value?.combatants ?? []).map((c) => [c.id, c.name]));
  // A player's answer is waited for; marking them by hand goes on without it.
  const ready =
    picks.length > 0 &&
    Object.keys(flow.asked).length === 0 &&
    (Boolean(rule.condition) || (Boolean(rule.damage) && areaAmount.value > 0));
  return (
    <section class="dm-area" aria-label={flow.name}>
      <h4>{flow.name}</h4>
      <p class="muted">{environmentLine(rule)}</p>
      <p class="muted">{ui(rule.save ? "dm.env.hintSave" : "dm.env.hint")}</p>
      {(Object.keys(flow.saves).length > 0 || Object.keys(flow.asked).length > 0) && (
        <ul class="plain dm-env-saves">
          {Object.entries(flow.saves).map(([id, s]) => (
            <li key={id} data-passed={s.passed || undefined}>
              {`${names.get(id) ?? ""}: ${s.total !== undefined ? `${s.total} · ` : ""}${ui(s.passed ? "dm.prop.success" : "dm.prop.failure")}`}
            </li>
          ))}
          {Object.keys(flow.asked).map((id) => (
            <li key={id}>{`${names.get(id) ?? ""}: ${ui("dm.prop.waiting")}`}</li>
          ))}
        </ul>
      )}
      {rule.damage && (
        <div class="dm-env-damage">
          <NumberField
            label={ui("play.amount")}
            placeholder={ui("play.amount")}
            min={0}
            max={MAX_HP}
            value={areaAmount.value || undefined}
            onChange={(n) => {
              areaAmount.value = n ?? 0;
            }}
          />
          <button type="button" onClick={rollEnvironmentDamage}>
            {ui("dm.env.rollDamage")}
          </button>
        </div>
      )}
      <div class="dm-area-actions">
        <button type="button" onClick={pickCreatures}>
          {ui("dm.area.all")}
        </button>
        {rule.save && (
          <button type="button" disabled={picks.length === 0} onClick={rollEnvironmentSaves}>
            {ui("dm.env.rollSaves")}
          </button>
        )}
        <output class="dm-area-count">
          {rule.save
            ? ui("dm.env.count", { fail: full, save: picks.length - full })
            : ui("dm.env.inside", { n: picks.length })}
        </output>
        <button type="button" class="primary" disabled={!ready} onClick={applyEnvironmentFlow}>
          {ui("dm.env.applyTo", { n: picks.length })}
        </button>
        <button type="button" class="secondary" onClick={leaveArea}>
          {ui("confirm.cancel")}
        </button>
      </div>
    </section>
  );
}
