/**
 * Facts of an entry that follow from others, kept in step when the person changes one: the
 * proficiency that makes a weapon or an armor usable follows its category, so the person never has
 * to write `weapon:martial-weapons` by hand.
 */
const WEAPON = ["weapon:simple-weapons", "weapon:martial-weapons"];
const ARMOR = ["armor:light-armor", "armor:medium-armor", "armor:heavy-armor", "armor:shields"];

export function syncItemData(data: Record<string, unknown>): Record<string, unknown> {
  const next = { ...data };
  // The proficiency follows the category until someone picks others (a list of their own is kept).
  const own = (list: unknown, defaults: string[]) =>
    Array.isArray(list) && list.length > 0 && !(list.length === 1 && defaults.includes(list[0]));
  const weapon = data.weapon as { category?: string; proficiency?: unknown } | undefined;
  if (weapon && typeof weapon === "object" && weapon.category && !own(weapon.proficiency, WEAPON))
    next.weapon = {
      ...weapon,
      proficiency: [`weapon:${weapon.category === "martial" ? "martial" : "simple"}-weapons`],
    };
  const armor = data.armor as { category?: string; proficiency?: unknown } | undefined;
  if (armor && typeof armor === "object" && armor.category && !own(armor.proficiency, ARMOR))
    next.armor = {
      ...armor,
      proficiency: [
        armor.category === "shield" ? "armor:shields" : `armor:${armor.category ?? "light"}-armor`,
      ],
    };
  return next;
}
