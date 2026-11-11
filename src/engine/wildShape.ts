import type { ClassData } from "../data/progression";
import type { Entry } from "../data/schema";
import type { PlayState } from "./character";
import { currentHp, setSlotsUsed } from "./play";

/** What a druid can turn into at a level. */
export interface WildShapeLimits {
  /** The highest challenge rating of the beast. */
  maxCr: number;
  /** The beast may have a swimming speed. */
  swim: boolean;
  /** The beast may have a flying speed. */
  fly: boolean;
  /** How many hours the shape lasts. */
  hours: number;
  /**
   * The 2024 rules: how many forms the druid knows. Only a known form can be assumed, the druid keeps
   * their own hit points and gains temporary hit points as many as their level. Absent in the 2014 rules,
   * where any beast within the limits will do and the beast has hit points of its own.
   */
  knownForms?: number;
}

/**
 * The limits of Wild Shape from the table of the class. A druid of the Circle of the Moon ignores
 * the challenge rating of the table (it is 1, and a third of the level from level 6) but keeps
 * the other limits. Undefined before the class has the feature.
 */
export function wildShapeLimits(
  data: ClassData,
  level: number,
  moon = false,
): WildShapeLimits | undefined {
  const row = data.levels.find((l) => l.level === level)?.classSpecific ?? {};
  const tableCr = typeof row.wildShapeMaxCr === "number" ? row.wildShapeMaxCr : 0;
  if (level < 2 || tableCr <= 0) return undefined;
  return {
    maxCr: moon ? Math.max(1, Math.floor(level / 3)) : tableCr,
    swim: row.wildShapeSwim === true,
    fly: row.wildShapeFly === true,
    hours: Math.floor(level / 2),
    ...(typeof row.wildShapeKnownForms === "number" && { knownForms: row.wildShapeKnownForms }),
  };
}

/** The hit points of the beast of a 2014 Wild Shape (a 2024 shape has none: the druid keeps their own). */
export function beastPool(
  play: Pick<PlayState, "wildShape">,
): { hp: number; max: number } | undefined {
  const shape = play.wildShape;
  return shape && !shape.own ? { hp: shape.hp, max: shape.max } : undefined;
}

/**
 * The 2024 Wild Shape: the druid keeps their own hit points and gains temporary hit points as many as their
 * level (they do not add up with those they have: the higher number stays).
 */
export function assumeBeastKeepingHitPoints(
  play: PlayState,
  monster: string,
  level: number,
): PlayState {
  return {
    ...play,
    tempHp: Math.max(play.tempHp, level),
    wildShape: { monster, hp: 0, max: 0, own: true },
  };
}

/** A 2024 shape ends when the druid falls to 0 hit points (they are Incapacitated); a 2014 one ends with the beast's. */
export function endShapeIfDown(play: PlayState, max: number): PlayState {
  return play.wildShape?.own && currentHp(play, max) === 0 ? leaveBeast(play) : play;
}

/** The known forms still allowed at this level: a list longer than the table allows loses its last ones. */
export const trimForms = (forms: readonly string[] | undefined, allowed: number): string[] =>
  (forms ?? []).slice(0, Math.max(0, allowed));

/** A beast the druid can become: a real animal (not a swarm) that the limits allow. */
export function canAssume(entry: Entry, limits: WildShapeLimits): boolean {
  const d = entry.data;
  if (d.type !== "beast" || d.swarm) return false;
  // A stat block that depends on the level has no fixed hit points to take.
  if (typeof d.hitPoints !== "number" || d.hitPoints < 1) return false;
  if (typeof d.challenge !== "number" || d.challenge > limits.maxCr) return false;
  const speed = (d.speed ?? {}) as Record<string, unknown>;
  if (!limits.fly && typeof speed.fly === "number") return false;
  if (!limits.swim && typeof speed.swim === "number") return false;
  return true;
}

/** The hit points of the beast, which replace the druid's own while the shape lasts. */
export function assumeBeast(play: PlayState, monster: string, hitPoints: number): PlayState {
  return { ...play, wildShape: { monster, hp: hitPoints, max: hitPoints } };
}

/** Back to the druid's own form, with the hit points the druid had. */
export function leaveBeast(play: PlayState): PlayState {
  const { wildShape: _gone, ...rest } = play;
  return rest;
}

/**
 * Damage takes the beast's hit points first. When they run out the druid returns to their own
 * form, and the damage that is left over is `overflow`, to be taken by the druid.
 */
export function damageBeast(
  play: PlayState,
  amount: number,
): { play: PlayState; overflow: number } {
  const shape = play.wildShape;
  const damage = Math.max(0, Math.floor(amount));
  if (!shape || shape.own || damage === 0) return { play, overflow: damage };
  if (damage < shape.hp)
    return { play: { ...play, wildShape: { ...shape, hp: shape.hp - damage } }, overflow: 0 };
  return { play: leaveBeast(play), overflow: damage - shape.hp };
}

/** Healing raises the beast's hit points up to its maximum. */
export function healBeast(play: PlayState, amount: number): PlayState {
  const shape = play.wildShape;
  const heal = Math.max(0, Math.floor(amount));
  if (!shape || shape.own || heal === 0) return play;
  return { ...play, wildShape: { ...shape, hp: Math.min(shape.max, shape.hp + heal) } };
}

/**
 * Combat Wild Shape (Circle of the Moon): in a beast's shape, a bonus action spends a spell slot
 * and gives the beast 1d8 hit points per level of the slot; `amount` is what was rolled.
 */
export function healWithSlot(
  play: PlayState,
  level: number,
  total: number,
  amount: number,
): PlayState {
  const spent = setSlotsUsed(play, level, (play.slotsUsed[level - 1] ?? 0) + 1, total);
  return healBeast(spent, amount);
}
