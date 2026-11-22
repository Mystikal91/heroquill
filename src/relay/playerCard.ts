import { LIMITS, type PlayerCard } from "./protocol";

/** What the app knows of the character right now, as the card is made from it. */
export interface CardInput {
  name: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed?: number;
  /** Names of the conditions in force, already in the person's language. */
  conditions: readonly string[];
}

/**
 * The card a player lets the DM see: only what the DM needs at the table (name, hit points, armor class, speed,
 * conditions). Nothing else of the sheet leaves the device; the room cuts what is too long on its side too.
 */
export function makeCard(input: CardInput): PlayerCard {
  const maxHp = Math.max(1, Math.round(input.maxHp));
  return {
    name: input.name.trim().slice(0, LIMITS.text),
    hp: Math.max(0, Math.round(input.hp)),
    maxHp,
    tempHp: Math.max(0, Math.round(input.tempHp)),
    ac: Math.max(0, Math.round(input.ac)),
    ...(input.speed !== undefined && { speed: Math.max(0, Math.round(input.speed)) }),
    conditions: input.conditions.slice(0, LIMITS.conditions).map((c) => c.slice(0, LIMITS.text)),
  };
}

/** Two cards say the same: nothing is sent again for a change that is not one. */
export const sameCard = (a: PlayerCard | undefined, b: PlayerCard): boolean =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);
