/**
 * Prices, weights and weapon damage where `5e-database` (2024) disagrees with the SRD 5.2.1 text. Each
 * value below was compared with the equipment tables of the PDF (`SRD_CC_v5.2.1.pdf`, pages 90 to 96). The
 * database is wrong in these places (a longbow costs 50 GP, not 5; a spear 1 GP and 3 lb, not 5 GP and
 * 2 lb; the trident still has its 2014 damage); they are kept here until the database is corrected. The
 * build warns when a fix is no longer needed (the source already says the same), so the table shrinks by
 * itself.
 *
 * `weight: null` means the book shows no weight (a dash), so the item has none.
 */
export interface EquipmentFix {
  cost?: { quantity: number; unit: "gp" | "sp" | "cp" };
  weight?: number | null;
  /** A weapon's damage, and its damage held in two hands (Versatile), as dice and type. */
  damage?: { dice: string; type: string };
  twoHandedDamage?: { dice: string; type: string };
}

export const EQUIPMENT_FIXES: Record<string, EquipmentFix> = {
  "alchemists-fire": { cost: { quantity: 50, unit: "gp" } },
  antitoxin: { weight: null },
  basket: { cost: { quantity: 4, unit: "sp" } },
  bedroll: { cost: { quantity: 1, unit: "gp" }, weight: 7 },
  bell: { weight: null },
  blanket: { cost: { quantity: 5, unit: "sp" } },
  "burglars-pack": { weight: 42 },
  caltrops: { cost: { quantity: 1, unit: "gp" } },
  chain: { weight: 10 },
  "chain-shirt": { weight: 20 },
  chest: { cost: { quantity: 5, unit: "gp" }, weight: 25 },
  "climbers-kit": { weight: 12 },
  "clothes-fine": { weight: 6 },
  "clothes-travelers": { cost: { quantity: 2, unit: "gp" } },
  "component-pouch": { cost: { quantity: 25, unit: "gp" }, weight: 2 },
  dart: { cost: { quantity: 5, unit: "cp" } },
  "diplomat-pack": { weight: 39 },
  "hand-crossbow": { cost: { quantity: 75, unit: "gp" }, weight: 3 },
  javelin: { cost: { quantity: 5, unit: "sp" } },
  longbow: { cost: { quantity: 50, unit: "gp" } },
  mace: { weight: 4 },
  parchment: { cost: { quantity: 1, unit: "sp" } },
  pike: { weight: 18 },
  "poisoners-kit": { cost: { quantity: 50, unit: "gp" } },
  robe: { weight: 4 },
  spear: { cost: { quantity: 1, unit: "gp" }, weight: 3 },
  "spikes-iron": { weight: 5 },
  // The database has the sling as piercing (the book: bludgeoning) and the trident with its 2014 damage
  // (1d6, 1d8 in two hands); the 2024 trident is 1d8 and 1d10 ("Converting to SRD 5.2.1" says so too).
  sling: { damage: { dice: "1d4", type: "bludgeoning" } },
  trident: {
    damage: { dice: "1d8", type: "piercing" },
    twoHandedDamage: { dice: "1d10", type: "piercing" },
  },
};
