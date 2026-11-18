import type { MovementMode, Sense } from "../data/schema";
import type { SourcedEffect } from "./choices";
import { type ModifierState, holds } from "./modifiers";

/** A speed other than walking: its feet, and whether it is only the half of walking that anyone has. */
export interface MovementSpeed {
  feet: number;
  half?: boolean;
}

export type Movement = Partial<Record<MovementMode, MovementSpeed>>;

/**
 * The other speeds of a character. Everyone climbs and swims at half the walking speed; a speed
 * a feature gives replaces that when it is better. A bonus to speed adds to a speed that was
 * given (walking, climbing... all move together), and the half follows the walking speed.
 */
export function deriveMovement(
  sourced: SourcedEffect[],
  state: ModifierState,
  walking: number,
  speedBonus: number,
  /** What every speed is multiplied by (Haste doubles it). */
  factor = 1,
): Movement {
  const given: Partial<Record<MovementMode, number>> = {};
  for (const { effect } of sourced) {
    if (effect.type !== "movement" || !holds(effect.when, state)) continue;
    const feet = effect.feet === "walk" ? walking : (effect.feet + speedBonus) * factor;
    given[effect.mode] = Math.max(given[effect.mode] ?? 0, feet);
  }
  const half = Math.floor(walking / 2);
  const movement: Movement = {};
  for (const mode of ["climb", "swim"] as const) {
    const own = given[mode] ?? 0;
    movement[mode] = own >= half ? { feet: own } : { feet: half, half: true };
  }
  for (const mode of ["fly", "burrow"] as const)
    if (given[mode] !== undefined) movement[mode] = { feet: given[mode] };
  return movement;
}

/** The senses of a character with their range in feet: the longest of each. */
export function deriveSenses(
  sourced: SourcedEffect[],
  state: ModifierState,
): Partial<Record<Sense, number>> {
  const senses: Partial<Record<Sense, number>> = {};
  for (const { effect } of sourced)
    if (effect.type === "sense" && holds(effect.when, state))
      senses[effect.sense] = Math.max(senses[effect.sense] ?? 0, effect.range);
  return senses;
}
