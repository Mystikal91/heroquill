/**
 * Prints the words the app uses in each language, read from the `ui.json` files so that the list is
 * never out of date: the names of the tabs, the terms of the game, and whatever is searched for.
 *
 *   node scripts/glossary.mjs               the terms below
 *   node scripts/glossary.mjs "spell slot"  every short interface text whose English has these words
 */
import { readFileSync } from "node:fs";

const LANGUAGES = ["en", "it", "fr", "de", "es"];
const TERMS =
  `tab.build tab.sheet tab.play tab.rules tab.print bar.new welcome.master.title packs.title studio.title
  form.species form.subspecies form.background form.class form.level build.abilities
  sheet.skills sheet.savingThrow sheet.proficient sheet.proficiencies sheet.proficiencyBonus sheet.classFeatures
  sheet.speciesTraits sheet.feats sheet.armorClass sheet.hitPoints sheet.hitDice sheet.initiative sheet.speed
  sheet.passivePerception sheet.attacks sheet.spellcasting sheet.spellSlots sheet.spellSaveDc sheet.defenses
  sheet.resistances sheet.immunities sheet.inventory spells.cantrips spells.concentration spells.ritual
  play.deathSaves play.rests play.conditions play.inspiration play.rage play.wildShape`.split(
    /\s+/,
  );
const MAX_LENGTH = 60;

const texts = Object.fromEntries(
  LANGUAGES.map((lang) => [
    lang,
    JSON.parse(readFileSync(new URL(`../locales/${lang}/ui.json`, import.meta.url), "utf8")),
  ]),
);
const wanted = process.argv[2]?.toLowerCase();
const keys = wanted
  ? Object.keys(texts.en).filter(
      (key) => texts.en[key].length <= MAX_LENGTH && texts.en[key].toLowerCase().includes(wanted),
    )
  : TERMS.filter((key) => key in texts.en);
console.log(["key", ...LANGUAGES].join(" | "));
for (const key of keys)
  console.log([key, ...LANGUAGES.map((lang) => texts[lang][key] ?? "-")].join(" | "));
