import type { SourcedEffect } from "./choices";
import { holds } from "./modifiers";
import type { ModifierState } from "./modifiers";

/** A flat amount a character takes off a hit, with where it comes from and what it covers. */
export interface DamageReduction {
  /** The entry that gives it (a feat, an item). */
  source: string;
  /** What is taken off a hit (never below 0 once applied). */
  amount: number;
  /** The kinds of damage it covers; every kind when absent. */
  damage?: string[];
  /** A condition in words ("nonmagical attacks"): the person judges it, the engine cannot. */
  note?: string;
}

/**
 * The reductions in force: those whose condition about what is worn holds. The same source with the
 * same amount and the same kinds counts once.
 */
export function deriveDamageReductions(
  sourced: SourcedEffect[],
  state: ModifierState,
): DamageReduction[] {
  const found: DamageReduction[] = [];
  for (const { effect, source } of sourced) {
    if (effect.type !== "damageReduction" || !holds(effect.when, state)) continue;
    const amount =
      effect.value + (effect.plus === "proficiency" ? (state.proficiencyBonus ?? 0) : 0);
    if (amount <= 0) continue;
    const next: DamageReduction = {
      source,
      amount,
      ...(effect.damage && effect.damage.length > 0 && { damage: effect.damage }),
      ...(effect.note && { note: effect.note }),
    };
    const same = found.some(
      (r) =>
        r.source === next.source &&
        r.amount === next.amount &&
        (r.damage ?? []).join() === (next.damage ?? []).join(),
    );
    if (!same) found.push(next);
  }
  return found;
}
