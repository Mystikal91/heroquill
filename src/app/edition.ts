import type { Character } from "../engine/character";

export type Ruleset = Character["ruleset"];

/** The editions in the order they are offered. */
export const EDITIONS: Ruleset[] = ["srd51", "srd52"];

/** The editions whose rules are loaded, in the order they are offered. */
export const editionsIn = (packRulesets: string[]): Ruleset[] =>
  EDITIONS.filter((e) => packRulesets.includes(e));
