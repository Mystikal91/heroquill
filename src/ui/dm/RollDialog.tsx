import {
  closeRoll,
  encounter,
  pickRollTarget,
  rollFlow,
  rollFlowAttack,
  rollFlowDamage,
} from "../../app/dm";
import { combatantNumbers } from "../../engine/combatantNumbers";
import { doubleDice } from "../../engine/monsterRolls";
import { signed, ui } from "../../i18n/ui";
import { damageLabel } from "../rules/ActionButtons";
import { Modal } from "./Modal";

/** Who can be picked: nobody, or any other creature of the encounter with its armor class. */
function Targets({ legend }: { legend: string }) {
  const flow = rollFlow.value;
  if (!flow) return null;
  const others = encounter.value?.combatants.filter((c) => c.id !== flow.attackerId) ?? [];
  return (
    <fieldset class="dm-roll-targets">
      <legend>{legend}</legend>
      <button
        type="button"
        class="secondary"
        aria-pressed={flow.target === undefined}
        onClick={() => pickRollTarget(undefined)}
      >
        {ui("dm.rollNoTarget")}
      </button>
      {others.map((c) => (
        <button
          type="button"
          class="secondary"
          key={c.id}
          aria-pressed={flow.target === c.id}
          onClick={() => pickRollTarget(c.id)}
        >
          {`${c.name} · ${ui("dm.col.ac")} ${combatantNumbers(c).ac}`}
        </button>
      ))}
    </fieldset>
  );
}

/**
 * The window of an action of a creature: who is attacked, the attack with its comparison to the armor class,
 * and, when it hit (or nobody was picked), the damage, which is taken off whoever the damage goes to.
 */
export function RollDialog() {
  const flow = rollFlow.value;
  const attack = flow?.attack;
  const attacking = flow?.bonus !== undefined;
  const missed = attack?.hit === false;
  const showDamage = flow !== undefined && (!attacking || (attack !== undefined && !missed));
  const verdict = attack?.hit === undefined ? undefined : attack.hit ? "hit" : "miss";
  return (
    <Modal
      open={Boolean(flow)}
      variant="center"
      title={flow ? `${flow.attackerName}: ${flow.action}` : ""}
      onClose={closeRoll}
    >
      {flow && (
        <div class="dm-roll">
          {(!attack || missed) && <Targets legend={ui("dm.rollTarget")} />}
          {attacking && (
            <div class="dm-roll-actions">
              {!attack && (
                <button type="button" class="primary" onClick={rollFlowAttack}>
                  {ui("monster.rollAttack", { bonus: signed(flow.bonus ?? 0) })}
                </button>
              )}
              {attack && missed && (
                <button type="button" class="primary" onClick={rollFlowAttack}>
                  {ui("dm.roll.again")}
                </button>
              )}
            </div>
          )}
          {attack && (
            <output class="dm-roll-result" data-verdict={verdict}>
              <span class="dm-roll-total">{attack.total}</span>
              <span>
                <b>
                  {attack.critical
                    ? ui("play.critical")
                    : attack.fumble
                      ? ui("play.fumble")
                      : verdict
                        ? ui(verdict === "hit" ? "dm.roll.hit" : "dm.roll.miss")
                        : ""}
                </b>
                <small>
                  {`d20 ${attack.natural}${attack.bonus === 0 ? "" : ` ${signed(attack.bonus)}`}`}
                  {attack.ac !== undefined && ` · ${ui("dm.roll.vs", { ac: attack.ac })}`}
                </small>
              </span>
            </output>
          )}
          {showDamage && (
            <section>
              <Targets legend={ui("dm.roll.damageTo")} />
              <div class="dm-roll-actions">
                {flow.damage.map((part) => {
                  const dice = attack?.critical ? doubleDice(part.dice) : part.dice;
                  return (
                    <button
                      type="button"
                      key={`${part.type}${part.dice}`}
                      class={attack?.critical ? "primary crit" : "primary"}
                      onClick={() => rollFlowDamage(part, (d) => damageLabel(part, d))}
                    >
                      {damageLabel(part, dice)}
                    </button>
                  );
                })}
              </div>
              {flow.lines.length > 0 && (
                <ul class="dm-roll-lines">
                  {flow.lines.map((line, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: lines are only appended
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
