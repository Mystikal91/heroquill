import { content } from "../app/store";
import type { DamageReduction } from "../engine/damageReduction";
import { ui } from "../i18n/ui";
import { damageName } from "./damageName";

/** "−3 bludgeoning, piercing, slashing (Heavy Armor Master) · nonmagical attacks": one reduction in words. */
export function reductionLabel(r: DamageReduction): string {
  const kinds = r.damage ? ` ${r.damage.map(damageName).join(", ")}` : "";
  const from = r.source ? ` (${content.value?.name(r.source) ?? r.source})` : "";
  return `\u2212${r.amount}${kinds}${from}${r.note ? ` \u00b7 ${r.note}` : ""}`;
}

/** One reduction as a row of the lists: what it is and where it comes from on the left, the amount on the right. */
export function reductionRow(r: DamageReduction): [name: string, value: string] {
  const kinds = r.damage ? `: ${r.damage.map(damageName).join(", ")}` : "";
  const from = r.source ? ` (${content.value?.name(r.source) ?? r.source})` : "";
  return [
    `${ui("sheet.damageReduction")}${from}${kinds}${r.note ? ` \u00b7 ${r.note}` : ""}`,
    `\u2212${r.amount}`,
  ];
}
