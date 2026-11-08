/**
 * Prices and weights where the database we build from still disagrees with the SRD 5.2.1 text. The
 * source is the maintainer's fork of `5e-srd-api` (`source.json`), which holds the corrections sent to the
 * original; what is left here was found by comparing the fork with the PDF (`SRD_CC_v5.2.1.pdf`, the
 * equipment tables, pages 90 to 96). The build warns when a fix is no longer needed (the source already
 * says the same), so the table empties by itself and this file can then go.
 *
 * `weight: null` means the book shows no weight (a dash), so the item has none (the database writes 0).
 */
export interface EquipmentFix {
  cost?: { quantity: number; unit: "gp" | "sp" | "cp" };
  weight?: number | null;
  /** A weapon's damage, and its damage held in two hands (Versatile), as dice and type. */
  damage?: { dice: string; type: string };
  twoHandedDamage?: { dice: string; type: string };
}

export const EQUIPMENT_FIXES: Record<string, EquipmentFix> = {
  // The fork has 4 GP: the book's price is in silver pieces ("Basket (4 SP)").
  basket: { cost: { quantity: 4, unit: "sp" } },
  // Still 5 GP in the fork; the book says "Blanket (5 SP)".
  blanket: { cost: { quantity: 5, unit: "sp" } },
  // The fork has 5 GP and 6 lb; the book: "Clothes, Traveler's (2 GP)" and 4 lb.
  "clothes-travelers": { cost: { quantity: 2, unit: "gp" }, weight: 4 },
};
