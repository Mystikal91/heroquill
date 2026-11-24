/**
 * Adds, replaces or removes texts in the `ui.json` of the languages, keeping the order of the keys, the
 * line endings and the final line of each file. Nothing is written unless everything is in order.
 *
 *   node scripts/locale-set.mjs texts.json
 *
 * with `{ "some.key": { "en": "...", "it": "..." }, "old.key": null }`: a new key goes at the end and
 * needs English, a key that is there is replaced in the languages given, null removes it from every one.
 * The placeholders (`{n}`) must be those of the English text. What a language lacks is listed.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LANGUAGES = ["en", "it", "fr", "de", "es"];
const path = (lang) => new URL(`../locales/${lang}/ui.json`, import.meta.url);
const marks = (text) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort().join(" ");

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/locale-set.mjs texts.json");
  process.exit(2);
}
const texts = JSON.parse(readFileSync(file, "utf8"));
const raw = Object.fromEntries(LANGUAGES.map((lang) => [lang, readFileSync(path(lang), "utf8")]));
const english = JSON.parse(raw.en);
const problems = [];
const missing = [];
const changed = Object.fromEntries(LANGUAGES.map((lang) => [lang, 0]));

/** The line of a key, with the comma it may end with. The files have one key to a line. */
const lineOf = (key) =>
  new RegExp(
    `^([ \\t]*${JSON.stringify(key).replace(/[.*+?^\${}()|[\]\\]/g, "\\$&")}: )"(?:[^"\\\\]|\\\\.)*"(,?)`,
    "m",
  );

for (const [key, values] of Object.entries(texts)) {
  if (values === null) {
    for (const lang of LANGUAGES) {
      const line = lineOf(key).exec(raw[lang]);
      if (!line) continue;
      const nl = raw[lang].includes("\r\n") ? "\r\n" : "\n";
      const end = line.index + line[0].length;
      raw[lang] = line[2]
        ? raw[lang].slice(0, line.index) + raw[lang].slice(end + nl.length)
        : raw[lang].slice(0, line.index).replace(/,\s*$/, "") + raw[lang].slice(end);
      changed[lang]++;
    }
    continue;
  }
  const source = values.en ?? english[key];
  if (source === undefined) {
    problems.push(`${key}: a new key needs its English text`);
    continue;
  }
  for (const [lang, text] of Object.entries(values)) {
    if (!LANGUAGES.includes(lang)) problems.push(`${key}: unknown language "${lang}"`);
    else if (typeof text !== "string" || text.trim() === "") problems.push(`${key}.${lang}: empty`);
    else if (marks(text) !== marks(source))
      problems.push(`${key}.${lang}: has [${marks(text)}], English has [${marks(source)}]`);
    else {
      const nl = raw[lang].includes("\r\n") ? "\r\n" : "\n";
      const value = JSON.stringify(text);
      if (lineOf(key).test(raw[lang]))
        raw[lang] = raw[lang].replace(lineOf(key), (_, start, comma) => start + value + comma);
      else {
        const body = raw[lang].slice(0, raw[lang].lastIndexOf("}")).trimEnd();
        raw[lang] = `${body},${nl}  ${JSON.stringify(key)}: ${value}${nl}}${nl}`;
      }
      changed[lang]++;
    }
  }
  const lacking = LANGUAGES.filter((lang) => values[lang] === undefined);
  if (lacking.length > 0) missing.push(`${key}: not given in ${lacking.join(", ")}`);
}

for (const lang of LANGUAGES) {
  try {
    const result = JSON.parse(raw[lang]);
    for (const [key, values] of Object.entries(texts))
      if (
        values === null ? key in result : values[lang] !== undefined && result[key] !== values[lang]
      )
        problems.push(`${key}.${lang}: not written as asked`);
  } catch (error) {
    problems.push(`${lang}: the file would not be valid JSON (${error.message})`);
  }
}
if (problems.length > 0) {
  console.error(`Nothing written.\n${problems.map((p) => `- ${p}`).join("\n")}`);
  process.exit(1);
}
for (const lang of LANGUAGES) if (changed[lang] > 0) writeFileSync(path(lang), raw[lang]);
console.log(LANGUAGES.map((lang) => `${lang}: ${changed[lang]}`).join("  "));
for (const line of missing) console.log(`! ${line}`);
