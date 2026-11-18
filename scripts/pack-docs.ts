/**
 * Writes the reference tables of `docs/PACK_FORMAT.md` from the catalog of the editor, so they can
 * not drift from the code: the kinds of entry, the fields of the `data` of each, and the effects
 * with their fields. Run with `npm run docs:pack`; a test fails when the page is out of date.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ENTRY_KINDS } from "../src/data/schema";
import {
  DATA_FIELDS,
  EFFECT_TYPES,
  type EffectType,
  type FieldSpec,
  type FieldType,
  KIND_META,
  effectFields,
} from "../src/homebrew/catalog";

export const MARK_START = "<!-- generated:reference -->";
export const MARK_END = "<!-- /generated:reference -->";

/** A type in a few words: `text`, `number`, `list of entry id (spell)`, `object { a, b? }`... */
export function describe(type: FieldType): string {
  switch (type.type) {
    case "text":
      if (type.options) return `${type.options.map((o) => `\`${o}\``).join(" or ")} (a menu)`;
      return type.pick ? `text (picked: ${type.pick})` : "text";
    case "number": {
      const bits = [
        type.integer && "integer",
        type.min !== undefined && `min ${type.min}`,
        type.max !== undefined && `max ${type.max}`,
        type.unit && (type.unit === "distance" ? "feet" : "pounds"),
      ].filter(Boolean);
      return bits.length ? `number (${bits.join(", ")})` : "number";
    }
    case "boolean":
      return "boolean";
    case "choice":
      return type.options.map((o) => `\`${o}\``).join(" or ");
    case "literal":
      return `\`${JSON.stringify(type.value)}\``;
    case "ref":
      return type.kinds?.length ? `entry id (${type.kinds.join(", ")})` : "entry id";
    case "slug":
      return `slug of a ${type.kind}`;
    case "dice":
      return "dice (`1d8`, `2d6+3`)";
    case "list":
      return `list of ${describe(type.of)}`;
    case "object":
      return `object { ${type.fields.map((f) => f.key + (f.optional ? "?" : "")).join(", ")} }`;
    case "record": {
      const where = type.levels
        ? ` by ${type.levels === "slot" ? "spell slot level (1-9)" : "character level (1-20)"}`
        : type.keys
          ? ` by ${type.keys.join(", ")}`
          : " by key";
      return `record of ${describe(type.of)}${where}`;
    }
    case "union":
      return type.of.map(describe).join(" or ");
    case "variant":
      return `one of (by \`${type.on}\`): ${Object.keys(type.cases)
        .map((c) => `\`${c}\``)
        .join(", ")}`;
    case "effects":
      return "list of effects";
    case "json":
      return "any JSON";
  }
}

/**
 * What each effect does, in a few sentences. The type is exhaustive on purpose: an effect added to
 * the engine does not compile here until it is explained, so the page cannot miss one.
 */
const NOTES: Record<EffectType, string> = {
  flag: 'Sets a name that `when.requires` can ask for, for a rule that says "this is held" without being an entry. It counts only where the effect itself applies, so a flag inside a `when` is set only while that holds.',
  abilityBonus:
    "Raises an ability score by `value`. `max` is the most the score may reach with it (24 for a barbarian's Primal Champion); 20 when absent, and the sheet warns above it.",
  proficiency:
    "Proficiency in one thing. `category` is `skill`, `save`, `weapon`, `armor`, `tool` or `language`; `target` is the slug of an entry of the matching kind (`arcana`, `smiths-tools`, `simple-weapons`, `common`) or, for a save, an ability (`wis`).",
  trait:
    "Gives the character a trait: another entry (kind `trait` or `feature`) with its own text and effects. This is how a species, a subspecies, a class, a feature or an option owns its traits. `minLevel` makes the trait come with that level (of the class that gives it, of the whole character for a species).",
  choice:
    "The person picks `choose` of the options in `from`. `grants` says what each pick is: `proficiency` (options are `category:target`, such as `skill:arcana`), `language` (language slugs), `spell` (entry ids, or no `from` to open the whole list through `spellLevel`, `spellUpTo`, `spellClass` and `ritual`), `trait` (entry ids), `abilityBonus` (ability ids, `value` each), `expertise` (skill slugs), `feat` (entry ids; an empty `from` offers every feat), `mastery` (weapon items) and `size` (creature sizes). A spell pick can be cast without a slot with `free` (`rest` says which rest) or `atWill`. `chooseBy` replaces the fixed `choose` by a column of the class table.",
  grantSpell:
    "Gives a spell. By default it is always prepared and does not count against the spells known; `minLevel` makes it come with that class level, `free` lets it be cast once between rests without a slot (`rest` says which rest), `atWill` lets it be cast as often as wanted without a slot and lists it with the cantrips.",
  unarmedStrike:
    "A natural weapon (claws, a bite): the unarmed strike rolls `dice` of `damageType` instead of its 1 and bludgeoning, and is shown even when a weapon is in hand.",
  spellDamage:
    "Adds the modifier of the ability `plus` to the damage that spells roll in Play. `spell`, `school` or `damageType` say which spells (all when none is given). `once` adds it to one roll of the spell instead of every roll.",
  spellHealing:
    "Changes the healing that spells roll in Play (only spells with a healing roll in their data, cast with a slot of 1st level or higher). `plusSlotLevel` adds that number and the level of the slot to every roll; `maxDice` gives the highest number on every die; `selfPlusSlotLevel` heals the caster that much plus the slot level when the healing is for someone else.",
  extraDamage:
    "Damage a feature adds to attacks, rolled by a card of its own in Play. The dice are those of the highest `steps` entry whose `minLevel` the class level reaches. `note` picks the sentence that says when it applies (`oncePerTurn`).",
  modifier:
    "A flat bonus to a number of the sheet. `target` is `ac`, `speed`, `initiative`, `attack`, `damage`, `hpPerLevel`, `hp`, `save` (every saving throw), `skill` (every skill, or the one in `skill`), `spellAttack` or `spellDc`. `plus` adds the proficiency bonus or an ability modifier to `value`; `min` is the least the total can be; `when` narrows it to what the character wears or wields (`wearingArmor`, `unarmored`, `noHeavyArmor`, `unarmoredNoShield`, `wearingShield`, `ranged`, `melee`, `dueling`); `minLevel` starts it at a level.",
  movement:
    'A climbing, swimming, flying or burrowing speed in feet, or `"walk"` for one equal to the walking speed. The best one counts and bonuses to speed add to it.',
  sense: "A sense with a range in feet. The longest one counts.",
  attunementMax:
    "The number of items the character can be attuned to at once, when it is more than three.",
  expertise:
    "Double proficiency bonus on a skill the character is already proficient in (`skill` is the slug of a skill).",
  size: "The size of the creature, for a species that lets the person pick one through a `choice` that grants `size`. A species with one size has it in `data.size`.",
  speedMultiplier:
    "Every speed is multiplied by `value` (2 for Haste), after the bonuses to the speed.",
  rollDie:
    "A die rolled and added to some rolls while the effect holds (Bless: `die` 4 `on` attack and save). `on` lists `check`, `attack` and `save`; Play rolls the die with the d20 and writes it in the log. With `once` the first roll it is added to spends it, and the spell or effect that gave it ends (Guidance).",
  armorClassFloor:
    "The armor class is at least `value`, whatever armor is worn (Barkskin): if the calculation is lower the sheet makes up the difference, before the bonuses that come on top of it.",
  abilityFloor:
    "The ability score is at least `value` (Gauntlets of Ogre Power); it never lowers it.",
  weaponAbility:
    "Attacks with weapons may use `ability` instead of Strength or Dexterity; the best ability that applies wins. `when` narrows the weapons to one-handed ones (`oneHanded`) or magic ones (`magic`); `proficient` asks for a weapon the character is proficient with.",
  defense:
    "A resistance, an immunity or a vulnerability to a kind of damage. `damage` is one of the thirteen of the rules or a kind the pack adds as an entry of kind `damage` (the end of its id).",
  damageReduction:
    'A flat amount taken off a hit (Heavy Armor Master: 3, or the proficiency bonus). `value` is the amount and `plus: "proficiency"` adds the proficiency bonus; `damage` lists the kinds it covers (every kind when absent); `when` is what the character must wear (`heavyArmor`, `wearingArmor`...); `note` is a condition in words, such as "nonmagical attacks". The sheet and the Play screen list it with the resistances, immunities and vulnerabilities; the person does the sum, nothing is taken off by itself.',
  halfProficiency:
    "Half the proficiency bonus on ability checks that do not use it (Jack of All Trades): every ability, or only those in `abilities`. `round` is `down` or `up`.",
  unarmoredDefense:
    "Armor class without body armor: `base` + Dexterity + the abilities in `add`. `shield` says whether a shield may be carried; `noDex` leaves Dexterity out (a fixed natural armor).",
  weaponMastery:
    "The character can use the mastery property of this kind of weapon (`item` is a weapon item such as a longsword).",
  featureValue:
    'A number a feature shows on the sheet, such as the save DC of a breath weapon. The terms of one `name` add up; terms with a `minLevel` come once the level is reached. Terms with the same `bonus` do not stack: only the highest counts. A text term is shown as it is. `term` is a number, `{ "text": "..." }`, `{ "of": "proficiency" }` or `{ "of": "level" }`, `{ "mod": ability }`, `{ "score": ability }`, `{ "classLevel": slug }` or `{ "table": column }`.',
  conditionImmunity:
    "The character cannot be affected by this condition (`condition` is the slug of a condition entry).",
  extraAttack:
    "The Attack action makes `attacks` attacks, from the class level `minLevel` if it is given. Extra Attacks do not add up: the most counts.",
  selfHeal:
    "Using the feature heals the character `dice` plus `perLevel` times the level of the class that gives it, plus the modifier of `plus` if given, at least `minimum`. `martialArts` uses the monk's Martial Arts die. Play rolls it; the uses of the feature are its `uses`.",
  checkBoost:
    "After a failed ability check the character may add `dice` by using up one use of the feature in `spends`. If the check still fails, Play gives the use back when told so.",
  critRange:
    "The lowest die that is a critical hit with weapon attacks (`min`: 19 for a Champion). The lowest counts.",
  d20Floor:
    "A die lower than `value` counts as `value` on a check (Reliable Talent: `on` is `proficientSkills`). The highest counts.",
  uses: 'How many times a feature can be used between rests, ticked off in Play. `term` is the number: a plain number, or `{ "mod": ability }`, `{ "of": "level" }`, `{ "classLevel": slug }`, `{ "table": column }`. The terms of one entry add up; those with a `minLevel` replace one another. `recharge` is `short` or `long`. `pool: true` counts it as a number (points) instead of marks. `min` is the least the total can be. `reserve` adds the points to a named reserve declared by the pack, which every source with that name shares.',
  spends:
    "Using the feature takes `cost` points (1 when absent) from a pool: `pool` is the pool of a class (`ki`, `focus`, `channelDivinity`, `bardicInspiration`, `sorceryPoints`, `wildShape`), or `reserve` is a reserve declared by the pack.",
  resource: "A resource of its own with a maximum and a recharge (`short`, `long` or `dawn`).",
  when: 'Holds its `effects` only while `requires` is true, checked every time the sheet is worked out. The requirement is written with names (entry ids or flags), `,` for "and", `||` for "or", `!` for "not" and brackets to group.',
};

type RuleEntry = { id: string; kind: string; data?: Record<string, unknown> };

/** Every entry of the rules of an edition (`data/srd51`, `data/srd52`), read from the files the app ships. */
function rulesOf(edition: "srd51" | "srd52"): RuleEntry[] {
  const dir = new URL(`../data/${edition}/`, import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .flatMap((f) => {
      const file = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as
        | { entries: RuleEntry[] }
        | RuleEntry[];
      return Array.isArray(file) ? file : file.entries;
    });
}

/** The kinds whose ids the page lists (the rest, with hundreds of entries, follow the same pattern). */
const LISTED_KINDS = [
  "ability",
  "skill",
  "proficiency",
  "school",
  "condition",
  "language",
  "alignment",
  "property",
  "class",
  "subclass",
  "species",
  "subspecies",
  "background",
  "feat",
  "spell",
  "item",
] as const;

/** An id of the rules as the pages write it: the slug, or `category:target` for a proficiency. */
const nameOf = (e: RuleEntry) => {
  const slug = e.id.slice(e.id.indexOf("/") + 1);
  if (e.kind !== "proficiency") return slug;
  return `${String(e.data?.category ?? "?")}:${String(e.data?.target ?? slug)}`;
};

/** Words in lines of at most ~96 characters, for a block that is read as it is. */
function wrap(words: string[]): string {
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line}, ${w}` : w;
    if (next.length > 96 && line) {
      lines.push(`${line},`);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

/** The ids of the rules by kind: those both editions have, then those of one only. */
function rulesIds(): string[] {
  const a = rulesOf("srd51");
  const b = rulesOf("srd52");
  const out: string[] = ["### Ids of the rules", ""];
  out.push(
    "These are the ids of the shipped rules that a pack can refer to. The id of an entry is `srd51:kind/slug` for the 2014 rules and `srd52:kind/slug` for the 2024 rules; below, the slug of every entry of the kinds a pack usually refers to. A slug listed under *both* exists in the two editions (use `srd51:` or `srd52:` as the character requires: a reference to a 2014 spell is carried over to the 2024 one when it exists). `monster`, `feature` and `trait` have hundreds of entries and follow the same pattern.",
    "",
    "Where a field asks for the **slug of a word of the rules** (a skill, a school, a condition, a language, a proficiency target), write the slug without the pack and kind. A `proficiency` is written `category:target`, which is how `choice` options write it (`skill:arcana`, `tool:smiths-tools`); in a `proficiency` effect, `category` and `target` are separate fields.",
    "",
  );
  for (const kind of LISTED_KINDS) {
    const old = new Set(a.filter((e) => e.kind === kind).map(nameOf));
    const now = new Set(b.filter((e) => e.kind === kind).map(nameOf));
    const both = [...old].filter((n) => now.has(n)).sort();
    const only14 = [...old].filter((n) => !now.has(n)).sort();
    const only24 = [...now].filter((n) => !old.has(n)).sort();
    out.push(`#### \`${kind}\``, "");
    out.push(`${old.size} in the 2014 rules, ${now.size} in the 2024 rules.`, "");
    for (const [label, list] of [
      ["Both editions", both],
      ["Only the 2014 rules (`srd51`)", only14],
      ["Only the 2024 rules (`srd52`)", only24],
    ] as const) {
      if (list.length === 0) continue;
      out.push(`${label} (${list.length}):`, "", "```text", wrap(list), "```", "");
    }
  }
  return out;
}

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The rows of a table of fields; nested object fields follow as `parent.child` rows. */
function rows(fields: FieldSpec[], prefix = ""): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const key = `${prefix}${f.key}`;
    out.push(
      `| \`${key}\` | ${cell(describe(f.type))} | ${f.optional ? "no" : "**yes**"} | ${cell(f.doc ?? "")} |`,
    );
    const inner = f.type.type === "list" ? f.type.of : f.type;
    if (inner.type === "object")
      out.push(...rows(inner.fields, `${key}${f.type.type === "list" ? "[]." : "."}`));
    if (inner.type === "variant")
      for (const [tag, specs] of Object.entries(inner.cases))
        if (specs.length) out.push(...rows(specs, `${key}(${inner.on}=${tag}).`));
  }
  return out;
}

const HEAD = ["| Field | Type | Required | Notes |", "| --- | --- | --- | --- |"];

/** The generated part of the page. */
export function reference(): string {
  const out: string[] = [];
  out.push("### Kinds of entry", "");
  out.push("| Kind | Role | Group | Owns |", "| --- | --- | --- | --- |");
  for (const kind of ENTRY_KINDS) {
    const m = KIND_META[kind];
    out.push(
      `| \`${kind}\` | ${m.role} | ${m.group} | ${m.owns?.map((k) => `\`${k}\``).join(", ") ?? ""} |`,
    );
  }
  out.push("", "### The `data` of each kind", "");
  for (const kind of ENTRY_KINDS) {
    const specs = DATA_FIELDS[kind];
    out.push(`#### \`${kind}\``, "");
    if (specs.length === 0) {
      out.push("No fields: the entry is its name and its text.", "");
      continue;
    }
    out.push(...HEAD, ...rows(specs), "");
  }
  out.push("### Effects", "");
  out.push(
    `${EFFECT_TYPES.length} types. Every effect is an object with a \`type\` and the fields listed; the optional fields can be left out.`,
    "",
  );
  for (const type of EFFECT_TYPES) {
    const specs = effectFields(type);
    out.push(`#### \`${type}\``, "", NOTES[type], "");
    if (specs.length) out.push(...HEAD, ...rows(specs), "");
  }
  out.push(...rulesIds());
  return out.join("\n");
}

/** The page with its generated part replaced by `reference()`. */
export function withReference(page: string): string {
  const a = page.indexOf(MARK_START);
  const b = page.indexOf(MARK_END);
  if (a < 0 || b < 0) throw new Error("The page has no generated reference markers");
  return `${page.slice(0, a + MARK_START.length)}\n\n${reference()}\n${page.slice(b)}`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const path = new URL("../docs/PACK_FORMAT.md", import.meta.url);
  writeFileSync(path, withReference(readFileSync(path, "utf8")));
  console.log("docs/PACK_FORMAT.md updated");
}
