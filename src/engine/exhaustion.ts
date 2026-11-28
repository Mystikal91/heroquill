import type { Effect } from "../data/schema";
import type { PlayState } from "./character";
import type { D20Mode } from "./dice";

/** The most levels of exhaustion: at this one the character dies. */
export const MAX_EXHAUSTION = 6;

/** The condition entry of the SRD of an edition (`srd52:condition/exhaustion`): where its modifiers say they come from. */
export const exhaustionId = (ruleset: string) => `${ruleset}:condition/exhaustion`;

/** An id of the Exhaustion condition, of any edition. */
export const isExhaustionCondition = (id: string) => /:condition\/exhaustion$/.test(id);

/**
 * The levels of exhaustion of a character. The condition used to be a switch in the list of conditions: a character
 * saved so has it, and it counts as the first level until the person sets the level.
 */
export function exhaustionLevel(play: Pick<PlayState, "exhaustion" | "conditions">): number {
  if (play.exhaustion !== undefined) return Math.min(MAX_EXHAUSTION, Math.max(0, play.exhaustion));
  return play.conditions.some(isExhaustionCondition) ? 1 : 0;
}

/** Sets the level (0 to 6); the old switch of the condition is taken out, the level says it all now. */
export function setExhaustion(play: PlayState, level: number): PlayState {
  const next = Math.min(MAX_EXHAUSTION, Math.max(0, Math.floor(level)));
  const gone = play.conditions.filter(isExhaustionCondition);
  const rounds =
    play.rounds &&
    Object.fromEntries(Object.entries(play.rounds).filter(([id]) => !gone.includes(id)));
  const { exhaustion: _old, rounds: _rounds, ...rest } = play;
  return {
    ...rest,
    conditions: play.conditions.filter((id) => !isExhaustionCondition(id)),
    ...(rounds && Object.keys(rounds).length > 0 && { rounds }),
    ...(next > 0 && { exhaustion: next }),
  };
}

/**
 * What the levels of exhaustion do to the numbers of the sheet.
 * 2024: every D20 Test is lowered by 2 for each level (checks, attack rolls, saving throws, initiative), not the
 * spell save DC, which the book does not name; the Speed is lowered by 5 feet for each level.
 * 2014: the Speed is halved from the 2nd level and is 0 from the 5th, the hit point maximum is halved from the 4th;
 * the disadvantages of the 1st and the 3rd are on the rolls (`exhaustionMode`).
 */
export function exhaustionModifiers(ruleset: string, level: number): Effect[] {
  if (level <= 0 || ruleset !== "srd52") return [];
  const penalty = -2 * level;
  // A spell save DC is not a D20 Test of the caster: it stays as it is.
  const targets = ["save", "skill", "initiative", "attack", "spellAttack"] as const;
  return [
    ...targets.map((target): Effect => ({ type: "modifier", target, value: penalty })),
    { type: "modifier", target: "speed", value: -5 * level },
  ];
}

/** The speed after the 2014 levels of exhaustion (the 2024 ones are modifiers); undefined stays undefined. */
export function exhaustedSpeed(ruleset: string, level: number, speed: number): number {
  if (ruleset === "srd52") return Math.max(0, speed);
  if (level >= 5) return 0;
  return level >= 2 ? Math.floor(speed / 2) : speed;
}

/** The hit point maximum after the 2014 4th level of exhaustion, which halves it. */
export function exhaustedHitPoints(ruleset: string, level: number, max: number): number {
  return ruleset !== "srd52" && level >= 4 ? Math.floor(max / 2) : max;
}

export type ExhaustionRoll = "check" | "attack" | "save";

/**
 * How a d20 roll is made in armor the character is not trained with: disadvantage on the D20 Tests (ability checks,
 * attack rolls, saving throws) that use Strength or Dexterity; it cancels an advantage.
 */
export function armorMode(
  untrained: boolean,
  kind: ExhaustionRoll | undefined,
  ability: string | undefined,
  mode: D20Mode,
): D20Mode {
  if (!untrained || kind === undefined || (ability !== "str" && ability !== "dex")) return mode;
  return mode === "advantage" ? "normal" : "disadvantage";
}

/**
 * How a d20 roll is made with the 2014 exhaustion: disadvantage on ability checks from the 1st level, on attack rolls
 * and saving throws from the 3rd. It cancels an advantage, as any disadvantage does.
 */
export function exhaustionMode(
  ruleset: string,
  level: number,
  kind: ExhaustionRoll | undefined,
  mode: D20Mode,
): D20Mode {
  if (ruleset === "srd52" || kind === undefined) return mode;
  const disadvantaged = kind === "check" ? level >= 1 : level >= 3;
  if (!disadvantaged) return mode;
  return mode === "advantage" ? "normal" : "disadvantage";
}
