import { type RandomInt, cryptoRandomInt, parseDice, rollExpression } from "./dice";
import { type Combatant, DEFAULT_LEGENDARY, MAX_LEGENDARY } from "./encounter";

/**
 * The abilities of a monster that have a limit, as the stat block gives them: used so many times a day,
 * back on a roll of a die at the start of its turn (a dragon's breath: recharge 5-6), or back after a rest.
 * Pure: what is read from an entry and how a creature's counters move.
 */

export type UseKind = "perDay" | "recharge" | "rest";

export interface UseDef {
  /** The place of the ability in the entry: `actions.6` is the sixth action (the texts use the same numbers). */
  key: string;
  list: "special" | "actions" | "reactions" | "legendary";
  /** From 1, as the texts number them. */
  number: number;
  kind: UseKind;
  /** How many times a day (for `perDay`). */
  times?: number;
  /** The die and the lowest result that brings it back (for `recharge`). */
  dice?: string;
  minValue?: number;
}

const LISTS = ["special", "actions", "reactions", "legendary"] as const;

/** The abilities with a limit that the entry of a monster lists, in the order of the stat block. */
export function useDefs(data: unknown): UseDef[] {
  const d = (data ?? {}) as Record<string, unknown>;
  const out: UseDef[] = [];
  for (const list of LISTS) {
    const items = d[list];
    if (!Array.isArray(items)) continue;
    items.forEach((item, i) => {
      const usage = (item as { usage?: Record<string, unknown> } | null)?.usage;
      if (!usage || typeof usage !== "object") return;
      const base = { key: `${list}.${i + 1}`, list, number: i + 1 };
      if (usage.type === "per day" && typeof usage.times === "number")
        out.push({ ...base, kind: "perDay", times: usage.times });
      else if (usage.type === "recharge on roll" && typeof usage.dice === "string")
        out.push({
          ...base,
          kind: "recharge",
          dice: usage.dice,
          minValue: typeof usage.minValue === "number" ? usage.minValue : 6,
        });
      else if (usage.type === "recharge after rest") out.push({ ...base, kind: "rest" });
    });
  }
  return out;
}

/** Whether the entry has legendary actions. */
export function hasLegendary(data: unknown): boolean {
  const list = (data as { legendary?: unknown } | undefined)?.legendary;
  return Array.isArray(list) && list.length > 0;
}

/** How many times an ability is spent now. */
export const usesSpent = (c: Combatant, key: string): number => c.uses?.[key] ?? 0;

/** How many uses an ability has in all: a per-day ability has its times, the others have one. */
export const usesTotal = (def: UseDef): number => (def.kind === "perDay" ? (def.times ?? 1) : 1);

/** Sets how many uses of an ability are spent (never below 0 or above what it has). */
export function setUsesSpent(c: Combatant, def: UseDef, spent: number): Combatant {
  const n = Math.max(0, Math.min(usesTotal(def), Math.trunc(spent)));
  const { [def.key]: _old, ...rest } = c.uses ?? {};
  const uses = n >= 1 ? { ...rest, [def.key]: n } : rest;
  const { uses: _all, ...others } = c;
  return Object.keys(uses).length > 0 ? { ...others, uses } : others;
}

/** The abilities that were used and come back on a die: what the DM rolls for at the start of its turn. */
export const rechargeDue = (c: Combatant, defs: readonly UseDef[]): UseDef[] =>
  defs.filter((d) => d.kind === "recharge" && usesSpent(c, d.key) > 0);

/** Rolls for a recharge: on the result or higher the ability is ready again. */
export function rollRecharge(
  c: Combatant,
  def: UseDef,
  random: RandomInt = cryptoRandomInt,
): { creature: Combatant; total: number; recharged: boolean } {
  const expression = def.dice ? parseDice(def.dice) : undefined;
  const total = expression ? rollExpression(expression, random).total : 0;
  const recharged = total >= (def.minValue ?? 6);
  return { creature: recharged ? setUsesSpent(c, def, 0) : c, total, recharged };
}

// ---- legendary actions ----

/** The legendary actions of a creature: the ones it has been given, or the usual three when it has legendary actions of its entry. */
export const legendaryOf = (
  c: Combatant,
  data: unknown,
): { max: number; used: number } | undefined =>
  c.legendary ?? (hasLegendary(data) ? { max: DEFAULT_LEGENDARY, used: 0 } : undefined);

/** Sets how many legendary actions it has and how many are spent. */
export function setLegendary(c: Combatant, max: number, used: number): Combatant {
  const m = Math.max(1, Math.min(MAX_LEGENDARY, Math.trunc(max)));
  return { ...c, legendary: { max: m, used: Math.max(0, Math.min(m, Math.trunc(used))) } };
}
