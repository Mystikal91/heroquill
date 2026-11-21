import { abilityName, editCombatant, monsterEntry, rollRechargeFor } from "../../app/dm";
import { parseDice } from "../../engine/dice";
import type { Combatant } from "../../engine/encounter";
import {
  type UseDef,
  legendaryOf,
  setLegendary,
  setUsesSpent,
  useDefs,
  usesSpent,
  usesTotal,
} from "../../engine/monsterUses";
import { ui } from "../../i18n/ui";
import { CellPopover } from "./CellPopover";

/** What a monster has that is counted: the abilities with a limit and its legendary actions. */
export function abilitiesOf(c: Combatant) {
  const data = monsterEntry(c)?.data;
  return { defs: data ? useDefs(data) : [], legendary: data ? legendaryOf(c, data) : undefined };
}

/** The faces of the die of a recharge, for "5-6". */
const faces = (dice: string | undefined) => (dice ? (parseDice(dice)?.terms[0]?.sides ?? 6) : 6);

function usageText(def: UseDef): string {
  if (def.kind === "perDay") return ui("dm.perDay", { n: def.times ?? 1 });
  if (def.kind === "recharge")
    return ui("dm.rechargeOn", { min: def.minValue ?? 6, max: faces(def.dice) });
  return ui("dm.afterRest");
}

/** Round pips: the filled ones are spent. A tap on a pip spends up to it; a tap on the last spent one gives it back. */
function Pips({
  total,
  spent,
  label,
  onChange,
}: {
  total: number;
  spent: number;
  label: string;
  onChange: (spent: number) => void;
}) {
  return (
    <fieldset class="dm-pips">
      <legend class="sr-only">{label}</legend>
      {Array.from({ length: total }, (_, i) => (
        <button
          type="button"
          // biome-ignore lint/suspicious/noArrayIndexKey: the pips are a fixed row
          key={i}
          class="dm-pip"
          data-spent={i < spent || undefined}
          aria-label={`${label}: ${i + 1}`}
          aria-pressed={i < spent}
          onClick={() => onChange(i + 1 === spent ? i : i + 1)}
        />
      ))}
    </fieldset>
  );
}

/** The abilities with a limit of a monster, with their counters. */
export function AbilitiesEditor({ c }: { c: Combatant }) {
  const { defs, legendary } = abilitiesOf(c);
  if (defs.length === 0 && !legendary) return <p class="muted">{ui("dm.noAbilities")}</p>;
  return (
    <div class="dm-ab">
      {legendary && (
        <section>
          <h5 class="dm-fx-title">{ui("dm.legendary")}</h5>
          <div class="dm-ab-row">
            <Pips
              total={legendary.max}
              spent={legendary.used}
              label={ui("dm.legendary")}
              onChange={(n) => editCombatant(c.id, (x) => setLegendary(x, legendary.max, n))}
            />
            <span class="dm-ab-max">
              <button
                type="button"
                aria-label={ui("dm.legendaryFewer")}
                disabled={legendary.max <= 1}
                onClick={() =>
                  editCombatant(c.id, (x) => setLegendary(x, legendary.max - 1, legendary.used))
                }
              >
                −
              </button>
              <button
                type="button"
                aria-label={ui("dm.legendaryMore")}
                disabled={legendary.max >= 9}
                onClick={() =>
                  editCombatant(c.id, (x) => setLegendary(x, legendary.max + 1, legendary.used))
                }
              >
                +
              </button>
            </span>
          </div>
        </section>
      )}
      {defs.length > 0 && (
        <ul class="plain dm-ab-list">
          {defs.map((def) => {
            const spent = usesSpent(c, def.key);
            const name = abilityName(c, def);
            return (
              <li
                key={def.key}
                class="dm-ab-item"
                data-spent={(def.kind !== "perDay" && spent > 0) || undefined}
              >
                <span class="dm-fx-name">
                  {name}
                  <small>{usageText(def)}</small>
                </span>
                {def.kind === "perDay" ? (
                  <Pips
                    total={usesTotal(def)}
                    spent={spent}
                    label={name}
                    onChange={(n) => editCombatant(c.id, (x) => setUsesSpent(x, def, n))}
                  />
                ) : (
                  <span class="dm-ab-state">
                    <button
                      type="button"
                      aria-pressed={spent > 0}
                      onClick={() =>
                        editCombatant(c.id, (x) => setUsesSpent(x, def, spent > 0 ? 0 : 1))
                      }
                    >
                      {spent > 0 ? ui("dm.useSpent") : ui("dm.useReady")}
                    </button>
                    {def.kind === "recharge" && spent > 0 && (
                      <button type="button" onClick={() => rollRechargeFor(c.id, def)}>
                        {ui("dm.rollRechargeShort")}
                      </button>
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** A small chip under the name of a monster that has legendary actions or limited abilities: it shows what is left and opens the counters. */
export function AbilitiesCell({ c }: { c: Combatant }) {
  const { defs, legendary } = abilitiesOf(c);
  if (c.kind !== "monster" || (defs.length === 0 && !legendary)) return null;
  const spentCount = defs.filter((d) => usesSpent(c, d.key) > 0).length;
  const parts = [
    legendary ? `◆ ${legendary.max - legendary.used}/${legendary.max}` : "",
    spentCount > 0 ? ui("dm.spentCount", { n: spentCount }) : "",
  ].filter(Boolean);
  return (
    <span class="dm-abilities">
      <CellPopover
        title={ui("dm.abilitiesOf", { name: c.name })}
        class="dm-ab-chip"
        trigger={
          <span data-spent={spentCount > 0 || undefined}>
            {parts.length > 0 ? parts.join(" · ") : ui("dm.abilities")}
          </span>
        }
      >
        {() => (
          <>
            <h4 class="dm-pop-title">{ui("dm.abilities")}</h4>
            <AbilitiesEditor c={c} />
          </>
        )}
      </CellPopover>
    </span>
  );
}
