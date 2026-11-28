import { useEffect, useState } from "preact/hooks";
import {
  closeRoll,
  rollFlow,
  rollFlowAttack,
  rollFlowDamage,
  rollFlowToDamage,
} from "../../app/dm";
import { critMonsterDice } from "../../app/houseRules";
import { signed, ui } from "../../i18n/ui";
import { Die, putOnTop } from "../play/RollToast";
import { damageLabel } from "../rules/ActionButtons";

const ROLLING_MS = 560;

/**
 * The roll of an action, in the box a roll has, over the table: first it asks to pick who is attacked
 * (the table shows its pick circles), then the attack is rolled against their armor class, and then
 * the damage, which lands on whoever is picked when it is rolled.
 */
export function RollPanel() {
  const flow = rollFlow.value;
  // Each roll plays the die again: it spins and the numbers run for half a second, then the total settles.
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(0);
  const rolls = flow?.rolls ?? 0;
  const top = Math.max(20, flow?.last ?? 20);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new roll is the trigger, the top of the numbers is read then
  useEffect(() => {
    if (rolls === 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setRolling(false);
      return;
    }
    setRolling(true);
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * top)), 55);
    const stop = setTimeout(() => {
      clearInterval(spin);
      setRolling(false);
    }, ROLLING_MS);
    return () => {
      clearInterval(spin);
      clearTimeout(stop);
    };
  }, [rolls]);
  if (!flow) return null;
  const { attack } = flow;
  const damaging = flow.step === "damage";
  const anyHit = attack?.results.some((r) => r.hit) ?? false;
  const picked = flow.targets.length;
  const tone = rolling ? "" : attack?.critical ? "critical" : attack?.fumble ? "fumble" : "";
  const hint = damaging
    ? ui("dm.roll.damageTo")
    : attack
      ? `d20 ${attack.natural}${attack.bonus === 0 ? "" : ` ${signed(attack.bonus)}`}`
      : ui("dm.rollTarget");
  return (
    <div
      class={`roll-toast ${rolling ? "rolling" : "settled"} dm-roll-panel no-print ${tone}`}
      ref={putOnTop}
      aria-live="polite"
    >
      <div class="toast-main">
        <Die />
        {flow.last !== undefined && <span class="toast-number">{rolling ? face : flow.last}</span>}
        <span class="toast-text">
          <b>{`${flow.attackerName}: ${flow.action}`}</b>
          <small class="wrap">{hint}</small>
          {(damaging || !attack) && <small>{ui("dm.roll.count", { n: picked })}</small>}
          {tone && !damaging && !rolling && (
            <em class="toast-tone">{ui(tone === "critical" ? "play.critical" : "play.fumble")}</em>
          )}
        </span>
      </div>
      {!rolling && attack && !damaging && attack.results.length > 0 && (
        <ul class="dm-roll-lines">
          {attack.results.map((r) => (
            <li key={r.id} data-hit={r.hit}>
              {`${r.name} · ${ui("dm.col.ac")} ${r.ac} · ${ui(r.hit ? "dm.roll.hit" : "dm.roll.miss")}`}
            </li>
          ))}
        </ul>
      )}
      {!rolling && damaging && flow.lines.length > 0 && (
        <ul class="dm-roll-lines">
          {flow.lines.map((line, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are only appended
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <div class="toast-actions">
        {!damaging && !attack && (
          <button type="button" class="toast-act" onClick={rollFlowAttack}>
            {ui("monster.rollAttack", { bonus: signed(flow.bonus ?? 0) })}
          </button>
        )}
        {!damaging && attack && (anyHit || attack.results.length === 0) && (
          <button type="button" class="toast-act" onClick={rollFlowToDamage}>
            {ui("dm.roll.damage")}
          </button>
        )}
        {!damaging && attack && !anyHit && attack.results.length > 0 && (
          <button type="button" class="toast-act" onClick={rollFlowAttack}>
            {ui("dm.roll.again")}
          </button>
        )}
        {damaging &&
          flow.damage.map((part) => {
            const dice = attack?.critical ? critMonsterDice(part.dice) : part.dice;
            return (
              <button
                type="button"
                key={`${part.type}${part.dice}`}
                class="toast-act"
                onClick={() => rollFlowDamage(part, (d) => damageLabel(part, d))}
              >
                {damageLabel(part, dice)}
              </button>
            );
          })}
        <button type="button" class="toast-act quiet" onClick={closeRoll}>
          {ui("spells.closeInfo")}
        </button>
      </div>
    </div>
  );
}
