/**
 * Which rules an entry belongs to. The SRD packs carry their edition in the id prefix (`srd51:`,
 * `srd52:`); a pack the person added (Aurora, homebrew) has any other prefix and belongs to every
 * edition. A character sees its own edition's SRD plus those packs, never the other SRD.
 */
export const inRuleset = (entryId: string, ruleset: string): boolean =>
  entryId.startsWith(`${ruleset}:`) || !/^srd\d+:/.test(entryId);
