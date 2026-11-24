import { editCombatant, encounter, infoFor, removeFromFight, startRoll } from "../../app/dm";
import { combatantNumbers } from "../../engine/combatantNumbers";
import {
  type Combatant,
  MAX_HP,
  MAX_SPEED,
  setHp,
  setMaxHp,
  setSurprised,
} from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { distance, feetFrom, feetTo, metricUnits } from "../../i18n/units";
import { MonsterBlock } from "../rules/MonsterBlock";
import { AbilitiesEditor, abilitiesOf } from "./Abilities";
import { AbilityRolls } from "./AbilityRolls";
import { EnvironmentCards } from "./Environment";
import { Modal } from "./Modal";
import { NumberField } from "./NumberField";
import { HpCell, kindLine } from "./TrackerTable";
import { PanelEffects, monsterLine } from "./TurnPanel";

function Details({ c }: { c: Combatant }) {
  const metric = metricUnits.value;
  const now = combatantNumbers(c);
  const changed = [
    now.ac !== c.ac && `${ui("dm.col.ac")} ${now.ac}`,
    now.speed !== c.speed && now.speed !== undefined && distance(now.speed),
    now.maxHp !== c.maxHp && `${ui("dm.field.maxHp")} ${now.maxHp}`,
    now.initiativeBonus !== c.initiativeBonus &&
      `${ui("dm.field.bonus")} ${now.initiativeBonus >= 0 ? "+" : ""}${now.initiativeBonus}`,
  ].filter(Boolean);
  const monster = c.kind === "monster" && c.source ? c.source : undefined;
  const bonus = now.initiativeBonus;
  return (
    <div class="dm-info-body">
      <p class="muted dm-info-kind">{monster ? monsterLine(monster) : kindLine(c)}</p>
      {!c.lair && (
        <>
          <div class="dm-panel-stats dm-info-stats">
            <div class="dm-panel-stat dm-panel-stat-hp">
              <small title={ui("dm.field.hp")}>{ui("dm.col.hp")}</small>
              <HpCell c={c} />
            </div>
            <div class="dm-panel-stat">
              <small title={ui("sheet.armorClass")}>{ui("dm.col.ac")}</small>
              <b>{now.ac}</b>
            </div>
            <div class="dm-panel-stat">
              <small title={ui("dm.field.speed")}>{ui("dm.col.speed")}</small>
              <b>{now.speed !== undefined ? distance(now.speed) : "—"}</b>
            </div>
            <div class="dm-panel-stat">
              <small title={ui("dm.field.bonus")}>{ui("dm.col.init")}</small>
              <b>{bonus >= 0 ? `+${bonus}` : bonus}</b>
            </div>
          </div>
          <PanelEffects c={c} />
        </>
      )}
      {c.lair && <EnvironmentCards c={c} />}
      <AbilityRolls c={c} />
      {(abilitiesOf(c).defs.length > 0 || abilitiesOf(c).legendary) && (
        <section class="dm-info-section">
          <h4>{ui("dm.abilities")}</h4>
          <AbilitiesEditor c={c} />
        </section>
      )}
      {monster && (
        <section class="dm-statblock">
          <MonsterBlock
            id={monster}
            compact
            choose={(action, rolls) => startRoll(c, action, rolls)}
          />
        </section>
      )}
      <details class="dm-info-more" open={c.notes.trim() !== "" || undefined}>
        <summary>{ui("dm.notes")}</summary>
        <textarea
          rows={3}
          value={c.notes}
          maxLength={2000}
          aria-label={ui("dm.notes")}
          onInput={(e) => {
            const notes = e.currentTarget.value;
            editCombatant(c.id, (x) => ({ ...x, notes }));
          }}
        />
      </details>
      <details class="dm-info-more">
        <summary>{ui("dm.editNumbers")}</summary>
        <div class="dm-info-edit">
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
          {!c.lair && (
            <div class="dm-fields">
              <div class="field">
                <span>{ui("dm.field.hp")}</span>
                <NumberField
                  label={ui("dm.field.hp")}
                  min={0}
                  max={now.maxHp}
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
                    c.speed === undefined
                      ? undefined
                      : Math.round(feetTo(c.speed, metric) * 10) / 10
                  }
                  onChange={(n) =>
                    editCombatant(c.id, (x) => {
                      const { speed: _old, ...rest } = x;
                      return n === undefined
                        ? rest
                        : { ...rest, speed: Math.round(feetFrom(n, metric)) };
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
          )}
          {!c.lair && (
            <label class="dm-check">
              <input
                type="checkbox"
                checked={c.surprised === true}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  editCombatant(c.id, (x) => setSurprised(x, on));
                }}
              />
              <span>{ui("dm.surprisedField")}</span>
            </label>
          )}
          {changed.length > 0 && (
            <p class="dm-now">
              {ui("dm.now")} {changed.join(" · ")}
            </p>
          )}
        </div>
      </details>
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
