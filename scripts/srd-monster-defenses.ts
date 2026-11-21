/**
 * Puts the damage defenses of the monsters in the data (`damageVulnerabilities`, `damageResistances`,
 * `damageImmunities`: lists of kinds of damage) from the English texts, for both editions, without
 * building the packs again. The 2014 build (`npm run data:srd51`) writes the same fields itself from
 * its source; the 2024 texts come from a supplement, so run this after `npm run data:srd52`.
 *
 *   npx tsx scripts/srd-monster-defenses.ts
 */
import { readFile, writeFile } from "node:fs/promises";
import { plainDamageTypes } from "./srd51/defenses";

const FIELDS = [
  ["damageVulnerabilities", "vulnerabilities"],
  ["damageResistances", "resistances"],
  ["damageImmunities", "immunities"],
] as const;

for (const edition of ["srd51", "srd52"]) {
  const dataPath = `data/${edition}/monsters.json`;
  const textPath = `locales/en/${edition}/monsters.json`;
  const pack = JSON.parse(await readFile(dataPath, "utf8")) as {
    entries: { id: string; data: Record<string, unknown> }[];
  };
  const texts = JSON.parse(await readFile(textPath, "utf8")) as Record<string, string>;
  let changed = 0;
  for (const entry of pack.entries) {
    const slug = entry.id.split("/")[1] ?? "";
    for (const [field, key] of FIELDS) {
      const kinds = plainDamageTypes(texts[`${slug}.${key}`]);
      const before = JSON.stringify(entry.data[field]);
      if (kinds.length > 0) entry.data[field] = kinds;
      else delete entry.data[field];
      if (JSON.stringify(entry.data[field]) !== before) changed += 1;
    }
  }
  await writeFile(dataPath, `${JSON.stringify(pack, null, 2)}\n`);
  console.log(`${edition}: ${changed} fields written`);
}
