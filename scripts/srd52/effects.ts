/**
 * Effects of the 2024 features, written by hand from the book (the database has text only), as the
 * 5.1 build does in `scripts/srd51/effects.ts`. Keyed by the feature slug (the 5e-database index;
 * a subclass feature is `<subclass>-<name>`). A feature that is not here is text only.
 *
 * Pilot set: Fighter and Champion. Weapon Mastery, Tactical Mind, Studied Attacks and the Fighting
 * Style / Epic Boon feat picks wait for the engine work listed in the 2024 gap list.
 */
import type { Effect } from "../../src/data/schema";

export const FEATURE_EFFECTS: Record<string, Effect[]> = {
  // Two uses at level 1, three at 4, four at 10 (the Fighter Features table).
  "fighter-second-wind": [
    { type: "uses", term: 2, recharge: "short", minLevel: 1 },
    { type: "uses", term: 3, recharge: "short", minLevel: 4 },
    { type: "uses", term: 4, recharge: "short", minLevel: 10 },
  ],
  // One use, two from level 17.
  "fighter-action-surge": [
    { type: "uses", term: 1, recharge: "short", minLevel: 2 },
    { type: "uses", term: 2, recharge: "short", minLevel: 17 },
  ],
  "champion-improved-critical": [{ type: "critRange", min: 19 }],
  "champion-superior-critical": [{ type: "critRange", min: 18 }],
};

/** How a feature is used: `bonus` for a Bonus Action, `action` for an action, `reaction`. */
export const ACTIVATION: Record<string, "action" | "bonus" | "reaction"> = {
  "fighter-second-wind": "bonus",
};
