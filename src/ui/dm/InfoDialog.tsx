import { editCombatant, encounter, infoFor, removeFromFight } from "../../app/dm";
import { type Combatant, MAX_HP, MAX_SPEED, setHp, setMaxHp } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { feetFrom, feetTo, metricUnits } from "../../i18n/units";
import { MonsterBlock } from "../rules/MonsterBlock";
import { EffectsEditor } from "./Editors";
import { Modal } from "./Modal";
import { NumberField } from "./NumberField";

function Details({ c }: { c: Combatant }) {
  const metric = metricUnits.value;
  return (
    <div class="dm-info-body">
      <label class="field">
        <span>{ui("dm.field.name")}</span>
        <input
          type="text"
          value={c.name}
          maxLength={80}
          onInput={(e) => {
            const name = e.currentTarget.value;
            editCombatant(c.id, (x) => ({ ...x, name }));
          }}
        />
      </label>
      <div class="dm-fields">
        <div class="field">
          <span>{ui("dm.field.hp")}</span>
          <NumberField
            label={ui("dm.field.hp")}
            min={0}
            max={c.maxHp}
            value={c.hp}
            onChange={(n) => n !== undefined && editCombatant(c.id, (x) => setHp(x, n))}
          />
        </div>
        <div class="field">
          <span>{ui("dm.field.maxHp")}</span>
          <NumberField
            label={ui("dm.field.maxHp")}
            min={1}
            max={MAX_HP}
            value={c.maxHp}
            onChange={(n) => n !== undefined && editCombatant(c.id, (x) => setMaxHp(x, n))}
          />
        </div>
        <div class="field">
          <span>{ui("sheet.armorClass")}</span>
          <NumberField
            label={ui("sheet.armorClass")}
            min={0}
            max={99}
            value={c.ac}
            onChange={(n) => n !== undefined && editCombatant(c.id, (x) => ({ ...x, ac: n }))}
          />
        </div>
        <div class="field">
          <span>{`${ui("dm.field.speed")} (${metric ? "m" : "ft"})`}</span>
          <NumberField
            label={ui("dm.field.speed")}
            min={0}
            max={metric ? Math.floor(feetTo(MAX_SPEED, true)) : MAX_SPEED}
            value={
              c.speed === undefined ? undefined : Math.round(feetTo(c.speed, metric) * 10) / 10
            }
            onChange={(n) =>
              editCombatant(c.id, (x) => {
                const { speed: _old, ...rest } = x;
                return n === undefined ? rest : { ...rest, speed: Math.round(feetFrom(n, metric)) };
              })
            }
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
              n !== undefined && editCombatant(c.id, (x) => ({ ...x, initiativeBonus: n }))
            }
          />
        </div>
      </div>
      <section>
        <h4>{ui("play.activeEffects")}</h4>
        <EffectsEditor c={c} />
      </section>
      <label class="field">
        <span>{ui("dm.notes")}</span>
        <textarea
          rows={3}
          value={c.notes}
          maxLength={2000}
          onInput={(e) => {
            const notes = e.currentTarget.value;
            editCombatant(c.id, (x) => ({ ...x, notes }));
          }}
        />
      </label>
      {c.kind === "monster" && c.source && (
        <section class="dm-statblock">
          <MonsterBlock id={c.source} />
        </section>
      )}
      <div class="dm-info-actions">
        <button type="button" class="danger-btn" onClick={() => removeFromFight(c.id)}>
          {ui("dm.removeCombatant")}
        </button>
      </div>
    </div>
  );
}

/** Everything about one creature: its numbers, conditions and notes, and the stat block of a monster. */
export function InfoDialog() {
  const c = encounter.value?.combatants.find((x) => x.id === infoFor.value);
  return (
    <Modal
      open={Boolean(c)}
      variant="side"
      title={c?.name || ui("dm.unnamed")}
      onClose={() => {
        infoFor.value = undefined;
      }}
    >
      {c && <Details c={c} />}
    </Modal>
  );
}
