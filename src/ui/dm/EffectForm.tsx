import { useState } from "preact/hooks";
import { dmRuleset } from "../../app/dm";
import { saveEffect } from "../../app/dmEffects";
import { ABILITIES, type Effect } from "../../data/schema";
import { parseDice } from "../../engine/dice";
import {
  type EnvironmentRule,
  MAX_DC,
  MAX_DICE_LENGTH,
  MAX_ROUNDS,
  type TrackedEffect,
} from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { NOT_FREE } from "../play/ActiveEffects";
import { EffectList } from "../studio/Effects";
import { DamageTypeChips, conditionName, conditionOptions } from "./Editors";
import { NumberField } from "./NumberField";
import { abilityLabel } from "./environmentLine";

type NewEffect = Omit<TrackedEffect, "id">;
type Ability = NonNullable<EnvironmentRule["save"]>["ability"];

function RoundsInput({
  label,
  value,
  onChange,
}: { label: string; value: number | undefined; onChange: (n: number | undefined) => void }) {
  return (
    <div class="field">
      <span>{label}</span>
      <NumberField
        label={label}
        placeholder="—"
        min={0}
        max={MAX_ROUNDS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

/** What an effect of the lair does when it is applied: the damage, the save and the condition, each if wanted. */
function RuleFields({
  rule,
  dice,
  setDice,
  onChange,
}: {
  rule: EnvironmentRule;
  dice: string;
  setDice: (text: string) => void;
  onChange: (rule: EnvironmentRule) => void;
}) {
  const { damage: _d, save, condition, ...rest } = rule;
  const set = (part: Partial<EnvironmentRule>) => onChange({ ...rule, ...part });
  const options = conditionOptions(dmRuleset.value);
  // A condition kept from the other edition stays in the list while it is the one chosen.
  const listed =
    !condition || options.some((o) => o.id === condition.id)
      ? options
      : [{ id: condition.id, name: conditionName(condition.id) }, ...options];
  const bad = dice.trim() !== "" && !parseDice(dice);
  return (
    <>
      <label class="field">
        <span>{ui("dm.env.dice")}</span>
        <input
          type="text"
          maxLength={MAX_DICE_LENGTH}
          value={dice}
          placeholder="2d6"
          aria-invalid={bad || undefined}
          onInput={(e) => setDice(e.currentTarget.value)}
        />
        {bad && <small class="error">{ui("dm.env.badDice")}</small>}
      </label>
      {dice.trim() !== "" && (
        <div class="dm-manual-name">
          <DamageTypeChips
            value={rule.damage?.type}
            onChange={(type) => set({ damage: { dice, ...(type && { type }) } })}
          />
        </div>
      )}
      <label class="field">
        <span>{ui("dm.env.save")}</span>
        <select
          value={save?.ability ?? ""}
          onChange={(e) => {
            const ability = e.currentTarget.value;
            if (!ability) {
              onChange({ ...rest, ...(_d && { damage: _d }), ...(condition && { condition }) });
              return;
            }
            set({
              save: { ability: ability as Ability, dc: save?.dc ?? 13, half: save?.half ?? true },
            });
          }}
        >
          <option value="">{ui("dm.env.noSave")}</option>
          {ABILITIES.map((a) => (
            <option key={a} value={a}>
              {abilityLabel(a)}
            </option>
          ))}
        </select>
      </label>
      {save && (
        <>
          <div class="field">
            <span>{ui("dm.env.dc")}</span>
            <NumberField
              label={ui("dm.env.dc")}
              min={1}
              max={MAX_DC}
              value={save.dc}
              onChange={(n) => n !== undefined && set({ save: { ...save, dc: n } })}
            />
          </div>
          <label class="dm-check">
            <input
              type="checkbox"
              checked={save.half}
              onChange={(e) => set({ save: { ...save, half: e.currentTarget.checked } })}
            />
            <span>{ui("dm.env.half")}</span>
          </label>
        </>
      )}
      <label class="field">
        <span>{ui("dm.env.condition")}</span>
        <select
          value={condition?.id ?? ""}
          onChange={(e) => {
            const id = e.currentTarget.value;
            if (id) set({ condition: { ...condition, id } });
            else onChange({ ...rest, ...(_d && { damage: _d }), ...(save && { save }) });
          }}
        >
          <option value="">{ui("dm.env.noCondition")}</option>
          {listed.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      {condition && (
        <RoundsInput
          label={ui("dm.env.conditionRounds")}
          value={condition.rounds}
          onChange={(n) => set({ condition: { id: condition.id, ...(n && { rounds: n }) } })}
        />
      )}
    </>
  );
}

/**
 * An effect written by hand: for a creature (what it changes in its numbers) or for the lair (what it does to
 * those inside). `initial` is a kept effect being changed.
 */
export function EffectForm({
  environment,
  initial,
  submit,
  offerSave,
  onSubmit,
  onCancel,
}: {
  environment: boolean;
  initial?: NewEffect;
  submit: string;
  /** Asks whether to keep it for other fights too. */
  offerSave?: boolean;
  onSubmit: (effect: NewEffect) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [rounds, setRounds] = useState<number | undefined>(initial?.rounds);
  const [concentration, setConcentration] = useState(initial?.concentration ?? false);
  const [rules, setRules] = useState<Effect[]>(initial?.effects ?? []);
  const [rule, setRule] = useState<EnvironmentRule>(initial?.environment ?? {});
  const [dice, setDice] = useState(initial?.environment?.damage?.dice ?? "");
  const [shown, setShown] = useState(false);
  const [keep, setKeep] = useState(false);
  const [full, setFull] = useState(false);
  const badDice = environment && dice.trim() !== "" && !parseDice(dice);
  return (
    <form
      class="dm-add-body dm-manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || badDice) return;
        const { damage, ...others } = rule;
        const effect: NewEffect = {
          name: name.trim(),
          ...(note.trim() && { note: note.trim() }),
          ...(rounds && { rounds }),
          ...(environment
            ? {
                environment: {
                  ...others,
                  ...(dice.trim() && {
                    damage: { dice: dice.trim(), ...(damage?.type && { type: damage.type }) },
                  }),
                  ...(shown && { shown: true }),
                },
              }
            : {
                ...(initial?.spell && { spell: initial.spell }),
                ...(concentration && { concentration: true }),
                ...(rules.length > 0 && { effects: rules }),
              }),
        };
        if (keep && saveEffect(effect) === "full") {
          setFull(true);
          setKeep(false);
          return;
        }
        onSubmit(effect);
      }}
    >
      <label class="field dm-manual-name">
        <span>{ui("dm.effect.name")}</span>
        <input
          type="text"
          maxLength={80}
          value={name}
          placeholder={ui(environment ? "dm.env.namePlaceholder" : "dm.effect.namePlaceholder")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>
      <label class="field dm-manual-name">
        <span>{ui("dm.effect.note")}</span>
        <input
          type="text"
          maxLength={200}
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </label>
      <RoundsInput label={ui("play.conditionRounds")} value={rounds} onChange={setRounds} />
      {environment ? (
        <RuleFields rule={rule} dice={dice} setDice={setDice} onChange={setRule} />
      ) : (
        <>
          <label class="dm-check">
            <input
              type="checkbox"
              checked={concentration}
              onChange={(e) => setConcentration(e.currentTarget.checked)}
            />
            <span>{ui("dm.effect.concentration")}</span>
          </label>
          <div class="dm-manual-name dm-effect-rules">
            <h4>{ui("dm.effect.numbersTitle")}</h4>
            <p class="muted">{ui("dm.effect.numbersHint")}</p>
            <EffectList effects={rules} onChange={setRules} hidden={NOT_FREE} />
          </div>
        </>
      )}
      {environment && offerSave && (
        <label class="dm-check">
          <input
            type="checkbox"
            checked={shown}
            onChange={(e) => setShown(e.currentTarget.checked)}
          />
          <span>{ui("dm.env.show")}</span>
        </label>
      )}
      {offerSave && (
        <label class="dm-check">
          <input
            type="checkbox"
            checked={keep}
            onChange={(e) => setKeep(e.currentTarget.checked)}
          />
          <span>{ui("dm.saved.keep")}</span>
        </label>
      )}
      {full && <p class="dm-manual-name error">{ui("dm.saved.full")}</p>}
      <button type="submit" class="dm-manual-add" disabled={!name.trim() || badDice}>
        {submit}
      </button>
      {onCancel && (
        <button type="button" class="secondary dm-manual-name" onClick={onCancel}>
          {ui("confirm.cancel")}
        </button>
      )}
    </form>
  );
}
