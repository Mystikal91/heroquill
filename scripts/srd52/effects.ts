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
  // Using it heals 1d10 plus the Fighter level.
  "fighter-second-wind": [
    { type: "uses", term: 2, recharge: "short", minLevel: 1 },
    { type: "uses", term: 3, recharge: "short", minLevel: 4 },
    { type: "uses", term: 4, recharge: "short", minLevel: 10 },
    { type: "selfHeal", dice: "1d10", perLevel: 1 },
  ],
  // The Attack action makes two, three, then four attacks: three features, each replacing the one before.
  "fighter-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "fighter-two-extra-attacks": [{ type: "extraAttack", attacks: 3 }],
  "fighter-three-extra-attacks": [{ type: "extraAttack", attacks: 4 }],
  // One use, two from level 17.
  "fighter-action-surge": [
    { type: "uses", term: 1, recharge: "short", minLevel: 2 },
    { type: "uses", term: 2, recharge: "short", minLevel: 17 },
  ],
  // Three uses from level 17 is the table's; 1 at 9, 2 at 13, 3 at 17.
  "fighter-indomitable": [
    { type: "uses", term: 1, recharge: "long", minLevel: 9 },
    { type: "uses", term: 2, recharge: "long", minLevel: 13 },
    { type: "uses", term: 3, recharge: "long", minLevel: 17 },
  ],
  "champion-improved-critical": [{ type: "critRange", min: 19 }],
  "champion-superior-critical": [{ type: "critRange", min: 18 }],
};

/**
 * Effects of the 2024 feats, by feat slug. The Fighting Style feats are the 2014 styles, now feats
 * a class feature lets the person pick. A feat that is not here is text only (Savage Attacker, the
 * Epic Boons, Magic Initiate, which wait for the spells of the 2024 list).
 */
export const FEAT_EFFECTS: Record<string, Effect[]> = {
  archery: [{ type: "modifier", target: "attack", value: 2, when: "ranged" }],
  defense: [{ type: "modifier", target: "ac", value: 1, when: "wearingArmor" }],
  // The off-hand weapon adds its ability modifier to damage (the engine reads this flag by name).
  "two-weapon-fighting": [{ type: "flag", id: "two-weapon-fighting" }],
  // Initiative Proficiency: the proficiency bonus on the roll.
  alert: [{ type: "modifier", target: "initiative", value: 0, plus: "proficiency" }],
};

/**
 * Class features that are a pick of feats of one category, by feature slug: the Fighting Style of
 * the Fighter and the Champion's second one, and the Fighter's Epic Boon.
 */
export const FEAT_PICKS: Record<string, { category: string; id: string }> = {
  "fighter-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "champion-additional-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "fighter-epic-boon": { category: "epic-boon", id: "epic-boon" },
};

/**
 * Features that stand in for the step before them (the Fighter's Extra Attack grows by three features): feature slug
 * to the slug it replaces. The sheet hides the older step and the new one says what it replaces.
 */
export const REPLACES: Record<string, string> = {
  "fighter-two-extra-attacks": "fighter-extra-attack",
  "fighter-three-extra-attacks": "fighter-two-extra-attacks",
};

/** How a feature is used: `bonus` for a Bonus Action, `action` for an action, `reaction`. */
export const ACTIVATION: Record<string, "action" | "bonus" | "reaction"> = {
  "fighter-second-wind": "bonus",
};
