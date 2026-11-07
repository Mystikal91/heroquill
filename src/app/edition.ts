import { signal } from "@preact/signals";
import type { Character } from "../engine/character";

export type Ruleset = Character["ruleset"];

/** The editions in the order they are offered. */
export const EDITIONS: Ruleset[] = ["srd51", "srd52"];

/** The question "which rules?" being asked, and how to answer it. */
export const editionRequest = signal<
  { answer: (ruleset: Ruleset | undefined) => void } | undefined
>(undefined);

/**
 * Asks which edition a new character follows, the first thing in making one: it picks the rules
 * every later step uses and cannot be changed afterwards. Resolves to the edition, or to nothing
 * when the person closes the dialog.
 */
export function askEdition(): Promise<Ruleset | undefined> {
  return new Promise((resolve) => {
    // A second question while one is open answers the first with no.
    editionRequest.value?.answer(undefined);
    editionRequest.value = {
      answer: (ruleset) => {
        editionRequest.value = undefined;
        resolve(ruleset);
      },
    };
  });
}

/** The editions whose rules are loaded, in the order they are offered. */
export const editionsIn = (packRulesets: string[]): Ruleset[] =>
  EDITIONS.filter((e) => packRulesets.includes(e));
