/**
 * Facts of an entry that follow from others, kept in step when the person changes one: the
 * proficiency that makes a weapon or an armor usable follows its category, so the person never has
 * to write `weapon:martial-weapons` by hand.
 */
export function syncItemData(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  const weapon = data.weapon as { category?: string } | undefined;
  if (weapon && typeof weapon === "object")
    next.weapon = {
      ...weapon,
      proficiency: [`weapon:${weapon.category === "martial" ? "martial" : "simple"}-weapons`],
    };
  const armor = data.armor as { category?: string } | undefined;
  if (armor && typeof armor === "object")
    next.armor = {
      ...armor,
      proficiency: [
        armor.category === "shield" ? "armor:shields" : `armor:${armor.category ?? "light"}-armor`,
      ],
    };
  return next;
}
