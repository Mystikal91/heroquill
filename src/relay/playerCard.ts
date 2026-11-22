import { LIMITS, type PlayerCard } from "./protocol";

/** What the app knows of the character right now, as the card is made from it. */
export interface CardInput {
  name: string;
  /** Class and level as text ("Rogue 3"). */
  cls?: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed?: number;
  initiativeBonus?: number;
  passivePerception?: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  proficiency?: number;
  martialDc?: number;
  spellDc?: number;
  spellAttack?: number;
  critRange?: number;
  attunedUsed?: number;
  attunedMax?: number;
  senses?: [string, string][];
  defenses?: [string, string][];
  /** Names of the conditions in force, already in the person's language. */
  conditions: readonly string[];
}

/**
 * The card a player lets the DM see: the numbers their sheet shows at a glance (hit points, armor class, speed,
 * conditions, senses, defenses and the main numbers of attacks and spells). Nothing else of the sheet leaves the
 * device; the room cuts what is too long on its side too.
 */
export function makeCard(input: CardInput): PlayerCard {
  const maxHp = Math.max(1, Math.round(input.maxHp));
  return {
    name: input.name.trim().slice(0, LIMITS.text),
    ...(input.cls && { cls: input.cls.slice(0, LIMITS.text) }),
    hp: Math.max(0, Math.round(input.hp)),
    maxHp,
    tempHp: Math.max(0, Math.round(input.tempHp)),
    ac: Math.max(0, Math.round(input.ac)),
    ...(input.speed !== undefined && { speed: Math.max(0, Math.round(input.speed)) }),
    ...(input.initiativeBonus !== undefined && {
      initiativeBonus: Math.round(input.initiativeBonus),
    }),
    ...(input.passivePerception !== undefined && {
      passivePerception: Math.round(input.passivePerception),
    }),
    ...(input.passiveInvestigation !== undefined && {
      passiveInvestigation: Math.round(input.passiveInvestigation),
    }),
    ...(input.passiveInsight !== undefined && { passiveInsight: Math.round(input.passiveInsight) }),
    ...(input.proficiency !== undefined && { proficiency: Math.round(input.proficiency) }),
    ...(input.martialDc !== undefined && { martialDc: Math.round(input.martialDc) }),
    ...(input.spellDc !== undefined && { spellDc: Math.round(input.spellDc) }),
    ...(input.spellAttack !== undefined && { spellAttack: Math.round(input.spellAttack) }),
    ...(input.critRange !== undefined && input.critRange < 20 && { critRange: input.critRange }),
    ...(input.attunedMax !== undefined &&
      input.attunedMax > 0 &&
      (input.attunedUsed ?? 0) > 0 && {
        attunedUsed: input.attunedUsed,
        attunedMax: input.attunedMax,
      }),
    ...(input.senses && input.senses.length > 0 && { senses: input.senses }),
    ...(input.defenses && input.defenses.length > 0 && { defenses: input.defenses }),
    conditions: input.conditions.slice(0, LIMITS.conditions).map((c) => c.slice(0, LIMITS.text)),
  };
}

/** Two cards say the same: nothing is sent again for a change that is not one. */
export const sameCard = (a: PlayerCard | undefined, b: PlayerCard): boolean =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);
