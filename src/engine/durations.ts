/** A rage lasts a minute, which is ten rounds. */
export const RAGE_ROUNDS = 10;
/** In 2024 a rage can be extended up to ten minutes, a hundred rounds; how it is kept going is up to the person. */
export const RAGE_ROUNDS_2024 = 100;
/** The cantrip Shillelagh lasts a minute too. */
export const SHILLELAGH_ROUNDS = 10;
/** The Channel Divinity: Sacred Weapon of a paladin lasts a minute too. */
export const SACRED_WEAPON_ROUNDS = 10;

/** The longest duration that is counted in rounds: ten minutes. Longer is told in hours, which a fight does not count. */
const LONGEST_ROUNDS = 100;

const WORDS: Record<string, number> = { un: 1, uno: 1, una: 1, one: 1, ein: 1, eine: 1 };

/**
 * How many rounds a spell lasts, from the text of its duration in any of the languages ("Up to
 * 1 minute", "Concentrazione, fino a 10 minuti", "1 asalto", "Bis zu 1 Runde"): a minute is ten
 * rounds. Nothing for what is instant, special, or lasts hours or days.
 */
export function durationRounds(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const found = /(\d+|\b(?:un|uno|una|one|ein|eine)\b)\s+(minut\w*|rounds?|runden?|asaltos?)/i.exec(
    text,
  );
  if (!found) return undefined;
  const count = WORDS[(found[1] ?? "").toLowerCase()] ?? Number(found[1]);
  const rounds = /^minut/i.test(found[2] ?? "") ? count * 10 : count;
  return rounds >= 1 && rounds <= LONGEST_ROUNDS ? rounds : undefined;
}
