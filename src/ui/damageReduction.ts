import { content } from "../app/store";
import type { DamageReduction } from "../engine/damageReduction";
import { damageName } from "./damageName";

/** "−3 bludgeoning, piercing, slashing (Heavy Armor Master) · nonmagical attacks": one reduction in words. */
export function reductionLabel(r: DamageReduction): string {
  const kinds = r.damage ? ` ${r.damage.map(damageName).join(", ")}` : "";
  const from = content.value?.name(r.source) ?? r.source;
  return `\u2212${r.amount}${kinds} (${from})${r.note ? ` \u00b7 ${r.note}` : ""}`;
}
