import { signal } from "@preact/signals";
import type { LevelUpSummary } from "../engine/levelUp";

export type StepId =
  | "origin"
  | "background"
  | "class"
  | "abilities"
  | "choices"
  | "spells"
  | "equipment"
  | "story"
  | "features"
  | "freeEdit";

/**
 * What the build screen shows: one step, or "ready" (the sheet can be played, and what is left to
 * refine). Undefined lets the screen choose: the first of the basics not done, or "ready" when they all are.
 */
export const openStep = signal<StepId | "ready" | undefined>(undefined);

/** Where the level up flow is: closed, choosing the class, or showing what is left to do. */
export const levelUpPhase = signal<"closed" | "choose" | "done">("closed");

/** What the last level up brought, shown on the "done" screen. */
export const levelUpResult = signal<LevelUpSummary | undefined>(undefined);
