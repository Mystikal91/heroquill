/**
 * The damage defenses of a monster as data. The SRD lists them as sentences ("acid; fire; and
 * bludgeoning, piercing, and slashing from nonmagical weapons"); the tracker of the DM mode needs the
 * plain kinds to take a resistance off a hit by itself. Only the entries that are one kind of damage and
 * nothing else are read: one with a condition ("from nonmagical weapons") stays a sentence, and the DM
 * applies it by hand.
 */
export const DAMAGE_KINDS = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
] as const;

/** The kinds of damage that the text names on their own, in the order they are written. */
export function plainDamageTypes(text: string | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const part of text.split(";")) {
    const kind = part.trim().toLowerCase();
    if ((DAMAGE_KINDS as readonly string[]).includes(kind) && !found.includes(kind))
      found.push(kind);
  }
  return found;
}

/** The `data` fields of a monster for its defenses: only the lists that are not empty. */
export function damageDefenses(m: {
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
}): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const add = (field: string, list: string[] | undefined) => {
    const kinds = plainDamageTypes((list ?? []).join("; "));
    if (kinds.length > 0) out[field] = kinds;
  };
  add("damageVulnerabilities", m.damage_vulnerabilities);
  add("damageResistances", m.damage_resistances);
  add("damageImmunities", m.damage_immunities);
  return out;
}
