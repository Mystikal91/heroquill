import type { Effect } from "../../data/schema";

/**
 * The feats of the books that take a flat amount off a hit, written by hand: Aurora has them only as a
 * sentence, with no rule behind it. Each line was read in the book's own text. The 2014 feat reduces
 * the damage of nonmagical attacks by 3; the 2024 one reduces it by the proficiency bonus, with no
 * word about magic. The reactions that roll a die (Deflect Missiles, Parry, Interception) are not here:
 * they are something to do, not a number to keep.
 */
const SLASHING_ETC = ["bludgeoning", "piercing", "slashing"];

export const DAMAGE_REDUCTIONS: Record<string, Effect> = {
  ID_PHB_FEAT_HEAVYARMORMASTER: {
    type: "damageReduction",
    value: 3,
    damage: SLASHING_ETC,
    when: "heavyArmor",
    note: "nonmagical attacks",
  },
  ID_WOTC_PHB24_FEAT_HEAVY_ARMOR_MASTER: {
    type: "damageReduction",
    value: 0,
    plus: "proficiency",
    damage: SLASHING_ETC,
    when: "heavyArmor",
  },
};

/** The reduction of a feat, as the effect the sheet reads. */
export const damageReductionEffects = (aid: string): Effect[] => {
  const effect = DAMAGE_REDUCTIONS[aid];
  return effect ? [effect] : [];
};
