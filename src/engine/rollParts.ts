import type { D20Mode, DiceRoll, RandomInt } from "./dice";
import { cryptoRandomInt, parseDice } from "./dice";

/**
 * The pieces of a roll that has landed, kept so that it can be shown die by die and changed afterwards: a die or a
 * number can be added or taken away (an effect forgotten before rolling), and a d20 can be turned into advantage or
 * disadvantage. Every piece has a key, so a screen can tell which dice it has already shown rolling.
 */
export interface RollTerm {
  key: number;
  /** The sides of a die; absent for a flat number. */
  sides?: number;
  /** The face of the die, or the number. Always positive or zero: `sign` says whether it adds or takes away. */
  value: number;
  sign: 1 | -1;
  /** What gave it (Bless, a Bardic Inspiration die), as a name to show. */
  source?: string;
  /** Put in by the person after the roll: it can be taken out again. */
  added?: boolean;
}

export interface RollD20 {
  /** One face, or two for advantage and disadvantage. */
  faces: number[];
  keys: number[];
  mode: D20Mode;
  /** The lowest die that is a critical hit. */
  critMin: number;
  /** A die lower than this counts as this (Reliable Talent). */
  floor: number;
}

export interface RollParts {
  d20?: RollD20;
  terms: RollTerm[];
}

/** Which of the d20 faces counts: the higher with advantage, the lower with disadvantage. */
export function keptFace(d20: RollD20): number {
  const [a = 1, b] = d20.faces;
  if (b === undefined || d20.mode === "normal") return 0;
  if (d20.mode === "advantage") return b > a ? 1 : 0;
  return b < a ? 1 : 0;
}

/** The face of the d20 that counts, before a minimum raises it. */
export const naturalD20 = (d20: RollD20) => d20.faces[keptFace(d20)] ?? 1;

/** The face of the d20 that counts, after a minimum (Reliable Talent) has raised it. */
export const usedD20 = (d20: RollD20) => Math.max(naturalD20(d20), d20.floor);

export function partsTotal(parts: RollParts): number {
  const d20 = parts.d20 ? usedD20(parts.d20) : 0;
  return parts.terms.reduce((sum, t) => sum + t.sign * t.value, d20);
}

/** A natural 20 (or what the critical range says) is a critical hit; a natural 1 a fumble, unless a minimum lifts it. */
export function partsTone(parts: RollParts): "critical" | "fumble" | undefined {
  const d20 = parts.d20;
  if (!d20) return undefined;
  if (usedD20(d20) >= d20.critMin) return "critical";
  if (naturalD20(d20) === 1 && d20.floor <= 1) return "fumble";
  return undefined;
}

/**
 * The roll as one line of text, for the history and the online table: `d20 [14, 7] → 14 +5 + d4 (3)`, or
 * `2d6 (6, 2) + d4 (4) +3` for a roll of dice. Dice of the same kind side by side are written together, so a big
 * roll (a critical Sneak Attack) stays short enough for the table.
 */
export function partsDetail(parts: RollParts): string {
  const out: string[] = [];
  const d20 = parts.d20;
  if (d20) {
    const natural = naturalD20(d20);
    const used = usedD20(d20);
    out.push(
      d20.faces.length > 1
        ? `d20 [${d20.faces.join(", ")}] → ${used}`
        : used !== natural
          ? `d20 ${natural} → ${used}`
          : `d20 ${used}`,
    );
  }
  const groups: { sides?: number; sign: 1 | -1; values: number[] }[] = [];
  for (const t of parts.terms) {
    const last = groups[groups.length - 1];
    if (t.sides !== undefined && last && last.sides === t.sides && last.sign === t.sign)
      last.values.push(t.value);
    else
      groups.push({
        ...(t.sides !== undefined && { sides: t.sides }),
        sign: t.sign,
        values: [t.value],
      });
  }
  for (const g of groups) {
    const sign = g.sign < 0 ? "-" : "+";
    const count = g.values.length > 1 ? g.values.length : "";
    const body =
      g.sides === undefined ? `${g.values[0]}` : `${count}d${g.sides} (${g.values.join(", ")})`;
    // A flat bonus right after the d20 reads `+5`, as it always did; the first piece of a roll of dice has no sign.
    out.push(
      out.length === 0 && g.sign > 0 ? body : `${sign}${g.sides === undefined ? "" : " "}${body}`,
    );
  }
  return out.join(" ");
}

/** The pieces of a roll of dice (damage, healing): each die on its own, then the flat bonus. */
export function partsOfDice(roll: DiceRoll, nextKey: () => number): RollParts {
  const sides = parseDice(roll.expression)?.terms.map((t) => t.sides) ?? [];
  const terms: RollTerm[] = roll.rolls.flatMap((group, i) =>
    group.map((value) => ({ key: nextKey(), sides: sides[i] ?? 6, value, sign: 1 as const })),
  );
  if (roll.modifier !== 0)
    terms.push({
      key: nextKey(),
      value: Math.abs(roll.modifier),
      sign: roll.modifier < 0 ? -1 : 1,
    });
  return { terms };
}

/** Adds a die (rolled now) or a number, which adds or takes away. */
export function addTerm(
  parts: RollParts,
  piece: { sides?: number; value?: number; sign: 1 | -1; source?: string },
  key: number,
  random: RandomInt = cryptoRandomInt,
): RollParts {
  const value = piece.sides !== undefined ? 1 + random(piece.sides) : Math.abs(piece.value ?? 0);
  const term: RollTerm = {
    key,
    ...(piece.sides !== undefined && { sides: piece.sides }),
    value,
    sign: piece.sign,
    ...(piece.source ? { source: piece.source } : { added: true }),
  };
  return { ...parts, terms: [...parts.terms, term] };
}

/** Takes out a piece the person put in; the dice of the roll itself stay. */
export function removeTerm(parts: RollParts, key: number): RollParts {
  return { ...parts, terms: parts.terms.filter((t) => !(t.key === key && t.added)) };
}

/**
 * Turns a d20 into advantage, disadvantage or a plain roll after it landed. Going to advantage or disadvantage
 * rolls the second die if there is only one; going back to normal keeps the face that counted.
 */
export function setD20Mode(
  parts: RollParts,
  mode: D20Mode,
  key: number,
  random: RandomInt = cryptoRandomInt,
): RollParts {
  const d20 = parts.d20;
  if (!d20 || d20.mode === mode) return parts;
  if (mode === "normal") {
    const kept = keptFace(d20);
    return {
      ...parts,
      d20: {
        ...d20,
        mode,
        faces: [d20.faces[kept] ?? 1],
        keys: [d20.keys[kept] ?? key],
      },
    };
  }
  if (d20.faces.length > 1) return { ...parts, d20: { ...d20, mode } };
  return {
    ...parts,
    d20: {
      ...d20,
      mode,
      faces: [...d20.faces, 1 + random(20)],
      keys: [...d20.keys, key],
    },
  };
}

/** One die of the roll rolled again (the 2024 Heroic Inspiration): it gets a new key, so it is shown rolling. */
export function rerollTerm(
  parts: RollParts,
  key: number,
  newKey: number,
  random: RandomInt = cryptoRandomInt,
): RollParts {
  return {
    ...parts,
    terms: parts.terms.map((t) =>
      t.key === key && t.sides !== undefined
        ? { ...t, key: newKey, value: 1 + random(t.sides) }
        : t,
    ),
  };
}
