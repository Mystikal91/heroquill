import type { Entry } from "../data/schema";
import type { Companion } from "./character";
import { inRuleset } from "./rulesets";
import { type Owner, scaledHitPoints } from "./scaling";

/** The forms the spell Find Familiar offers in the SRD, by the slug of the monster. */
export const SRD_FAMILIARS = [
  "bat",
  "cat",
  "crab",
  "frog",
  "hawk",
  "lizard",
  "octopus",
  "owl",
  "poisonous-snake",
  "quipper",
  "rat",
  "raven",
  "sea-horse",
  "spider",
  "weasel",
];

/** The monsters among the entries (those of the character's edition, and of the packs added), in no particular order. */
export const monstersOf = (index: ReadonlyMap<string, Entry>, ruleset?: string): Entry[] =>
  [...index.values()].filter((e) => e.kind === "monster" && (!ruleset || inRuleset(e.id, ruleset)));

/** A monster a familiar can be: a form of Find Familiar, or one a book lists as a familiar. */
export function isFamiliar(entry: Entry): boolean {
  const slug = entry.id.split("/")[1] ?? "";
  if (/^srd\d+:/.test(entry.id)) return SRD_FAMILIARS.includes(slug);
  const uses = entry.data.uses;
  return Array.isArray(uses) && uses.some((u) => u === "familiar" || u === "variant-familiar");
}

/**
 * The most hit points a companion can have: its own maximum, else the one its monster gives, else
 * what the formula of the monster gives for the owner (a ranger's beast has five per level).
 */
export function companionMax(
  companion: Companion,
  monster: Entry | undefined,
  owner?: Owner,
): number | undefined {
  if (companion.maxHp !== undefined) return companion.maxHp;
  const hp = monster?.data.hitPoints;
  if (typeof hp === "number" && hp > 0) return hp;
  return owner ? scaledHitPoints(monster, owner) : undefined;
}

export const companionHp = (companion: Companion, max: number): number =>
  Math.min(max, Math.max(0, companion.hp ?? max));

/** Damage lowers hit points down to 0. */
export function hurtCompanion(companion: Companion, max: number, amount: number): Companion {
  const damage = Math.max(0, Math.floor(amount));
  if (damage === 0) return companion;
  return { ...companion, hp: Math.max(0, companionHp(companion, max) - damage) };
}

/** Healing raises hit points up to the maximum. */
export function healCompanion(companion: Companion, max: number, amount: number): Companion {
  const heal = Math.max(0, Math.floor(amount));
  if (heal === 0) return companion;
  return { ...companion, hp: Math.min(max, companionHp(companion, max) + heal) };
}
