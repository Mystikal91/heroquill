/**
 * Builds `data/srd52/*.json` (content packs) and `locales/en/srd52/*.json` (English strings) from the
 * pinned 2024 5e-database source. Usage: `npm run data:srd52`. This is the pilot: see `convert.ts`.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { type Pack, findBrokenReferences, parsePack } from "../../src/data/schema";
import { type RawSource, convertAll } from "./convert";
import { CACHE_DIR, fetchSource } from "./fetch";
import { pairItems } from "./pairs";
import source from "./source.json" with { type: "json" };

const ATTRIBUTION =
  "This work includes material taken from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC and available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.";

const FILE_NAMES: Record<string, string> = {
  ability: "abilities",
  skill: "skills",
  language: "languages",
  proficiency: "proficiencies",
  feat: "feats",
  background: "backgrounds",
  species: "species",
  trait: "traits",
  class: "classes",
  subclass: "subclasses",
  spell: "spells",
  school: "schools",
  condition: "conditions",
  feature: "features",
  item: "items",
  property: "properties",
};

const readJson = async (name: string) =>
  JSON.parse(await readFile(join(CACHE_DIR, `${name}.json`), "utf8"));

const write = (path: string, value: unknown) =>
  writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

await fetchSource();
const raw: RawSource = {
  abilityScores: await readJson("5e-SRD-Ability-Scores"),
  skills: await readJson("5e-SRD-Skills"),
  languages: await readJson("5e-SRD-Languages"),
  proficiencies: await readJson("5e-SRD-Proficiencies"),
  feats: await readJson("5e-SRD-Feats"),
  backgrounds: await readJson("5e-SRD-Backgrounds"),
  species: await readJson("5e-SRD-Species"),
  traits: await readJson("5e-SRD-Traits"),
  classes: await readJson("5e-SRD-Classes"),
  levels: await readJson("5e-SRD-Levels"),
  features: await readJson("5e-SRD-Features"),
  subclasses: await readJson("5e-SRD-Subclasses"),
  weaponMastery: await readJson("5e-SRD-Weapon-Mastery-Properties"),
  equipment: await readJson("5e-SRD-Equipment"),
  weaponProperties: await readJson("5e-SRD-Weapon-Properties"),
  spells: await readJson("5e-SRD-Spells"),
  magicSchools: await readJson("5e-SRD-Magic-Schools"),
  conditions: await readJson("5e-SRD-Conditions"),
};

const converted = convertAll(raw);
const manifest = {
  id: "srd52",
  ruleset: "srd52",
  version: source.databaseVersion,
  license: "CC-BY-4.0",
  attribution: ATTRIBUTION,
};

const dataDir = join("data", "srd52");
const localeDir = join("locales", "en", "srd52");
await mkdir(dataDir, { recursive: true });
await mkdir(localeDir, { recursive: true });

const packs: Pack[] = [];
for (const [kind, { entries, strings }] of Object.entries(converted)) {
  const file = FILE_NAMES[kind];
  if (!file) throw new Error(`No file name for ${kind}`);
  const pack = parsePack({ manifest, entries });
  packs.push(pack);
  await write(join(dataDir, `${file}.json`), pack);
  await write(join(localeDir, `${file}.json`), strings);
  console.log(`${file}: ${entries.length} entries, ${Object.keys(strings).length} strings`);
}

const broken = findBrokenReferences(packs);
if (broken.length) {
  console.warn(
    `${broken.length} unresolved references, e.g.:\n  ${broken.slice(0, 8).join("\n  ")}`,
  );
  process.exitCode = 1;
}

// The items that are the same in the 2014 pack: what a conversion between editions starts from.
const items51 = JSON.parse(await readFile(join("data", "srd51", "items.json"), "utf8")).entries.map(
  (e: { id: string }) => e.id,
);
const pairs = pairItems(converted.item?.entries.map((e) => e.id) ?? [], items51);
await write(join("src", "data", "srd52Pairs.json"), pairs);
console.log(
  `item pairs: ${Object.keys(pairs.items).length} paired, ${pairs.onlyIn2024.length} only in 2024`,
);
console.log(`  only in 2024: ${pairs.onlyIn2024.map((id) => id.split("/")[1]).join(", ")}`);
