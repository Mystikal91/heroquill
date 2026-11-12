/**
 * Which rules an entry belongs to. The SRD packs carry their edition in the id prefix (`srd51:`,
 * `srd52:`); a pack the person added (Aurora, homebrew) has any other prefix and belongs to every
 * edition. A character sees its own edition's SRD plus those packs, never the other SRD.
 */
export const inRuleset = (entryId: string, ruleset: string): boolean =>
  entryId.startsWith(`${ruleset}:`) || !/^srd\d+:/.test(entryId);

/**
 * Whether a subclass belongs to a class. The parent of a subclass from a book (Aurora) is the 2014 SRD class it
 * was written for (`srd51:class/fighter`): the 2024 class of the same name takes it too, as a table plays a 2014
 * subclass on the new class. The subclasses of the SRD itself stay with their own edition's class.
 */
export function subclassOf(
  sub: { id: string; parent?: string | undefined },
  classId: string,
): boolean {
  if (sub.parent === classId) return true;
  const slug = classId.startsWith("srd52:class/")
    ? classId.slice("srd52:class/".length)
    : undefined;
  return Boolean(slug && !/^srd\d+:/.test(sub.id) && sub.parent === `srd51:class/${slug}`);
}
