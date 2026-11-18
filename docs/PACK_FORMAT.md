# Writing a content pack

This page describes everything a Heroquill **pack file** can hold and how each part is read by the
app. It is written for two readers: a person who writes a pack by hand, and a program or an AI that
turns a document (a homebrew book, a PDF, a wiki) into a pack. Every field that exists is listed in
the [reference](#reference) at the end, which is generated from the code and checked by a test, so
it cannot go out of date.

**For an AI:** a plain Markdown copy of this page, without menus or HTML, is easier to read as
input: [PACK_FORMAT.md](PACK_FORMAT.md). It is the same text.

If you only want to make a pack, the **Homebrew studio** in the app writes this format for you; you
never have to touch a file. Read on when you want to know what is behind the forms, to write a pack
in bulk, or to convert a book.

**Contents**

- [The idea in one minute](#the-idea-in-one-minute)
- [The file](#the-file)
- [Entries](#entries)
- [Texts and translations](#texts-and-translations)
- [Numbers, units and words](#numbers-units-and-words)
- [Effects](#effects)
- [Requirements and terms](#requirements-and-terms)
- [How to model each kind](#how-to-model-each-kind)
- [Class tables and spellcasting](#class-tables-and-spellcasting)
- [Resources, points and reserves](#resources-points-and-reserves)
- [Monsters](#monsters-1)
- [Checking a pack](#checking-a-pack)
- [Converting a book](#converting-a-book)
- [Limits](#limits)
- [Reference](#reference)

## The idea in one minute

A pack is a book. It holds **entries** (a spell, a class, a species...). An entry is two things kept
apart on purpose:

- **Data and effects**, which are structured and read by the rules engine: what a spell's level is,
  that a trait gives darkvision 60, that a class has a d8 hit die. They never contain display text.
- **Texts**, which people read: the name, the description, a spell's casting time. They live in a
  separate table of strings, keyed by the entry's id, so a pack can carry the same texts in several
  languages.

An entry refers to other entries by **id** (`mypack:trait/keen-nose`). Nothing is stored twice: a
species does not contain its traits, it lists their ids.

What the engine can compute is expressed with **effects** (a closed set of about thirty types: a
bonus to a score, a proficiency, a resistance, uses of a feature, a spell...). Whatever the engine
cannot compute stays in the text of the entry, and the player reads it there. A pack that is
mostly text is a perfectly good pack; effects are what make the sheet do the arithmetic.

```
pack file
├── id, name, lang, meta              who and what
├── pack
│   ├── manifest                      the pack id, the ruleset, the license
│   └── entries[]                     id, kind, parent?, effects[], data{}
├── strings                           "<entry id>.<field>" → text, in the language of the pack
└── translations                      the same keys by language, optional
```

## The file

A pack file has the extension `.dndpack.json` and is JSON. The same shape is what the app keeps in
the browser. The top level:

| Field | Required | Meaning |
| --- | --- | --- |
| `format` | in a file | The string `"heroquill-pack"`. Old files say `"dnd-character-maker-pack"` and are still read. |
| `formatVersion` | in a file | The version of the format, now `3`. Older versions are migrated when read; a newer one than the app knows is refused. |
| `id` | yes | The id of the pack: lower case letters and digits only (`mybook`). It prefixes every entry id. `srd51` and `srd52` are taken by the rules. |
| `name` | yes | The name shown in the list of packs. |
| `lang` | yes | The language the texts of `strings` are written in (`en`, `it`, `fr`, `de`, `es`). |
| `pack` | yes | The content: `manifest` and `entries`. |
| `strings` | yes | The texts of the pack, in `lang` (it may be empty). |
| `translations` | no | The same texts by language: `{ "it": { "<key>": "..." } }`. |
| `meta` | no | The details of the pack as a book, and what the pack declares (see below). |
| `provenance` | no | Where an entry was copied from. Written by the app; leave it out. |

The `manifest`:

```json
{
  "id": "mybook",
  "ruleset": "custom",
  "version": "1",
  "license": "Homebrew content written by its author",
  "attribution": "Written by Jane Doe"
}
```

`manifest.id` must be the same as the top-level `id`. `ruleset` is `"custom"` for a pack of a
person (the other two values belong to the rules shipped with the app). `license` and
`attribution` are free text shown in the list of packs.

### `meta`

Everything is optional.

| Field | Meaning |
| --- | --- |
| `author`, `description` | Shown on the page of the pack. |
| `cover` | A small picture as a `data:` address (at most 300,000 characters). |
| `units` | `"metric"` or `"imperial"`: the units the editor types distances and weights in. Absent: metric for every language but English. The data is **always** stored in feet and pounds; this only changes how numbers are typed and shown while editing. |


### Ids and slugs

An entry id is `pack:kind/slug`:

- the **pack** is the `id` of the pack;
- the **kind** is one of the [kinds of entry](#kinds-of-entry);
- the **slug** is lower case letters and digits, with single dashes between words (`fire-bolt`,
  `high-elf`). No accents, no apostrophes, no spaces.

The whole id must match `^[a-z0-9]+:[a-z]+/[a-z0-9]+(-+[a-z0-9]+)*$`. A slug is normally made from
the name: lower case, accents removed, every other character turned into a dash, dashes trimmed
(`Mage's Armor` → `mages-armor`). When two entries of the same kind would get the same slug, add
`-2`, `-3`. Ids must be unique inside a pack, and the kind in the id must be the entry's `kind`.

Ids of the shipped rules are written the same way and can be used as references from a pack:
`srd51:spell/fireball`, `srd51:class/wizard`, `srd52:species/elf`. Use the `srd51` ones for the 2014
rules and the `srd52` ones for the 2024 rules, and see [editions](#editions).

### A first complete pack

A pack with one spell. Everything in it is required for the spell to work:

```json example
{
  "format": "heroquill-pack",
  "formatVersion": 3,
  "id": "firstpack",
  "name": "My first pack",
  "lang": "en",
  "pack": {
    "manifest": {
      "id": "firstpack",
      "ruleset": "custom",
      "version": "1",
      "license": "Homebrew content written by its author",
      "attribution": "Written by me"
    },
    "entries": [
      {
        "id": "firstpack:spell/spark",
        "kind": "spell",
        "effects": [],
        "data": {
          "level": 0,
          "school": "evocation",
          "components": ["V", "S"],
          "ritual": false,
          "concentration": false,
          "classes": ["srd51:class/wizard"],
          "attackType": "ranged",
          "damage": [
            {
              "damageType": { "index": "lightning" },
              "damageAtCharacterLevel": { "1": "1d8", "5": "2d8", "11": "3d8", "17": "4d8" }
            }
          ]
        }
      }
    ]
  },
  "strings": {
    "firstpack:spell/spark.name": "Spark",
    "firstpack:spell/spark.castingTime": "1 action",
    "firstpack:spell/spark.range": "60 feet",
    "firstpack:spell/spark.duration": "Instantaneous",
    "firstpack:spell/spark.desc": "You hurl a bright spark at a creature you can see within range. Make a ranged spell attack. On a hit, the target takes 1d8 lightning damage.\n\nThe damage increases when you reach higher levels."
  }
}
```

Open the Homebrew studio, choose *Add a pack file*, and the Spark cantrip is on the Wizard's list.

### A larger example

A pack with a species and its trait, a class that casts with points from a reserve, a feature that
adds points to the reserve from the class table, a spell that costs points, and a monster. It is
short (three levels instead of twenty), but every kind of link is there:

```json example
{
  "format": "heroquill-pack",
  "formatVersion": 3,
  "id": "mindbook",
  "name": "Mind Book",
  "lang": "en",
  "meta": {
    "author": "Jane Doe",
    "units": "imperial"
  },
  "pack": {
    "manifest": {
      "id": "mindbook",
      "ruleset": "custom",
      "version": "1",
      "license": "Homebrew content written by its author",
      "attribution": "Written by Jane Doe"
    },
    "entries": [
      {
        "id": "mindbook:school/telepathy",
        "kind": "school",
        "effects": [],
        "data": {}
      },
      {
        "id": "mindbook:reserve/focus-points",
        "kind": "reserve",
        "effects": [],
        "data": { "recharge": "long" }
      },
      {
        "id": "mindbook:component/a",
        "kind": "component",
        "effects": [],
        "data": { "code": "A" }
      },
      {
        "id": "mindbook:trait/inner-calm",
        "kind": "trait",
        "effects": [{ "type": "defense", "kind": "resistance", "damage": "psychic" }],
        "data": {}
      },
      {
        "id": "mindbook:species/dreamer",
        "kind": "species",
        "effects": [
          { "type": "abilityBonus", "ability": "wis", "value": 2 },
          { "type": "proficiency", "category": "language", "target": "common" },
          { "type": "trait", "id": "mindbook:trait/inner-calm" },
          { "type": "uses", "term": 2, "recharge": "long", "pool": true, "reserve": "focus-points" }
        ],
        "data": { "speed": 30, "size": "medium" }
      },
      {
        "id": "mindbook:feature/focus",
        "kind": "feature",
        "effects": [
          {
            "type": "uses",
            "term": { "table": "Focus points" },
            "recharge": "long",
            "pool": true,
            "reserve": "focus-points"
          }
        ],
        "data": { "class": "mindbook:class/mystic", "level": 1 }
      },
      {
        "id": "mindbook:class/mystic",
        "kind": "class",
        "effects": [
          { "type": "proficiency", "category": "save", "target": "int" },
          { "type": "proficiency", "category": "save", "target": "wis" },
          {
            "type": "choice",
            "id": "mystic-skills",
            "choose": 2,
            "grants": "proficiency",
            "from": ["skill:arcana", "skill:insight", "skill:nature"]
          }
        ],
        "data": {
          "hitDie": 6,
          "primaryAbility": ["int"],
          "multiclassing": {
            "prerequisites": [{ "ability": "int", "minimum": 13 }],
            "proficiencies": []
          },
          "spellcasting": {
            "ability": "int",
            "startsAtLevel": 1,
            "preparation": { "type": "known" },
            "slots": "none",
            "reserve": "focus-points",
            "maxLevel": "half",
            "limit": "Focus limit"
          },
          "levels": [
            {
              "level": 1,
              "features": ["mindbook:feature/focus"],
              "abilityScoreImprovements": 0,
              "cantripsKnown": 2,
              "spellsKnown": 2,
              "classSpecific": { "Focus points": 4, "Focus limit": 2 }
            },
            {
              "level": 2,
              "features": [],
              "abilityScoreImprovements": 0,
              "cantripsKnown": 2,
              "spellsKnown": 3,
              "classSpecific": { "Focus points": 6, "Focus limit": 2 }
            },
            {
              "level": 3,
              "features": [],
              "abilityScoreImprovements": 0,
              "cantripsKnown": 2,
              "spellsKnown": 4,
              "classSpecific": { "Focus points": 14, "Focus limit": 4 }
            }
          ],
          "startingEquipment": [],
          "startingChoices": []
        }
      },
      {
        "id": "mindbook:spell/mind-lash",
        "kind": "spell",
        "effects": [],
        "data": {
          "level": 1,
          "school": "telepathy",
          "components": ["A"],
          "ritual": false,
          "concentration": false,
          "classes": ["mindbook:class/mystic"],
          "pointCost": 2,
          "dc": { "dcType": { "index": "wis" }, "dcSuccess": "half" },
          "damage": [
            { "damageType": { "index": "psychic" }, "damageAtSlotLevel": { "1": "2d6", "2": "3d6" } }
          ]
        }
      },
      {
        "id": "mindbook:monster/dream-wisp",
        "kind": "monster",
        "effects": [],
        "data": {
          "size": "tiny",
          "type": "aberration",
          "armorClass": [{ "value": 13 }],
          "hitPoints": 9,
          "hitPointsRoll": "2d4+4",
          "speed": { "walk": 0, "fly": 30 },
          "abilities": { "str": 3, "dex": 16, "con": 14, "int": 10, "wis": 12, "cha": 14 },
          "challenge": 0.5,
          "xp": 100,
          "special": [{}],
          "actions": [{ "attackBonus": 5, "damage": [{ "type": "psychic", "dice": "1d6+3" }] }]
        }
      }
    ]
  },
  "strings": {
    "mindbook:reserve/focus-points.name": "Focus points",
    "mindbook:component/a.name": "Aura",
    "mindbook:school/telepathy.name": "Telepathy",
    "mindbook:school/telepathy.desc": "Powers that link one mind to another.",
    "mindbook:trait/inner-calm.name": "Inner Calm",
    "mindbook:trait/inner-calm.desc": "You have resistance to psychic damage.",
    "mindbook:species/dreamer.name": "Dreamer",
    "mindbook:species/dreamer.desc": "Folk who sleep lightly and wake knowing things.",
    "mindbook:feature/focus.name": "Focus",
    "mindbook:feature/focus.desc": "You hold a reserve of focus points, shown in the Focus points column of the Mystic table. They come back when you finish a long rest.",
    "mindbook:class/mystic.name": "Mystic",
    "mindbook:class/mystic.desc": "A mystic shapes thought into power.",
    "mindbook:spell/mind-lash.name": "Mind Lash",
    "mindbook:spell/mind-lash.castingTime": "1 action",
    "mindbook:spell/mind-lash.range": "60 feet",
    "mindbook:spell/mind-lash.duration": "Instantaneous",
    "mindbook:spell/mind-lash.desc": "A creature you can see within range must make a Wisdom saving throw, taking 2d6 psychic damage on a failed save, or half as much on a success.",
    "mindbook:monster/dream-wisp.name": "Dream Wisp",
    "mindbook:monster/dream-wisp.alignment": "unaligned",
    "mindbook:monster/dream-wisp.special.1.name": "Flicker",
    "mindbook:monster/dream-wisp.special.1.desc": "The wisp has advantage on saving throws against being grappled.",
    "mindbook:monster/dream-wisp.actions.1.name": "Nudge",
    "mindbook:monster/dream-wisp.actions.1.desc": "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) psychic damage."
  }
}
```

The Dreamer gives 2 focus points and the Mystic's Focus feature gives the number in its table;
they add up in one counter called "Focus points". At 3rd level the Mystic knows spells up to 2nd
level (half of 3, rounded up), can spend at most 4 points on one spell, and Mind Lash costs 2.

## Entries

An entry is an object with four fields:

| Field | Meaning |
| --- | --- |
| `id` | `pack:kind/slug`, see above. |
| `kind` | What it is: one of the [kinds](#kinds-of-entry). |
| `parent` | Optional. The entry this one belongs to: the class of a subclass, the species of a subspecies. |
| `effects` | What the entry does to a character that holds it: a list of [effects](#effects). May be `[]`. |
| `data` | Kind-specific facts: a spell's level, a species' speed, an item's cost. Listed per kind in the [reference](#the-data-of-each-kind). May be `{}` for a kind that has none. |

A character **holds** an entry when it is part of their build: their species, their class, a trait
that came with it, a feat they took, an item they equipped. The effects of what is held apply; the
effects of what is merely in a pack do not.

### Owned entries

Some kinds exist only as part of another entry. They are ordinary entries with their own id, but a
person never picks them from a list: the owner gives them.

| Owner | Owns | How it is linked |
| --- | --- | --- |
| `species`, `subspecies` | `trait` | The owner has an effect `{ "type": "trait", "id": "pack:trait/..." }` for each. |
| `class`, `subclass` | `feature` (and `trait`) | The class lists the feature ids in `data.levels[].features` at the level they arrive, and the feature has `data.class`, `data.level` and, for a subclass, `data.subclass`. |
| `feature`, `option` | `trait` | The same `trait` effect. |

A subclass is linked to its class with `parent`. A subspecies is linked to its species with
`parent`. The class a subclass belongs to may be a class of the shipped rules
(`srd51:class/fighter`), so a pack can add a subclass to an existing class.

The level at which a class asks the player to choose a subclass is the **lowest `level` that any of
its subclasses has a row for** in `data.levels`.

### Editions

The shipped rules come in two editions: the 2014 rules (`srd51`) and the 2024 rules (`srd52`). A
character follows one of them. A pack is not tied to an edition and works with both; it refers to
the rules by id, and a reference to a 2014 spell is carried over to the 2024 spell of the same name
when the character follows the 2024 rules and one exists.

### Kinds of entry

The kinds are listed with their role in the [reference](#kinds-of-entry-1). In short:

| Kind | Use it for |
| --- | --- |
| `species`, `subspecies` | Races, lineages, variants. A subspecies with `data.replacesSpecies: true` stands in for its species. |
| `class`, `subclass` | Classes with their 20 levels, archetypes and the like. |
| `feature`, `trait` | The named abilities a class, a species or a feat gives. |
| `background` | Backgrounds, with their personality tables. |
| `feat` | Feats, boons, and anything a character may be offered by choice. |
| `option` | A rule a character can switch on (an optional class feature, a variant rule). |
| `spell` | Spells, cantrips and powers cast like spells. |
| `item`, `property` | Weapons, armor, gear, tools, magic items, vehicles; and the weapon properties they refer to. |
| `monster` | Stat blocks: creatures, companions, summons. |
| `language`, `deity`, `condition` | Languages, deities (picked in the Story step), conditions a character can have. |
| `reserve`, `damage`, `component` | The small vocabulary a pack adds: a reserve of points (`data.recharge`: `long` or `short`), a kind of damage, a spell component (`data.code`, one to three characters). The data names them by the end of the id (`mypack:damage/sonic` is `sonic`) or, for a component, by its code. |
| `ability`, `skill`, `proficiency`, `school`, `alignment` | Words of the rules. A pack rarely needs to add one, but a system with new schools of magic or new skills can. |

## Texts and translations

All the words people read are in `strings`: a flat object from **key** to **text**. A key is the
entry id, a dot and a field: `mybook:spell/spark.name`.

Every entry should have `name` and, when it has something to say, `desc`. An entry without a name
is shown with its slug made readable (`fire-bolt` → "Fire bolt"), which works but looks careless.

A text is **plain text**. A blank line (`\n\n`) starts a new paragraph. There is no Markdown: `*`,
`#` and `-` are shown as written (a line starting with `- ` reads fine as a list).

### Which fields each kind uses

| Kind | Text fields |
| --- | --- |
| most kinds | `name`, `desc` |
| `spell` | `name`, `desc`, `castingTime` (`1 action`), `range` (`60 feet`), `duration` (`Concentration, up to 1 minute`), `material` (the text in brackets of the M component), `higherLevel` (the "at higher levels" paragraph) |
| `background` | `name`, `desc`, `featureName`, `featureDesc` (the background feature), and the tables below |
| `language` | `name`, `desc`, `speakers`, `script` |
| `monster` | `name`, `desc`, `alignment`, `vulnerabilities`, `resistances`, `immunities`, `languages` and the numbered texts of the stat block, see [Monsters](#monsters) |

The personality tables of a background are numbered lines: `bg.personalityTraits.1`,
`bg.personalityTraits.2`... and the same for `ideals`, `bonds` and `flaws` (`bg` stands for the
entry id). Number from 1 without gaps; a line that is missing ends the table.

### Names of reserves, kinds of damage and components

A reserve of points, a kind of damage and a spell component are entries of their own kinds (`reserve`, `damage`, `component`), so their names are the `name` text of the entry like any other.

### Translations

`translations` repeats keys by language: `{ "it": { "mybook:spell/spark.name": "Scintilla" } }`.
A text is shown in the language of the app when the pack has it, otherwise in the language the pack
was written in (`lang`); nothing is ever missing. A pack in one language is complete without
`translations`.

## Numbers, units and words

- **Distances and weights are stored in feet and pounds**, in `data` and in effects. The app shows
  them in the units of the person.
- **In a text**, write English distances and weights in the usual way (`60 feet`, `a 20-foot
  radius`, `5 miles`, `10 pounds`, `lb.`). The app rewrites them in meters, kilometres and
  kilograms for people who use metric units, in every English text. A text in another language is
  never rewritten: write it in the units of that language.
- **Dice** are strings: `1d8`, `2d6+3`, `1d8 + MOD` where a field allows it.
- **Costs** are `{ "amount": 15, "unit": "gp" }` with `unit` `cp`, `sp` or `gp`.
- **Abilities** are `str`, `dex`, `con`, `int`, `wis`, `cha`.
- **Creature sizes** are `tiny`, `small`, `medium`, `large`, `huge`, `gargantuan`.
- **Words of the rules** (a skill, a school, a condition, a language) are written as the **slug** of
  the entry of that kind, without the pack: `arcana`, `evocation`, `poisoned`, `common`. A word the
  pack adds is written the same way (`psychokinesis`) and needs an entry of its own (kind `school`,
  and so on) to have a name.
- **Damage types** are the thirteen of the rules (`acid`, `bludgeoning`, `cold`, `fire`, `force`,
  `lightning`, `necrotic`, `piercing`, `poison`, `psychic`, `radiant`, `slashing`, `thunder`) and the
  ones the pack adds as entries of kind `damage` (the end of the id, `mindbook:damage/sonic` -> `sonic`, is the word the data uses).

## Effects

An effect is an object with a `type` and the fields of that type. `effects` on an entry is a list of
them, applied together. There are about thirty types, every one listed with its fields in the
[reference](#effects-1). Some rules of thumb:

- **Effects add up, unless they are of a kind that does not stack.** Two `abilityBonus` effects on
  Strength add; two senses of darkvision do not (the longest counts); two `extraAttack` effects do
  not (the most counts). The reference says which for each type.
- **Many effects have a `minLevel`.** For a class feature it is the class level; for the effects of
  a species it is the level of the whole character. Without it the effect applies at once.
- **`when` makes a group of effects conditional.** `{ "type": "when", "requires": "...", "effects":
  [ ... ] }` holds them only while the requirement is true, checked each time the sheet is worked
  out. See [requirements](#requirements-and-terms).
- **`choice` makes the player decide.** The sheet shows an open choice until it is made, and
  warns if the player picks too many or an option they are not allowed.
- **A trait is how an entry gives named abilities.** To give "Keen Smell" to a species, make a
  `trait` entry with the text and the effects, and give it with `{ "type": "trait", "id": ... }`.
  Do not put the effects of a trait on the species: the sheet lists traits by name and the player
  can read what each one does.
- **What is not an effect is text.** If the engine has no effect for a rule (an exception to
  another rule, a story consequence, a roll the player makes by hand), write it in the `desc`. The
  app never hides a text because its effects are missing.

A few worked examples:

```json
{ "type": "abilityBonus", "ability": "wis", "value": 2 }
{ "type": "proficiency", "category": "skill", "target": "stealth" }
{ "type": "proficiency", "category": "weapon", "target": "daggers" }
{ "type": "defense", "kind": "resistance", "damage": "psychic" }
{ "type": "sense", "sense": "darkvision", "range": 60 }
{ "type": "movement", "mode": "fly", "feet": 30 }
{ "type": "modifier", "target": "ac", "value": 1, "when": "wearingArmor" }
{ "type": "trait", "id": "mybook:trait/keen-smell" }
{ "type": "grantSpell", "spell": "srd51:spell/misty-step", "free": true, "rest": "long" }
{ "type": "choice", "id": "extra-language", "choose": 1, "grants": "language", "from": [] }
{ "type": "uses", "term": { "mod": "cha" }, "recharge": "long", "min": 1 }
{ "type": "when", "requires": "!elf", "effects": [ { "type": "movement", "mode": "swim", "feet": 30 } ] }
```

A `choice` with an empty `from` for `language` is not "any language": give the options, or write
that the player picks a language in the text.

## Requirements and terms

Two small languages appear in several places.

### Requirements

A requirement is a string, used by `when.requires` and by the prerequisites of options and feats
that come from other tools. It is a **sentence of names**:

- a **name** is held when it is the id of an entry the character has (its species, its subspecies,
  its class, a feat, a trait that came with something), or a flag set by a `flag` effect;
- `,` means *and*, `||` means *or*, `!` means *not*, and brackets group: `!(wizard||sorcerer)`;
- a sheet condition written `[str:13]` is understood but is not true yet; it is accepted so that
  text from other tools keeps its meaning.

Names are written as the id without the pack and kind or as a flag id; the editor's requirement
builder writes them for you. `flag` effects let a rule say "this is held" without an entry:
a species can keep an increase that a subspecies takes away with `when "!LINE"` on the species and
`flag "LINE"` on the subspecies.

### Terms

A **term** is how a number of a feature is written when it depends on the character. It is used by
`uses`, `featureValue` and the value of some other effects:

| Term | Value |
| --- | --- |
| `3` | The number. |
| `{ "of": "proficiency" }` | The proficiency bonus. |
| `{ "of": "level" }` | The character level. |
| `{ "mod": "cha" }` | The modifier of an ability. |
| `{ "score": "cha" }` | The score of an ability. |
| `{ "classLevel": "wizard" }` | The levels in one class, by its slug (0 when the character has none). |
| `{ "table": "Ki points" }` | A column of the class table of the class that gives the feature, at the level the character has in it. See [class tables](#class-tables-and-spellcasting). |
| `{ "text": "Acid" }` | A text, for `featureValue` only: shown as written. |

## How to model each kind

### Species and subspecies

A `species` has `data.speed` (feet) and `data.size` (omit it if the species lets the player pick a
size, with a `choice` granting `size` and one `size` effect per option). Its effects hold what every
member gets: ability increases (`abilityBonus`), languages (`proficiency` in `language`), and one
`trait` effect per racial trait. Each trait is a `trait` entry with its own text and effects.

A `subspecies` has `parent` set to the species and gives what the lineage adds. If the lineage
replaces the species' own traits (a variant that is a whole race of its own), set
`data.replacesSpecies: true`: the species' effects are then not applied and the variant lists
everything it gives.

### Classes

A `class` has:

- `data.hitDie` (6, 8, 10, 12), `data.primaryAbility`, `data.multiclassing` (ability minimums and the
  proficiencies gained when multiclassing);
- `data.levels`: the table of its 20 levels, see [class tables](#class-tables-and-spellcasting);
- `data.spellcasting` when it casts;
- `data.startingEquipment` and `data.startingChoices` (what a new character starts with, and the
  "(a) or (b)" choices);
- `effects` for what the class gives at level 1 that is not a feature: saving throw proficiencies,
  armor and weapon proficiencies, and a `choice` for the skills.

```json
[
  { "type": "proficiency", "category": "save", "target": "int" },
  { "type": "proficiency", "category": "save", "target": "wis" },
  { "type": "proficiency", "category": "weapon", "target": "daggers" },
  { "type": "choice", "id": "skills", "choose": 2, "grants": "proficiency",
    "from": ["skill:arcana", "skill:history", "skill:insight", "skill:nature"] }
]
```

The features a class gives are `feature` entries, each with `data.class`, `data.level` and a text,
listed in `data.levels[].features` at their level. Give a feature `data.activation` (`action`,
`bonus`, `reaction`...) when it is used, so that Play shows it as something to do.

A `subclass` has `parent` set to its class, a `data.levels` with a row for each level it gives
something (`{ "level": 3, "features": [...] }`), and its features have `data.subclass`. Class
features of the subclass count only once the character has reached their level.

### Backgrounds

A `background` has `desc`, the background feature (`featureName` and `featureDesc`), the tables of
personality traits, ideals, bonds and flaws, and effects for the skill and tool proficiencies,
languages and starting equipment (`data.startingEquipment`, `data.startingChoices`).

### Feats

A `feat` is a text with effects. `data.category` (a free word such as `general`) groups it, and
`data.prerequisites` is a list of requirements: `{ "type": "level", "level": 4 }`,
`{ "type": "feature", "feature": "..." }`, `{ "type": "spell", "spell": "..." }` or
`{ "ability": "str", "minimum": 13 }`. The picker shows the prerequisites and does not let a
player take a feat whose requirement is not met.

### Spells

`data.level` is 0 for a cantrip. `data.school` is the slug of a `school` entry. `data.components` is
a list of `V`, `S`, `M` and the `code` of any `component` entry. `data.classes` lists the
classes whose spell list the spell is on (ids of `class` entries; the Wizard is
`srd51:class/wizard`). A spell with an empty `classes` is on no list and cannot be picked by a
class, though it can still be granted.

A spell may have `effects` (a `modifier` of the armor class or the speed, an `unarmoredDefense`, a `defense`...): in Play a button on the spell, "In effect", turns them on as if the character held them, until a long rest, until it is turned off, or until the concentration on that spell ends. Mage Armor, Shield of Faith, Shield and Longstrider of the SRD have them.

The numbers Play can roll come from `data.damage` (a list; each has `damageType.index` and either
`damageAtSlotLevel`, a record from slot level to dice, or `damageAtCharacterLevel` for cantrips),
`data.dc` (a saving throw: `dcType.index` is the ability and `dcSuccess` is `none` or `half`),
`data.attackType` (`melee` or `ranged`), `data.healAtSlotLevel` and `data.areaOfEffect`. They are
optional: a spell with no numbers is simply read.

`data.pointCost` is the number of points the spell takes from the reserve of a class that casts
[without slots](#class-tables-and-spellcasting). Without it, a spell costs as many points as its
level.

### Items

`data.category` says what an item is: `weapon`, `armor`, `adventuring-gear`, `tools`,
`mounts-and-vehicles` or `magic-items`. Every item has `data.cost` and may have `data.weight`.

- A **weapon** has `data.weapon`: `category` (`simple` or `martial`), `kind` (`melee` or `ranged`),
  `damage` (`dice` and `type`), `twoHandedDamage` for a versatile weapon, `properties` (ids of
  `property` entries: `srd51:property/finesse`), `range` (`normal` and `long`, in feet; melee reach is
  5), `throwRange`, `mastery` (the id of a `property` with `data.mastery: true`, a weapon mastery of the
  2024 rules: `srd52:property/mastery-vex`) and `proficiency` (`["weapon:simple-weapons"]`: any one of them
  makes the wielder proficient). `data.magical: true` makes a weapon count as magic without a rarity.
- An **armor** has `data.armor`: `category` (`light`, `medium`, `heavy`, `shield`), `base` (the armor
  class), `dexBonus`, `maxDexBonus`, `strengthMinimum`, `stealthDisadvantage`, `proficiency`.
- A **magic item** has `data.rarity` (`common`, `uncommon`, `rare`, `very-rare`, `legendary`,
  `artifact`), `data.attunement` (at most three items can be attuned), `data.slot` (`body`, `neck`,
  `shield`, `waist`, `oneHand`, `feet`, `arms`, `shoulders`...) and, for a weapon or armor,
  `data.enhancement` (+1 to +3). Its **effects apply while the item is equipped**: a ring that gives
  +1 armor class and a resistance is a `modifier` and a `defense` on the item.
- **Gear** has `data.gear` (`category`, `contents` for a pack, `bundleSize` for ammunition).
- `data.enchants: true` makes an item an enchantment put on a weapon of the inventory instead of
  something carried (its `cost` is 0; it gives a `rarity`, an `enhancement` and effects); `data.copyOf` records the item a customized copy was made from.

A `property` is a weapon property (`finesse`, `reach`): a name and a text, no effect. A weapon's
`properties` lists their ids; the properties of the rules already exist as `srd51:property/...`.

### Monsters

See [Monsters](#monsters-1) below.

### Languages, deities, conditions, options

- A `language` has `data.type` (`standard` or `exotic`) and texts for its `speakers` and `script`.
- A `deity` has `data.alignment` and `data.domains`; it is picked in the Story step.
- A `condition` has an optional `data.color`: the glow at the edges of the Play screen while the
  condition lasts, a colour name (`red`, `green`...) or `#rrggbb`.
- An `option` is a rule a player can switch on. Its effects apply while it is on. `data.replaces`
  lists the entries it takes the place of (they are hidden from the sheet), and
  `data.backgroundFeature: true` makes it stand in for the feature of the background.

## Class tables and spellcasting

`data.levels` of a class is a list of rows, normally 20, one per level:

```json
{
  "level": 5,
  "features": ["mybook:feature/extra-attack"],
  "abilityScoreImprovements": 1,
  "cantripsKnown": 3,
  "spellsKnown": 6,
  "spellSlots": [4, 2, 0, 0, 0, 0, 0, 0, 0],
  "classSpecific": { "Ki points": 5, "Martial arts die": 6 }
}
```

| Field | Meaning |
| --- | --- |
| `level` | 1 to 20. |
| `features` | Ids of the features gained at this level. Only the new ones: the list is not cumulative. |
| `abilityScoreImprovements` | The **cumulative** number of improvements available at this level (0 until the level of the first one, then 1, 2...). |
| `cantripsKnown`, `spellsKnown` | The cantrips and the spells known (or prepared, see below) at this level. |
| `spellSlots` | Slots for spell levels 1 to 9: nine numbers. |
| `classSpecific` | **Columns of values** that grow with the level: ki points, rages, a damage die. A free record from the name of the column to a number. |

### Columns of values

`classSpecific` is the table of numbers a class prints beside its features. Each key is a column
name written however you like (`"Ki points"`, `"rageCount"`); give every row the same keys. Three
things read a column:

- the term `{ "table": "Ki points" }` (in `uses` and `featureValue`) takes its value at the class level
  of the character, for a feature **of that class**;
- `choice.chooseBy` takes the number of picks from a column (invocations, metamagic);
- a class that casts without slots can take its spell level cap and its per-spell limit from a
  column (`spellcasting.maxLevel`, `spellcasting.limit`).

A column that nothing reads is still stored and shown by the editor, so a table can be written
for the reader's sake.

### Spellcasting

`data.spellcasting` of a class says how it casts:

```json
{
  "ability": "int",
  "startsAtLevel": 1,
  "preparation": { "type": "prepared", "levelDivisor": 1 }
}
```

- `ability` is the spellcasting ability.
- `startsAtLevel` is 1 for a full caster, 2 for a half caster (and 3 for a third caster).
- `pact: true` is Pact Magic: slots are all of one level and come back on a short rest.
- `preparation.type` is how spells are chosen: `known` (a fixed list, the spells known), `prepared`
  (chosen each day from the whole class list; the number is the ability modifier plus the class
  level divided by `levelDivisor`, or `spellsKnown` of the row with `fromTable: true`) or `spellbook`
  (a spellbook of `initial` spells plus `perLevel` per level, from which the prepared ones are
  chosen).
- The slots come from `spellSlots` of each row. The tables of the rules: a full caster follows the
  multiclass table, a half caster gets slots from level 2 at half the rate, Pact Magic has
  1 to 4 slots of one level. The Homebrew studio fills them for you when you choose the type of casting.
- Several casting classes share their slots; a character with one class of each uses the
  multiclass table.

A **subclass** can give a class that does not cast spellcasting of its own (an Eldritch Knight): its
`data.spellcasting` has `ability`, `list` (the id of the class whose spell list it picks from),
optionally `schools` (the schools of most of the spells known), `startsAtLevel` (3) and `kind`
(`full`, `half`, `third`, `pact`), and its rows carry `cantripsKnown`, `spellsKnown` and `spellSlots`.
A subclass can also list `spells` (spells always prepared: `{ "spell": id, "classLevel": 3 }`) and
`expanded` (spells added to the class list: a warlock patron's).

### Casting without slots

A class that casts with **points** instead of slots (psionics, mana, the Spell Points variant) sets
`"slots": "none"` in its `spellcasting` and says what it pays with:

```json
{
  "ability": "int",
  "startsAtLevel": 1,
  "preparation": { "type": "known" },
  "slots": "none",
  "reserve": "psi-points",
  "maxLevel": "half",
  "limit": "Psi limit"
}
```

- `slots: "none"`: the class has no spell slots, so its rows have no `spellSlots`. It is still a
  caster: `cantripsKnown` and `spellsKnown` apply and it has a save DC and an attack bonus.
- `reserve` is the slug of a reserve of the pack (see [reserves](#resources-points-and-reserves)).
  Casting a spell takes its `pointCost` (or its level) from that reserve in Play.
- `maxLevel` is the highest spell level the class can know at a level: `"half"` (half the class level,
  rounded up) or `{ "column": "Spell level" }`, a column of the table. Absent, there is no cap.
- `limit` is a column of the table: the most points one spell can take at that level.

Which spells a class can pick comes from the spells themselves: a spell is on the class list when
its `data.classes` contains the class id.

## Resources, points and reserves

Limited resources are ticked off in Play and come back on a rest. There are three ways to write
them.

### Uses of a feature

`uses` on a feature says how often it can be used:

```json
{ "type": "uses", "term": { "table": "Rages" }, "recharge": "long" }
```

`term` is the number, `recharge` is `short` or `long`. A feature with `pool: true` is counted in
points (a counter) instead of marks. The terms of one entry add up, except that those with a
`minLevel` replace one another (the last one reached counts). A feature whose total is 0 gives
nothing.

### Spending from a pool

`spends` on a feature takes points from a pool each time it is used and gives the feature a "Use"
button in Play: `{ "type": "spends", "pool": "ki", "cost": 2 }`. `pool` names the pool of a class
(`ki`, `focus`, `channelDivinity`, `bardicInspiration`, `sorceryPoints`, `wildShape`).

### Reserves

A **reserve** is a pool the pack names itself and **every source can add to**. It is an entry of kind `reserve`; its `data.recharge` (`long` or `short`) says when the points come back, and its name is its `name` text:

```json
{ "id": "mypack:reserve/psi-points", "kind": "reserve", "effects": [], "data": { "recharge": "long" } }
```

Then any `uses` effect with `reserve` adds points to it, and any `spends` effect with `reserve` takes
points from it:

```json
{ "type": "uses", "term": { "table": "Psi points" }, "recharge": "long", "pool": true, "reserve": "psi-points" }
{ "type": "uses", "term": 2, "recharge": "long", "pool": true, "reserve": "psi-points" }
{ "type": "spends", "reserve": "psi-points", "cost": 3 }
```

The first line is a class giving points from its table, the second a species giving 2 more, the
third a feature that costs 3. The sheet shows **one** counter, the sum of what every source gives,
that comes back on the rest of the last effect read (use the same `recharge` everywhere). A class
that casts [without slots](#casting-without-slots) pays for its spells from a reserve, so a
psionic class, a species and a feat all feed one pool.

### Numbers a feature shows

`featureValue` shows a number on the sheet next to a feature: a save DC, a range, a die. It uses
the same terms. Use it for what the player needs to read at the table, not for what is only text.

## Monsters

A `monster` is a stat block. Its `data` holds the numbers and its `strings` hold the words.

```json
{
  "id": "mybook:monster/glass-hound",
  "kind": "monster",
  "effects": [],
  "data": {
    "size": "medium",
    "type": "construct",
    "armorClass": [{ "value": 14, "type": "natural" }],
    "hitPoints": 39,
    "hitPointsRoll": "6d8+12",
    "speed": { "walk": 40 },
    "abilities": { "str": 14, "dex": 14, "con": 14, "int": 3, "wis": 12, "cha": 5 },
    "senses": { "darkvision": 60 },
    "passivePerception": 11,
    "challenge": 2,
    "xp": 450,
    "proficiencyBonus": 2,
    "special": [{}],
    "actions": [
      { "multiattack": [{ "action": 2, "count": 2 }] },
      { "attackBonus": 4, "damage": [{ "type": "piercing", "dice": "1d8+2" }] }
    ]
  }
}
```

and the words:

```json
{
  "mybook:monster/glass-hound.name": "Glass Hound",
  "mybook:monster/glass-hound.alignment": "unaligned",
  "mybook:monster/glass-hound.languages": "understands Common but cannot speak",
  "mybook:monster/glass-hound.special.1.name": "Shatter Sense",
  "mybook:monster/glass-hound.special.1.desc": "The hound knows where every creature within 60 feet is.",
  "mybook:monster/glass-hound.actions.1.name": "Multiattack",
  "mybook:monster/glass-hound.actions.1.desc": "The hound makes two bite attacks.",
  "mybook:monster/glass-hound.actions.2.name": "Bite",
  "mybook:monster/glass-hound.actions.2.desc": "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 6 (1d8 + 2) piercing damage."
}
```

- `special`, `actions`, `bonusActions`, `reactions` and `legendary` are lists. Each item is an object
  of **numbers** (it may be empty: `{}`), and its name and text are the strings
  `<id>.<list>.<n>.name` and `<id>.<list>.<n>.desc`, numbered **from 1** in the order of the list.
  So `actions[0]` is `actions.1`.
- An action with `attackBonus` and `damage` (`[{ "type", "dice" }]`) gets roll buttons in Play. A
  `dc` object (`{ "ability", "value", "onSave" }`) gets a saving throw button. `usage` says how
  often: `{ "type": "per day", "times": 3 }`, `{ "type": "recharge on roll", "minValue": 5 }` or
  `{ "type": "recharge after rest", "restTypes": ["short", "long"] }`. `multiattack` lists
  `{ "action": <position in the list, from 1>, "count": n }`.
- `armorClass` is a list: `{ "value": 17, "type": "natural" }`, or `{ "value": 15, "armor": [item ids] }`.
- `speed` is a record by `walk`, `fly`, `swim`, `climb`, `burrow` (`true` for a hover).
- `saves` and `skills` are the **total bonuses** (`{ "con": 7 }`), not the proficiency; `senses` is in
  feet; `conditionImmunities` is a list of condition slugs. Damage resistances, vulnerabilities and
  immunities are **texts** (`resistances`, `vulnerabilities`, `immunities`), written as in a stat
  block.
- A creature that grows with its owner (a companion, a summoned spirit) can scale: `armorClass[0]`
  may carry `plus: "proficiency"` or an ability, `data.scaling` holds formulas for hit points
  (`{ base, perLevel, owner, own, class }`), saves, skills and passive Perception
  (`{ base, pb }`), and an action may carry `attackPlus` and `damage[].plus` (`pb`, `spell`, an
  ability). The numbers are worked out from the owner when it has one.

## Checking a pack

The app checks everything it reads:

- **When a file is added**, the shape is checked: the ids, the kinds, the fields of every effect,
  the uniqueness of ids, and that every id starts with the pack id. A pack that fails is refused
  with the first problem.
- **In the Homebrew studio**, the preview of an entry lists what to fix: a missing name, `data`
  the engine cannot read (with the path of the field), a reference to an entry that is not there, an
  effect that does not fit. The same checks run on the whole pack from the page of the pack.
- **Broken references** (a trait, a granted spell, a parent or an option that points to an id no pack
  defines) are reported; the rest of the pack works.

To check a pack without the app, parse the file as JSON and verify these by hand:

1. `format`, `formatVersion`, `id` (letters and digits), `name`, `lang`, `pack.manifest.id` equal to `id`.
2. Every entry id matches `^[a-z0-9]+:[a-z]+/[a-z0-9]+(-+[a-z0-9]+)*$`, starts with `id:`, contains the
   entry's own kind, and is unique.
3. Every `data` field exists for the kind and has the type in the [reference](#the-data-of-each-kind).
   Required fields are present.
4. Every effect has a `type` of the [list](#effects-1), and its required fields.
5. Every id a field refers to (`trait.id`, `grantSpell.spell`, `parent`, `levels[].features`,
   `spell.classes`) exists in the pack or in the rules.
6. Every entry has a `name` text, and `strings` has no key whose entry id does not exist.

The repository checks this very page: the examples in it are loaded and validated by a test, so
they are known to be good starting points.

## Converting a book

This section is for a program or an AI turning a document (a homebrew book, a rules PDF) into a
pack. The format is built so that **most of a book converts mechanically**, and so that what cannot
be converted is not lost: it stays in the text.

### The method

1. **Read the table of contents and list what the book contains**: classes, subclasses, species,
   feats, items, spells, monsters, backgrounds, rules. Count them. Decide the pack `id` and `name`.
2. **Make an index of ids first.** Give every entry its id (`pack:kind/slug`) before writing any,
   because entries refer to each other (a class lists its features, a spell lists its classes).
3. **Write the texts exactly as the book has them**, in the language of the book. Keep the
   paragraphs, join the lines of a column into sentences, and drop page headers and numbers. Never
   summarize a rule: a player reads this text at the table.
4. **Write `data` and `effects` only for what is certain.** A number that the book states plainly
   (hit die, speed, spell level, cost) goes in `data`. A rule that matches an effect exactly (+2 to
   Wisdom, resistance to psychic damage, darkvision 60) goes in `effects`. A rule that does not
   match is left in the text.
5. **Check** the pack as described above and fix what it says.

### What to write for each part of a book

| In the book | In the pack |
| --- | --- |
| A class table with columns by level | `data.levels`: `cantripsKnown`, `spellsKnown`, `spellSlots` for the spell columns, `abilityScoreImprovements` for the ASI levels, and every other column in `classSpecific` |
| A feature of a class, "at 3rd level you gain..." | A `feature` entry with `data.class`, `data.level` and the text; its id in `levels[].features` of that level |
| A subclass or archetype | A `subclass` entry with `parent`; one `feature` per feature, with `data.subclass`; rows in `data.levels` for the levels it gives something |
| A species with traits | A `species` with `speed` and `size`, `abilityBonus` effects, one `trait` entry per trait |
| "Choose one skill / language / tool" | A `choice` effect with `grants` and `from` |
| A spell block | A `spell` entry: `level`, `school`, `components`, `classes`; the casting time, range, duration, material and description as texts |
| A weapon or armor table | An `item` with `data.weapon` or `data.armor`, its `cost` and `weight` |
| A magic item | An `item` with `rarity`, `attunement`, `slot`; effects only for bonuses the engine knows |
| A stat block | A `monster`, see [Monsters](#monsters-1) |
| A feat | A `feat` with `data.prerequisites` if it has one |
| A point pool (psi points, mana, Luck) | A `reserve` entry, `uses` effects with `reserve` for what gives points, a class `spellcasting` with `slots: "none"` if it casts with them |
| A new school of magic, a new damage type, a new skill | An entry of kind `school`, `skill` or `damage` |

### Rules of thumb

- **Slugs come from names**, so convert names consistently and keep a table of name → id.
- **Do not invent mechanics.** If an effect type does not match, write nothing. A correct text beats
  a wrong effect.
- **Distances and weights go in feet and pounds** in `data` and effects, wherever the book gives
  meters.
- **One pack per book**, or per setting when the book is a collection.
- **Keep the order of the book** in the list of entries; the app sorts for display.
- **Tell the person what was left as text.** A short report (which rules became effects, which are
  only text) is the most useful thing to hand back along with the file.
- **Copyright.** A pack with the text of a book is the work of its author; a person may keep it on
  their own device. Packs made from other people's books must not be published.

### What does not convert, and what to do

| The book says | Why it is not an effect | Write |
| --- | --- | --- |
| "You can spend X points to ignore the limit", "once per turn, when..." | The engine has no effect for a rule that modifies another feature | Keep it in the text of the feature |
| A rule that needs the player to decide a story detail | Not computable | The text |
| A new kind of component, a new action economy, a new mechanic | No effect type | A text, plus the data the pack format has room for (`component` and `reserve` entries) |
| A scaling that is not a column of the level table | No term for it | Add a column and use `{ "table": ... }`, or leave the number in the text |

## Limits

- The pack format is **declarative**. There is no scripting: a rule is an effect the engine knows or
  a text.
- Effects are **closed**: the list in the [reference](#effects-1) is all the engine applies.
- An entry's `kind` and `id` never change after creation; to rename, change the id everywhere it is
  written.
- A pack file is read in the browser and stored on the device; the app never uploads it.

## Reference

Everything below is generated from the catalog of the editor (`src/homebrew/catalog/`); do not edit
it by hand. Run `npm run docs:pack` to update it.

<!-- generated:reference -->

### Kinds of entry

| Kind | Role | Group | Owns |
| --- | --- | --- | --- |
| `species` | main | character | `trait` |
| `subspecies` | main | character | `trait` |
| `class` | main | character | `feature`, `trait` |
| `subclass` | main | character | `feature`, `trait` |
| `feature` | owned | character | `trait` |
| `background` | main | character |  |
| `trait` | owned | character |  |
| `spell` | main | magic |  |
| `item` | main | items |  |
| `property` | main | items |  |
| `ability` | vocabulary | rules |  |
| `skill` | vocabulary | rules |  |
| `language` | main | world |  |
| `feat` | main | character |  |
| `proficiency` | vocabulary | rules |  |
| `school` | vocabulary | rules |  |
| `condition` | vocabulary | rules |  |
| `alignment` | vocabulary | rules |  |
| `monster` | main | world |  |
| `deity` | main | world |  |
| `option` | main | character |  |
| `reserve` | vocabulary | rules |  |
| `damage` | vocabulary | rules |  |
| `component` | vocabulary | rules |  |

### The `data` of each kind

#### `species`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `speed` | number (integer, min 0, feet) | **yes** |  |
| `size` | `tiny` or `small` or `medium` or `large` or `huge` or `gargantuan` | no | Absent when the species lets the person pick a size (a `size` choice). |

#### `subspecies`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `replacesSpecies` | boolean | no | Stands in for its species: the species' own effects are not applied. |
| `speed` | number (integer, min 0, feet) | no |  |
| `size` | `tiny` or `small` or `medium` or `large` or `huge` or `gargantuan` | no |  |

#### `class`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `hitDie` | number (integer, min 4, max 20) | **yes** |  |
| `primaryAbility` | list of `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `multiclassing` | object { prerequisites, prerequisiteOptions?, proficiencies, proficiencyChoices? } | **yes** |  |
| `multiclassing.prerequisites` | list of object { ability, minimum } | **yes** |  |
| `multiclassing.prerequisites[].ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `multiclassing.prerequisites[].minimum` | number | **yes** |  |
| `multiclassing.prerequisiteOptions` | object { choose, from } | no |  |
| `multiclassing.prerequisiteOptions.choose` | number | **yes** |  |
| `multiclassing.prerequisiteOptions.from` | list of object { ability, minimum } | **yes** |  |
| `multiclassing.prerequisiteOptions.from[].ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `multiclassing.prerequisiteOptions.from[].minimum` | number | **yes** |  |
| `multiclassing.proficiencies` | list of text | **yes** |  |
| `multiclassing.proficiencyChoices` | list of any JSON | no |  |
| `levels` | list of object { level, features, abilityScoreImprovements, cantripsKnown?, spellsKnown?, spellSlots?, classSpecific? } | **yes** |  |
| `levels[].level` | number (integer, min 1, max 20) | **yes** |  |
| `levels[].features` | list of entry id (feature) | **yes** |  |
| `levels[].abilityScoreImprovements` | number | **yes** |  |
| `levels[].cantripsKnown` | number | no |  |
| `levels[].spellsKnown` | number | no |  |
| `levels[].spellSlots` | list of number | no |  |
| `levels[].classSpecific` | record of any JSON by key | no |  |
| `spellcasting` | object { ability, startsAtLevel, pact?, slots?, reserve?, maxLevel?, limit?, preparation } | no |  |
| `spellcasting.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `spellcasting.startsAtLevel` | number | **yes** |  |
| `spellcasting.pact` | boolean | no |  |
| `spellcasting.slots` | `none` | no | none: the class casts without spell slots; its spells cost points of `reserve`. |
| `spellcasting.reserve` | text | no | The reserve of the pack that a class without slots pays from. |
| `spellcasting.maxLevel` | any JSON | no | For a class without slots: "half" (half the class level, rounded up) or { column } of the class table. |
| `spellcasting.limit` | text | no | A column of the class table: the most points one spell can take. |
| `spellcasting.preparation` | one of (by `type`): `known`, `prepared`, `spellbook` | **yes** |  |
| `spellcasting.preparation(type=prepared).levelDivisor` | number | **yes** |  |
| `spellcasting.preparation(type=prepared).fromTable` | boolean | no |  |
| `spellcasting.preparation(type=spellbook).initial` | number | **yes** |  |
| `spellcasting.preparation(type=spellbook).perLevel` | number | **yes** |  |
| `spellcasting.preparation(type=spellbook).fromTable` | boolean | no |  |
| `startingEquipment` | list of object { item, quantity? } or object { category, count? } or object { gold } | no |  |
| `startingChoices` | list of object { options } | no |  |
| `startingChoices[].options` | list of object { items, requires? } | **yes** |  |
| `startingChoices[].options[].items` | list of object { item, quantity? } or object { category, count? } or object { gold } | **yes** |  |
| `startingChoices[].options[].requires` | text | no |  |
| `startingWealth` | object { dice, multiplier } | no |  |
| `startingWealth.dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `startingWealth.multiplier` | number | **yes** |  |

#### `subclass`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `levels` | list of object { level, features, cantripsKnown?, spellsKnown?, spellSlots?, subclassSpecific? } | **yes** |  |
| `levels[].level` | number (integer, min 1, max 20) | **yes** |  |
| `levels[].features` | list of entry id (feature) | **yes** |  |
| `levels[].cantripsKnown` | number | no |  |
| `levels[].spellsKnown` | number | no |  |
| `levels[].spellSlots` | list of number | no |  |
| `levels[].subclassSpecific` | record of any JSON by key | no |  |
| `spells` | list of object { spell, classLevel } | **yes** |  |
| `spells[].spell` | entry id (spell) | **yes** |  |
| `spells[].classLevel` | number | **yes** |  |
| `expanded` | list of entry id (spell) | no |  |
| `spellcasting` | object { ability, list, schools?, startsAtLevel, kind } | no |  |
| `spellcasting.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `spellcasting.list` | entry id (class) | **yes** |  |
| `spellcasting.schools` | list of slug of a school | no |  |
| `spellcasting.startsAtLevel` | number | **yes** |  |
| `spellcasting.kind` | `full` or `half` or `third` or `pact` | **yes** |  |

#### `feature`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `class` | entry id (class) | no | The class that gives it. |
| `subclass` | entry id (subclass) | no | The subclass that gives it. |
| `level` | number (integer, min 1, max 20) | no |  |
| `activation` | text | no | action, bonus or reaction: how it is used in play. |
| `hiddenByDefault` | boolean | no |  |
| `replaces` | list of entry id (feature) | no | Features it makes obsolete. |
| `prerequisites` | list of object { type, level } or object { type, feature } or object { type, spell } or object { ability, minimum } | no |  |
| `requires` | text | no | A requirement, written as Aurora writes it. |
| `featureSpecific` | any JSON | no |  |

#### `background`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `choose` | record of number by key | no | How many of each personality table the player picks. |
| `startingGold` | object { quantity, unit } | no |  |
| `startingGold.quantity` | number | **yes** |  |
| `startingGold.unit` | text | **yes** |  |
| `startingEquipment` | list of object { item, quantity? } or object { category, count? } or object { gold } | no |  |
| `startingChoices` | list of object { options } | no |  |
| `startingChoices[].options` | list of object { items, requires? } | **yes** |  |
| `startingChoices[].options[].items` | list of object { item, quantity? } or object { category, count? } or object { gold } | **yes** |  |
| `startingChoices[].options[].requires` | text | no |  |
| `abilityScores` | list of `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `feat` | entry id (feat) | no |  |

#### `trait`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `activation` | text | no |  |
| `class` | entry id (class) | no |  |
| `traitSpecific` | any JSON | no | Numbers of the trait's mechanics, like a breath weapon. |

#### `spell`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `level` | number (integer, min 0, max 9) | **yes** |  |
| `school` | slug of a school | **yes** |  |
| `components` | list of text | **yes** | V, S, M, or a component code the pack declares. |
| `ritual` | boolean | **yes** |  |
| `concentration` | boolean | **yes** |  |
| `classes` | list of entry id (class) | **yes** |  |
| `pointCost` | number | no | Points it takes from the reserve of a class that casts without slots (its level when absent). |
| `attackType` | `melee` or `ranged` | no | The spell is cast with an attack roll. |
| `damage` | list of object { damageType?, damageAtSlotLevel?, damageAtCharacterLevel? } | no |  |
| `damage[].damageType` | object { index } | no |  |
| `damage[].damageType.index` | text (picked: damage) | **yes** |  |
| `damage[].damageAtSlotLevel` | record of dice (`1d8`, `2d6+3`) by spell slot level (1-9) | no |  |
| `damage[].damageAtCharacterLevel` | record of dice (`1d8`, `2d6+3`) by character level (1-20) | no |  |
| `dc` | object { dcType, dcSuccess?, desc? } | no |  |
| `dc.dcType` | object { index } | **yes** |  |
| `dc.dcType.index` | text | **yes** |  |
| `dc.dcSuccess` | text | no |  |
| `dc.desc` | text | no |  |
| `healAtSlotLevel` | record of dice (`1d8`, `2d6+3`) by spell slot level (1-9) | no |  |
| `areaOfEffect` | object { type?, size? } | no |  |
| `areaOfEffect.type` | text | no |  |
| `areaOfEffect.size` | number | no |  |

#### `item`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | `weapon` or `armor` or `adventuring-gear` or `tools` or `mounts-and-vehicles` or `magic-items` (a menu) | **yes** |  |
| `cost` | object { amount, unit } | **yes** |  |
| `cost.amount` | number | **yes** |  |
| `cost.unit` | `cp` or `sp` or `gp` | **yes** |  |
| `weight` | number (min 0, pounds) | no |  |
| `rarity` | `common` or `uncommon` or `rare` or `very-rare` or `legendary` or `artifact` (a menu) | no | A magic item. |
| `attunement` | boolean | no | The item asks to be attuned to; at most three are. |
| `slot` | `head` or `neck` or `shoulders` or `body` or `arms` or `hands` or `ring` or `waist` or `feet` or `shield` or `oneHand` or `twoHands` (a menu) | no | Where it is worn or held. |
| `enhancement` | number (integer, min 0, max 3) | no | +1 to +3 to attack and damage. |
| `copyOf` | entry id (item) | no | The item a customized copy was made from. |
| `magical` | boolean | no | Counts as magic without a rarity. |
| `use` | object { heal? } | no | What using the item does when it can be worked out. |
| `use.heal` | dice (`1d8`, `2d6+3`) | no |  |
| `enchants` | boolean | no | An enchantment put on a weapon of the inventory, not carried by itself. |
| `weapon` | object { category, kind, damage?, twoHandedDamage?, properties, range, throwRange?, mastery?, proficiency } | no |  |
| `weapon.category` | `simple` or `martial` | **yes** |  |
| `weapon.kind` | `melee` or `ranged` | **yes** |  |
| `weapon.damage` | object { dice, type } | no |  |
| `weapon.damage.dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `weapon.damage.type` | text (picked: damage) | **yes** |  |
| `weapon.twoHandedDamage` | object { dice, type } | no |  |
| `weapon.twoHandedDamage.dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `weapon.twoHandedDamage.type` | text (picked: damage) | **yes** |  |
| `weapon.properties` | list of entry id (property) | **yes** |  |
| `weapon.range` | object { normal, long? } | **yes** |  |
| `weapon.range.normal` | number (min 0, feet) | **yes** |  |
| `weapon.range.long` | number (min 0, feet) | no |  |
| `weapon.throwRange` | object { normal, long? } | no |  |
| `weapon.throwRange.normal` | number (min 0, feet) | **yes** |  |
| `weapon.throwRange.long` | number (min 0, feet) | no |  |
| `weapon.mastery` | entry id (property) | no |  |
| `weapon.proficiency` | list of text (picked: weaponProf) | **yes** |  |
| `armor` | object { category, base, dexBonus, maxDexBonus?, strengthMinimum, stealthDisadvantage, properties?, proficiency } | no |  |
| `armor.category` | `light` or `medium` or `heavy` or `shield` | **yes** |  |
| `armor.base` | number | **yes** |  |
| `armor.dexBonus` | boolean | **yes** |  |
| `armor.maxDexBonus` | number | no |  |
| `armor.strengthMinimum` | number | **yes** |  |
| `armor.stealthDisadvantage` | boolean | **yes** |  |
| `armor.properties` | list of entry id (property) | no |  |
| `armor.proficiency` | list of text (picked: armorProf) | **yes** |  |
| `gear` | object { category?, bundleSize?, contents? } | no |  |
| `gear.category` | `standard-gear` or `kits` or `equipment-packs` or `ammunition` or `arcane-foci` or `druidic-foci` or `holy-symbols` or `poisons` (a menu) | no |  |
| `gear.bundleSize` | number | no |  |
| `gear.contents` | list of object { item, quantity } | no |  |
| `gear.contents[].item` | entry id (item) | **yes** |  |
| `gear.contents[].quantity` | number | **yes** |  |
| `tool` | object { category? } | no |  |
| `tool.category` | `artisans-tools` or `musical-instruments` or `gaming-sets` or `other-tools` (a menu) | no |  |
| `vehicle` | object { category?, speed?, crew?, passengers?, cargo?, armorClass?, hitPoints?, damageThreshold? } | no |  |
| `vehicle.category` | `mounts-and-other-animals` or `tack-harness-and-drawn-vehicles` or `waterborne-vehicles` (a menu) | no |  |
| `vehicle.speed` | object { amount, unit } | no |  |
| `vehicle.speed.amount` | number | **yes** |  |
| `vehicle.speed.unit` | text | **yes** |  |
| `vehicle.crew` | any JSON | no |  |
| `vehicle.passengers` | any JSON | no |  |
| `vehicle.cargo` | any JSON | no |  |
| `vehicle.armorClass` | number | no |  |
| `vehicle.hitPoints` | number | no |  |
| `vehicle.damageThreshold` | number | no |  |
| `poison` | object { delivery? } | no |  |
| `poison.delivery` | `ingested` or `inhaled` or `contact` or `injury` | no |  |

#### `property`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `mastery` | boolean | no | A weapon mastery property of the 2024 rules. |

#### `ability`

No fields: the entry is its name and its text.

#### `skill`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |

#### `language`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | `standard` or `exotic` (a menu) | no |  |

#### `feat`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | `origin` or `general` or `fighting-style` or `epic-boon` (a menu) | no |  |
| `builtIn` | boolean | no |  |
| `prerequisites` | list of object { type, level } or object { type, feature } or object { type, spell } or object { ability, minimum } | no |  |
| `requires` | text | no |  |
| `requirements` | text | no |  |
| `featureNamed` | any JSON | no |  |

#### `proficiency`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | `skill` or `save` or `weapon` or `armor` or `tool` or `language` | **yes** |  |
| `target` | text | **yes** |  |

#### `school`

No fields: the entry is its name and its text.

#### `condition`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `color` | text (picked: color) | no | The glow at the edges of the play screen while the condition lasts: a colour name or #rrggbb. |

#### `alignment`

No fields: the entry is its name and its text.

#### `monster`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `size` | `tiny` or `small` or `medium` or `large` or `huge` or `gargantuan` (a menu) | no |  |
| `type` | `aberration` or `beast` or `celestial` or `construct` or `dragon` or `elemental` or `fey` or `fiend` or `giant` or `humanoid` or `monstrosity` or `ooze` or `plant` or `undead` (a menu) | no |  |
| `subtype` | text | no |  |
| `swarm` | text | no |  |
| `armorClass` | list of object { value, type?, armor?, spell?, condition?, plus? } | no |  |
| `armorClass[].value` | number | **yes** |  |
| `armorClass[].type` | text | no |  |
| `armorClass[].armor` | list of text | no |  |
| `armorClass[].spell` | text | no |  |
| `armorClass[].condition` | text | no |  |
| `armorClass[].plus` | text | no |  |
| `hitPoints` | number | no |  |
| `hitDice` | text | no |  |
| `hitPointsRoll` | text | no |  |
| `speed` | record of number or `true` by key | no |  |
| `abilities` | record of number by str, dex, con, int, wis, cha | no |  |
| `saves` | record of number by str, dex, con, int, wis, cha | no |  |
| `skills` | record of number by key | no |  |
| `conditionImmunities` | list of text | no |  |
| `senses` | record of number (min 0, feet) by key | no |  |
| `blindBeyond` | list of text | no |  |
| `passivePerception` | number | no |  |
| `challenge` | number | no |  |
| `xp` | number | no |  |
| `proficiencyBonus` | number | no |  |
| `special` | list of object { attackBonus?, damage?, dc?, usage?, multiattack?, spellcasting? } | no | Traits of the creature; their texts are `special.N.name\|desc`. |
| `special[].attackBonus` | number | no |  |
| `special[].damage` | list of object { type, dice } | no |  |
| `special[].damage[].type` | text (picked: damage) | **yes** |  |
| `special[].damage[].dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `special[].dc` | object { ability?, value?, onSave? } | no |  |
| `special[].dc.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `special[].dc.value` | number | no |  |
| `special[].dc.onSave` | `none` or `half` (a menu) | no |  |
| `special[].usage` | any JSON | no | How often it can be used (per day, recharge...). |
| `special[].multiattack` | any JSON | no | The attacks of a multiattack: the position of each action and how many times. |
| `special[].spellcasting` | any JSON | no |  |
| `actions` | list of object { attackBonus?, damage?, dc?, usage?, multiattack?, spellcasting? } | no |  |
| `actions[].attackBonus` | number | no |  |
| `actions[].damage` | list of object { type, dice } | no |  |
| `actions[].damage[].type` | text (picked: damage) | **yes** |  |
| `actions[].damage[].dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `actions[].dc` | object { ability?, value?, onSave? } | no |  |
| `actions[].dc.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `actions[].dc.value` | number | no |  |
| `actions[].dc.onSave` | `none` or `half` (a menu) | no |  |
| `actions[].usage` | any JSON | no | How often it can be used (per day, recharge...). |
| `actions[].multiattack` | any JSON | no | The attacks of a multiattack: the position of each action and how many times. |
| `actions[].spellcasting` | any JSON | no |  |
| `bonusActions` | list of object { attackBonus?, damage?, dc?, usage?, multiattack?, spellcasting? } | no |  |
| `bonusActions[].attackBonus` | number | no |  |
| `bonusActions[].damage` | list of object { type, dice } | no |  |
| `bonusActions[].damage[].type` | text (picked: damage) | **yes** |  |
| `bonusActions[].damage[].dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `bonusActions[].dc` | object { ability?, value?, onSave? } | no |  |
| `bonusActions[].dc.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `bonusActions[].dc.value` | number | no |  |
| `bonusActions[].dc.onSave` | `none` or `half` (a menu) | no |  |
| `bonusActions[].usage` | any JSON | no | How often it can be used (per day, recharge...). |
| `bonusActions[].multiattack` | any JSON | no | The attacks of a multiattack: the position of each action and how many times. |
| `bonusActions[].spellcasting` | any JSON | no |  |
| `reactions` | list of object { attackBonus?, damage?, dc?, usage?, multiattack?, spellcasting? } | no |  |
| `reactions[].attackBonus` | number | no |  |
| `reactions[].damage` | list of object { type, dice } | no |  |
| `reactions[].damage[].type` | text (picked: damage) | **yes** |  |
| `reactions[].damage[].dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `reactions[].dc` | object { ability?, value?, onSave? } | no |  |
| `reactions[].dc.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `reactions[].dc.value` | number | no |  |
| `reactions[].dc.onSave` | `none` or `half` (a menu) | no |  |
| `reactions[].usage` | any JSON | no | How often it can be used (per day, recharge...). |
| `reactions[].multiattack` | any JSON | no | The attacks of a multiattack: the position of each action and how many times. |
| `reactions[].spellcasting` | any JSON | no |  |
| `legendary` | list of object { attackBonus?, damage?, dc?, usage?, multiattack?, spellcasting? } | no |  |
| `legendary[].attackBonus` | number | no |  |
| `legendary[].damage` | list of object { type, dice } | no |  |
| `legendary[].damage[].type` | text (picked: damage) | **yes** |  |
| `legendary[].damage[].dice` | dice (`1d8`, `2d6+3`) | **yes** |  |
| `legendary[].dc` | object { ability?, value?, onSave? } | no |  |
| `legendary[].dc.ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `legendary[].dc.value` | number | no |  |
| `legendary[].dc.onSave` | `none` or `half` (a menu) | no |  |
| `legendary[].usage` | any JSON | no | How often it can be used (per day, recharge...). |
| `legendary[].multiattack` | any JSON | no | The attacks of a multiattack: the position of each action and how many times. |
| `legendary[].spellcasting` | any JSON | no |  |
| `forms` | any JSON | no | The creatures a shapechanger can become. |

#### `deity`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `alignment` | entry id (alignment) | no |  |
| `domains` | text | no |  |

#### `option`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `replaces` | list of entry id (feature, trait, option) | no | Entries it takes the place of; they are hidden unless shown again. |
| `backgroundFeature` | boolean | no | A text-only option that stands in for the feature of the background. |
| `prerequisites` | list of object { type, level } or object { type, feature } or object { type, spell } or object { ability, minimum } | no |  |
| `requires` | text | no |  |

#### `reserve`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `recharge` | `long` or `short` | no | When the points of the reserve come back: after a long rest or after a short one. |

#### `damage`

No fields: the entry is its name and its text.

#### `component`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `code` | text | **yes** | The short code of the component (one to three letters or digits, such as A or O), ticked in the form of a spell. |

### Effects

34 types. Every effect is an object with a `type` and the fields listed; the optional fields can be left out.

#### `flag`

Sets a name that `when.requires` can ask for, for a rule that says "this is held" without being an entry. It counts only where the effect itself applies, so a flag inside a `when` is set only while that holds.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | **yes** |  |

#### `abilityBonus`

Raises an ability score by `value`. `max` is the most the score may reach with it (24 for a barbarian's Primal Champion); 20 when absent, and the sheet warns above it.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `value` | number | **yes** |  |
| `max` | number | no |  |

#### `proficiency`

Proficiency in one thing. `category` is `skill`, `save`, `weapon`, `armor`, `tool` or `language`; `target` is the slug of an entry of the matching kind (`arcana`, `smiths-tools`, `simple-weapons`, `common`) or, for a save, an ability (`wis`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `category` | `skill` or `save` or `weapon` or `armor` or `tool` or `language` | **yes** |  |
| `target` | text | **yes** |  |

#### `trait`

Gives the character a trait: another entry (kind `trait` or `feature`) with its own text and effects. This is how a species, a subspecies, a class, a feature or an option owns its traits. `minLevel` makes the trait come with that level (of the class that gives it, of the whole character for a species).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | entry id (trait, feature) | **yes** |  |
| `minLevel` | number | no |  |

#### `choice`

The person picks `choose` of the options in `from`. `grants` says what each pick is: `proficiency` (options are `category:target`, such as `skill:arcana`), `language` (language slugs), `spell` (entry ids, or no `from` to open the whole list through `spellLevel`, `spellUpTo`, `spellClass` and `ritual`), `trait` (entry ids), `abilityBonus` (ability ids, `value` each), `expertise` (skill slugs), `feat` (entry ids; an empty `from` offers every feat), `mastery` (weapon items) and `size` (creature sizes). A spell pick can be cast without a slot with `free` (`rest` says which rest) or `atWill`. `chooseBy` replaces the fixed `choose` by a column of the class table.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | **yes** |  |
| `choose` | number (integer, min 1) | **yes** |  |
| `grants` | `proficiency` or `language` or `spell` or `trait` or `abilityBonus` or `expertise` or `feat` or `mastery` or `size` | **yes** |  |
| `from` | list of text | **yes** |  |
| `value` | number | no |  |
| `free` | boolean | no |  |
| `spellLevel` | number | no |  |
| `spellUpTo` | number | no |  |
| `spellClass` | entry id (class) | no |  |
| `ritual` | boolean | no |  |
| `atWill` | boolean | no |  |
| `rest` | `short` or `long` | no |  |
| `chooseBy` | text (picked: column) | no |  |

#### `grantSpell`

Gives a spell. By default it is always prepared and does not count against the spells known; `minLevel` makes it come with that class level, `free` lets it be cast once between rests without a slot (`rest` says which rest), `atWill` lets it be cast as often as wanted without a slot and lists it with the cantrips.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `spell` | entry id (spell) | **yes** |  |
| `minLevel` | number | no |  |
| `free` | boolean | no |  |
| `rest` | `short` or `long` | no |  |
| `atWill` | boolean | no |  |

#### `unarmedStrike`

A natural weapon (claws, a bite): the unarmed strike rolls `dice` of `damageType` instead of its 1 and bludgeoning, and is shown even when a weapon is in hand.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dice` | text | **yes** |  |
| `damageType` | text (picked: damage) | **yes** |  |

#### `spellDamage`

Adds the modifier of the ability `plus` to the damage that spells roll in Play. `spell`, `school` or `damageType` say which spells (all when none is given). `once` adds it to one roll of the spell instead of every roll.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `plus` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `spell` | entry id (spell) | no |  |
| `school` | text | no |  |
| `damageType` | text (picked: damage) | no |  |
| `once` | boolean | no |  |

#### `spellHealing`

Changes the healing that spells roll in Play (only spells with a healing roll in their data, cast with a slot of 1st level or higher). `plusSlotLevel` adds that number and the level of the slot to every roll; `maxDice` gives the highest number on every die; `selfPlusSlotLevel` heals the caster that much plus the slot level when the healing is for someone else.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `plusSlotLevel` | number | no |  |
| `maxDice` | boolean | no |  |
| `selfPlusSlotLevel` | number | no |  |

#### `extraDamage`

Damage a feature adds to attacks, rolled by a card of its own in Play. The dice are those of the highest `steps` entry whose `minLevel` the class level reaches. `note` picks the sentence that says when it applies (`oncePerTurn`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `damageType` | text (picked: damage) | **yes** |  |
| `steps` | list of object { minLevel, dice } | **yes** |  |
| `steps[].minLevel` | number | **yes** |  |
| `steps[].dice` | text | **yes** |  |
| `note` | `oncePerTurn` | **yes** |  |

#### `modifier`

A flat bonus to a number of the sheet. `target` is `ac`, `speed`, `initiative`, `attack`, `damage`, `hpPerLevel`, `hp`, `save` (every saving throw), `skill` (every skill, or the one in `skill`), `spellAttack` or `spellDc`. `plus` adds the proficiency bonus or an ability modifier to `value`; `min` is the least the total can be; `when` narrows it to what the character wears or wields (`wearingArmor`, `unarmored`, `noHeavyArmor`, `unarmoredNoShield`, `wearingShield`, `ranged`, `melee`, `dueling`); `minLevel` starts it at a level.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `target` | `ac` or `speed` or `initiative` or `attack` or `damage` or `hpPerLevel` or `hp` or `save` or `skill` or `spellAttack` or `spellDc` | **yes** |  |
| `value` | number | **yes** |  |
| `plus` | `str` or `dex` or `con` or `int` or `wis` or `cha` or `"proficiency"` | no |  |
| `skill` | slug of a skill | no |  |
| `when` | `wearingArmor` or `heavyArmor` or `unarmored` or `noHeavyArmor` or `unarmoredNoShield` or `wearingShield` or `ranged` or `melee` or `dueling` | no |  |
| `minLevel` | number | no |  |
| `min` | number | no |  |

#### `movement`

A climbing, swimming, flying or burrowing speed in feet, or `"walk"` for one equal to the walking speed. The best one counts and bonuses to speed add to it.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `mode` | `climb` or `swim` or `fly` or `burrow` | **yes** |  |
| `feet` | number (min 0) or `"walk"` | **yes** |  |
| `when` | `wearingArmor` or `heavyArmor` or `unarmored` or `noHeavyArmor` or `unarmoredNoShield` or `wearingShield` or `ranged` or `melee` or `dueling` | no |  |

#### `sense`

A sense with a range in feet. The longest one counts.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `sense` | `darkvision` or `blindsight` or `tremorsense` or `truesight` | **yes** |  |
| `range` | number (min 0, feet) | **yes** |  |
| `when` | `wearingArmor` or `heavyArmor` or `unarmored` or `noHeavyArmor` or `unarmoredNoShield` or `wearingShield` or `ranged` or `melee` or `dueling` | no |  |

#### `attunementMax`

The number of items the character can be attuned to at once, when it is more than three.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | number (integer, min 3) | **yes** |  |

#### `expertise`

Double proficiency bonus on a skill the character is already proficient in (`skill` is the slug of a skill).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `skill` | slug of a skill | **yes** |  |

#### `size`

The size of the creature, for a species that lets the person pick one through a `choice` that grants `size`. A species with one size has it in `data.size`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `size` | `tiny` or `small` or `medium` or `large` or `huge` or `gargantuan` | **yes** |  |

#### `abilityFloor`

The ability score is at least `value` (Gauntlets of Ogre Power); it never lowers it.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `value` | number | **yes** |  |

#### `weaponAbility`

Attacks with weapons may use `ability` instead of Strength or Dexterity; the best ability that applies wins. `when` narrows the weapons to one-handed ones (`oneHanded`) or magic ones (`magic`); `proficient` asks for a weapon the character is proficient with.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `ability` | `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `when` | `oneHanded` or `magic` | no |  |
| `proficient` | boolean | no |  |

#### `defense`

A resistance, an immunity or a vulnerability to a kind of damage. `damage` is one of the thirteen of the rules or a kind the pack adds as an entry of kind `damage` (the end of its id).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `kind` | `resistance` or `immunity` or `vulnerability` | **yes** |  |
| `damage` | text (picked: damage) | **yes** |  |

#### `damageReduction`

A flat amount taken off a hit (Heavy Armor Master: 3, or the proficiency bonus). `value` is the amount and `plus: "proficiency"` adds the proficiency bonus; `damage` lists the kinds it covers (every kind when absent); `when` is what the character must wear (`heavyArmor`, `wearingArmor`...); `note` is a condition in words, such as "nonmagical attacks". The sheet and the Play screen list it with the resistances, immunities and vulnerabilities; the person does the sum, nothing is taken off by itself.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | number (integer, min 0) | **yes** |  |
| `plus` | `proficiency` | no |  |
| `damage` | list of text (picked: damage) | no |  |
| `when` | `wearingArmor` or `heavyArmor` or `unarmored` or `noHeavyArmor` or `unarmoredNoShield` or `wearingShield` or `ranged` or `melee` or `dueling` | no |  |
| `note` | text | no |  |

#### `halfProficiency`

Half the proficiency bonus on ability checks that do not use it (Jack of All Trades): every ability, or only those in `abilities`. `round` is `down` or `up`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `round` | `down` or `up` | **yes** |  |
| `abilities` | list of `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |

#### `unarmoredDefense`

Armor class without body armor: `base` + Dexterity + the abilities in `add`. `shield` says whether a shield may be carried; `noDex` leaves Dexterity out (a fixed natural armor).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `base` | number | **yes** |  |
| `add` | list of `str` or `dex` or `con` or `int` or `wis` or `cha` | **yes** |  |
| `shield` | boolean | **yes** |  |
| `noDex` | boolean | no |  |

#### `weaponMastery`

The character can use the mastery property of this kind of weapon (`item` is a weapon item such as a longsword).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `item` | entry id (item) | **yes** |  |

#### `featureValue`

A number a feature shows on the sheet, such as the save DC of a breath weapon. The terms of one `name` add up; terms with a `minLevel` come once the level is reached. Terms with the same `bonus` do not stack: only the highest counts. A text term is shown as it is. `term` is a number, `{ "text": "..." }`, `{ "of": "proficiency" }` or `{ "of": "level" }`, `{ "mod": ability }`, `{ "score": ability }`, `{ "classLevel": slug }` or `{ "table": column }`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | text | **yes** |  |
| `term` | number or object { text } or object { of } or object { mod } or object { score } or object { classLevel } or object { table } | **yes** |  |
| `minLevel` | number | no |  |
| `bonus` | text | no |  |

#### `conditionImmunity`

The character cannot be affected by this condition (`condition` is the slug of a condition entry).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `condition` | slug of a condition | **yes** |  |

#### `extraAttack`

The Attack action makes `attacks` attacks, from the class level `minLevel` if it is given. Extra Attacks do not add up: the most counts.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `attacks` | number (integer, min 2, max 8) | **yes** |  |
| `minLevel` | number | no |  |

#### `selfHeal`

Using the feature heals the character `dice` plus `perLevel` times the level of the class that gives it, plus the modifier of `plus` if given, at least `minimum`. `martialArts` uses the monk's Martial Arts die. Play rolls it; the uses of the feature are its `uses`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dice` | text | no |  |
| `perLevel` | number | no |  |
| `martialArts` | boolean | no |  |
| `plus` | `str` or `dex` or `con` or `int` or `wis` or `cha` | no |  |
| `minimum` | number | no |  |

#### `checkBoost`

After a failed ability check the character may add `dice` by using up one use of the feature in `spends`. If the check still fails, Play gives the use back when told so.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `dice` | text | **yes** |  |
| `spends` | entry id (feature, trait) | **yes** |  |

#### `critRange`

The lowest die that is a critical hit with weapon attacks (`min`: 19 for a Champion). The lowest counts.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `min` | number (integer, min 2, max 20) | **yes** |  |

#### `d20Floor`

A die lower than `value` counts as `value` on a check (Reliable Talent: `on` is `proficientSkills`). The highest counts.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `value` | number (integer, min 2, max 20) | **yes** |  |
| `on` | `proficientSkills` | **yes** |  |

#### `uses`

How many times a feature can be used between rests, ticked off in Play. `term` is the number: a plain number, or `{ "mod": ability }`, `{ "of": "level" }`, `{ "classLevel": slug }`, `{ "table": column }`. The terms of one entry add up; those with a `minLevel` replace one another. `recharge` is `short` or `long`. `pool: true` counts it as a number (points) instead of marks. `min` is the least the total can be. `reserve` adds the points to a named reserve declared by the pack, which every source with that name shares.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `term` | number or object { text } or object { of } or object { mod } or object { score } or object { classLevel } or object { table } | **yes** |  |
| `recharge` | `short` or `long` | **yes** |  |
| `minLevel` | number | no |  |
| `pool` | boolean | no |  |
| `reserve` | text (picked: reserve) | no |  |
| `min` | number | no |  |

#### `spends`

Using the feature takes `cost` points (1 when absent) from a pool: `pool` is the pool of a class (`ki`, `focus`, `channelDivinity`, `bardicInspiration`, `sorceryPoints`, `wildShape`), or `reserve` is a reserve declared by the pack.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `pool` | `ki` or `focus` or `channelDivinity` or `bardicInspiration` or `sorceryPoints` or `wildShape` | no |  |
| `reserve` | text (picked: reserve) | no |  |
| `cost` | number (integer, min 1, max 9) | no |  |

#### `resource`

A resource of its own with a maximum and a recharge (`short`, `long` or `dawn`).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | text | **yes** |  |
| `max` | number (integer, min 0) | **yes** |  |
| `recharge` | `short` or `long` or `dawn` | **yes** |  |

#### `when`

Holds its `effects` only while `requires` is true, checked every time the sheet is worked out. The requirement is written with names (entry ids or flags), `,` for "and", `||` for "or", `!` for "not" and brackets to group.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `requires` | text | **yes** |  |
| `effects` | list of effects | **yes** |  |

### Ids of the rules

These are the ids of the shipped rules that a pack can refer to. The id of an entry is `srd51:kind/slug` for the 2014 rules and `srd52:kind/slug` for the 2024 rules; below, the slug of every entry of the kinds a pack usually refers to. A slug listed under *both* exists in the two editions (use `srd51:` or `srd52:` as the character requires: a reference to a 2014 spell is carried over to the 2024 one when it exists). `monster`, `feature` and `trait` have hundreds of entries and follow the same pattern.

Where a field asks for the **slug of a word of the rules** (a skill, a school, a condition, a language, a proficiency target), write the slug without the pack and kind. A `proficiency` is written `category:target`, which is how `choice` options write it (`skill:arcana`, `tool:smiths-tools`); in a `proficiency` effect, `category` and `target` are separate fields.

#### `ability`

6 in the 2014 rules, 6 in the 2024 rules.

Both editions (6):

```text
cha, con, dex, int, str, wis
```

#### `skill`

18 in the 2014 rules, 18 in the 2024 rules.

Both editions (18):

```text
acrobatics, animal-handling, arcana, athletics, deception, history, insight, intimidation,
investigation, medicine, nature, perception, performance, persuasion, religion, sleight-of-hand,
stealth, survival
```

#### `proficiency`

117 in the 2014 rules, 74 in the 2024 rules.

Both editions (66):

```text
armor:all-armor, armor:heavy-armor, armor:light-armor, armor:medium-armor, armor:shields,
save:cha, save:con, save:dex, save:int, save:str, save:wis, skill:acrobatics,
skill:animal-handling, skill:arcana, skill:athletics, skill:deception, skill:history,
skill:insight, skill:intimidation, skill:investigation, skill:medicine, skill:nature,
skill:perception, skill:performance, skill:persuasion, skill:religion, skill:sleight-of-hand,
skill:stealth, skill:survival, tool:alchemists-supplies, tool:bagpipes, tool:brewers-supplies,
tool:carpenters-tools, tool:cartographers-tools, tool:cobblers-tools, tool:cooks-utensils,
tool:disguise-kit, tool:drum, tool:dulcimer, tool:flute, tool:forgery-kit,
tool:glassblowers-tools, tool:herbalism-kit, tool:horn, tool:jewelers-tools,
tool:leatherworkers-tools, tool:lute, tool:lyre, tool:masons-tools, tool:painters-supplies,
tool:pan-flute, tool:potters-tools, tool:shawm, tool:smiths-tools, tool:tinkers-tools, tool:viol,
tool:weavers-tools, tool:woodcarvers-tools, weapon:hand-crossbows, weapon:longswords,
weapon:martial-weapons, weapon:rapiers, weapon:scimitars, weapon:shortswords,
weapon:simple-weapons, weapon:whips
```

Only the 2014 rules (`srd51`) (51):

```text
armor:breastplate, armor:chain-mail, armor:chain-shirt, armor:half-plate-armor, armor:hide-armor,
armor:leather-armor, armor:padded-armor, armor:plate-armor, armor:ring-mail, armor:scale-mail,
armor:splint-armor, armor:studded-leather-armor, tool:calligraphers-supplies, tool:dice-set,
tool:land-vehicles, tool:navigators-tools, tool:playing-card-set, tool:poisoners-kit,
tool:thieves-tools, tool:water-vehicles, weapon:battleaxes, weapon:blowguns, weapon:clubs,
weapon:crossbows-heavy, weapon:crossbows-light, weapon:daggers, weapon:darts, weapon:flails,
weapon:glaives, weapon:greataxes, weapon:greatclubs, weapon:greatswords, weapon:halberds,
weapon:handaxes, weapon:javelins, weapon:lances, weapon:light-hammers, weapon:longbows,
weapon:maces, weapon:mauls, weapon:morningstars, weapon:nets, weapon:pikes, weapon:quarterstaffs,
weapon:shortbows, weapon:sickles, weapon:slings, weapon:spears, weapon:tridents,
weapon:war-picks, weapon:warhammers
```

Only the 2024 rules (`srd52`) (8):

```text
tool:tool-calligraphers-supplies, tool:tool-dice, tool:tool-dragonchess,
tool:tool-navigators-tools, tool:tool-playing-cards, tool:tool-poisoners-kit,
tool:tool-thieves-tools, tool:tool-three-dragon-ante
```

#### `school`

8 in the 2014 rules, 8 in the 2024 rules.

Both editions (8):

```text
abjuration, conjuration, divination, enchantment, evocation, illusion, necromancy, transmutation
```

#### `condition`

15 in the 2014 rules, 15 in the 2024 rules.

Both editions (15):

```text
blinded, charmed, deafened, exhaustion, frightened, grappled, incapacitated, invisible,
paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious
```

#### `language`

16 in the 2014 rules, 19 in the 2024 rules.

Both editions (16):

```text
abyssal, celestial, common, deep-speech, draconic, dwarvish, elvish, giant, gnomish, goblin,
halfling, infernal, orc, primordial, sylvan, undercommon
```

Only the 2024 rules (`srd52`) (3):

```text
common-sign-language, druidic, thieves-cant
```

#### `alignment`

9 in the 2014 rules, 10 in the 2024 rules.

Both editions (9):

```text
chaotic-evil, chaotic-good, chaotic-neutral, lawful-evil, lawful-good, lawful-neutral, neutral,
neutral-evil, neutral-good
```

Only the 2024 rules (`srd52`) (1):

```text
unaligned
```

#### `property`

11 in the 2014 rules, 18 in the 2024 rules.

Both editions (9):

```text
ammunition, finesse, heavy, light, loading, reach, thrown, two-handed, versatile
```

Only the 2014 rules (`srd51`) (2):

```text
monk, special
```

Only the 2024 rules (`srd52`) (9):

```text
mastery-cleave, mastery-graze, mastery-nick, mastery-push, mastery-sap, mastery-slow,
mastery-topple, mastery-vex, range
```

#### `class`

12 in the 2014 rules, 12 in the 2024 rules.

Both editions (12):

```text
barbarian, bard, cleric, druid, fighter, monk, paladin, ranger, rogue, sorcerer, warlock, wizard
```

#### `subclass`

12 in the 2014 rules, 12 in the 2024 rules.

Both editions (3):

```text
champion, hunter, thief
```

Only the 2014 rules (`srd51`) (9):

```text
berserker, devotion, draconic, evocation, fiend, land, life, lore, open-hand
```

Only the 2024 rules (`srd52`) (9):

```text
circle-of-the-land, college-of-lore, draconic-sorcery, evoker, fiend-patron, life-domain,
oath-of-devotion, path-of-the-berserker, warrior-of-the-open-hand
```

#### `species`

9 in the 2014 rules, 9 in the 2024 rules.

Both editions (7):

```text
dragonborn, dwarf, elf, gnome, halfling, human, tiefling
```

Only the 2014 rules (`srd51`) (2):

```text
half-elf, half-orc
```

Only the 2024 rules (`srd52`) (2):

```text
goliath, orc
```

#### `subspecies`

4 in the 2014 rules, 0 in the 2024 rules.

Only the 2014 rules (`srd51`) (4):

```text
high-elf, hill-dwarf, lightfoot-halfling, rock-gnome
```

#### `background`

1 in the 2014 rules, 4 in the 2024 rules.

Both editions (1):

```text
acolyte
```

Only the 2024 rules (`srd52`) (3):

```text
criminal, sage, soldier
```

#### `feat`

0 in the 2014 rules, 17 in the 2024 rules.

Only the 2024 rules (`srd52`) (17):

```text
ability-score-improvement, alert, archery, boon-of-combat-prowess, boon-of-dimensional-travel,
boon-of-fate, boon-of-irresistible-offense, boon-of-spell-recall, boon-of-the-night-spirit,
boon-of-truesight, defense, grappler, great-weapon-fighting, magic-initiate, savage-attacker,
skilled, two-weapon-fighting
```

#### `spell`

319 in the 2014 rules, 339 in the 2024 rules.

Both editions (317):

```text
acid-arrow, acid-splash, aid, alarm, alter-self, animal-friendship, animal-messenger,
animal-shapes, animate-dead, animate-objects, antilife-shell, antimagic-field,
antipathy-sympathy, arcane-eye, arcane-hand, arcane-lock, arcane-sword, arcanists-magic-aura,
astral-projection, augury, awaken, bane, banishment, barkskin, beacon-of-hope, bestow-curse,
black-tentacles, blade-barrier, bless, blight, blindness-deafness, blink, blur, burning-hands,
call-lightning, calm-emotions, chain-lightning, charm-person, chill-touch, circle-of-death,
clairvoyance, clone, cloudkill, color-spray, command, commune, commune-with-nature,
comprehend-languages, compulsion, cone-of-cold, confusion, conjure-animals, conjure-celestial,
conjure-elemental, conjure-fey, conjure-minor-elementals, conjure-woodland-beings,
contact-other-plane, contagion, contingency, continual-flame, control-water, control-weather,
counterspell, create-food-and-water, create-or-destroy-water, create-undead, creation,
cure-wounds, dancing-lights, darkness, darkvision, daylight, death-ward, delayed-blast-fireball,
demiplane, detect-evil-and-good, detect-magic, detect-poison-and-disease, detect-thoughts,
dimension-door, disguise-self, disintegrate, dispel-evil-and-good, dispel-magic, divination,
divine-favor, divine-word, dominate-beast, dominate-monster, dominate-person, dream, druidcraft,
earthquake, eldritch-blast, enhance-ability, enlarge-reduce, entangle, enthrall, etherealness,
expeditious-retreat, eyebite, fabricate, faerie-fire, faithful-hound, false-life, fear,
feather-fall, find-familiar, find-steed, find-the-path, find-traps, finger-of-death, fire-bolt,
fire-shield, fire-storm, fireball, flame-blade, flame-strike, flaming-sphere, flesh-to-stone,
floating-disk, fly, fog-cloud, forbiddance, forcecage, foresight, freedom-of-movement,
freezing-sphere, gaseous-form, gate, geas, gentle-repose, giant-insect, glibness,
globe-of-invulnerability, glyph-of-warding, goodberry, grease, greater-invisibility,
greater-restoration, guardian-of-faith, guards-and-wards, guidance, guiding-bolt, gust-of-wind,
hallow, hallucinatory-terrain, harm, haste, heal, healing-word, heat-metal, hellish-rebuke,
heroes-feast, heroism, hideous-laughter, hold-monster, hold-person, holy-aura, hunters-mark,
hypnotic-pattern, ice-storm, identify, illusory-script, imprisonment, incendiary-cloud,
inflict-wounds, insect-plague, instant-summons, invisibility, irresistible-dance, jump, knock,
legend-lore, lesser-restoration, levitate, light, lightning-bolt, locate-animals-or-plants,
locate-creature, locate-object, longstrider, mage-armor, mage-hand, magic-circle, magic-jar,
magic-missile, magic-mouth, magic-weapon, magnificent-mansion, major-image, mass-cure-wounds,
mass-heal, mass-healing-word, mass-suggestion, maze, meld-into-stone, mending, message,
meteor-swarm, mind-blank, minor-illusion, mirage-arcane, mirror-image, mislead, misty-step,
modify-memory, moonbeam, move-earth, nondetection, pass-without-trace, passwall,
phantasmal-killer, phantom-steed, planar-ally, planar-binding, plane-shift, plant-growth,
poison-spray, polymorph, power-word-kill, power-word-stun, prayer-of-healing, prestidigitation,
prismatic-spray, prismatic-wall, private-sanctum, produce-flame, programmed-illusion,
project-image, protection-from-energy, protection-from-evil-and-good, protection-from-poison,
purify-food-and-drink, raise-dead, ray-of-enfeeblement, ray-of-frost, regenerate, reincarnate,
remove-curse, resilient-sphere, resistance, resurrection, reverse-gravity, revivify, rope-trick,
sacred-flame, sanctuary, scorching-ray, scrying, secret-chest, see-invisibility, seeming,
sending, sequester, shapechange, shatter, shield, shield-of-faith, shillelagh, shocking-grasp,
silence, silent-image, simulacrum, sleep, sleet-storm, slow, spare-the-dying, speak-with-animals,
speak-with-dead, speak-with-plants, spider-climb, spike-growth, spirit-guardians,
spiritual-weapon, stinking-cloud, stone-shape, stoneskin, storm-of-vengeance, suggestion,
sunbeam, sunburst, symbol, telekinesis, telepathic-bond, teleport, teleportation-circle,
thaumaturgy, thunderwave, time-stop, tiny-hut, tongues, transport-via-plants, tree-stride,
true-polymorph, true-resurrection, true-seeing, true-strike, unseen-servant, vampiric-touch,
vicious-mockery, wall-of-fire, wall-of-force, wall-of-ice, wall-of-stone, wall-of-thorns,
warding-bond, water-breathing, water-walk, web, weird, wind-walk, wind-wall, wish,
word-of-recall, zone-of-truth
```

Only the 2014 rules (`srd51`) (2):

```text
branding-smite, feeblemind
```

Only the 2024 rules (`srd52`) (22):

```text
aura-of-life, befuddlement, charm-monster, chromatic-orb, dissonant-whispers, divine-smite,
dragons-breath, elementalism, ensnaring-strike, hex, ice-knife, mind-spike, phantasmal-force,
power-word-heal, ray-of-sickness, searing-smite, shining-smite, sorcerous-burst, starry-wisp,
summon-dragon, tsunami, vitriolic-sphere
```

#### `item`

578 in the 2014 rules, 491 in the 2024 rules.

Both editions (385):

```text
adamantine-armor, alchemists-supplies, ammunition-1, ammunition-2, ammunition-3, amulet,
amulet-of-health, amulet-of-proof-against-detection-and-location, amulet-of-the-planes,
animated-shield, apparatus-of-the-crab, armor-1, armor-2, armor-3, armor-of-invulnerability,
armor-of-resistance, armor-of-vulnerability, arrow-catching-shield, backpack, bag-of-beans,
bag-of-devouring, bag-of-holding, bagpipes, barrel, basket, battleaxe, bead-of-force, bedroll,
bell, belt-of-dwarvenkind, berserker-axe, blanket, block-and-tackle, blowgun, book,
boots-of-elvenkind, boots-of-levitation, boots-of-speed, boots-of-striding-and-springing,
boots-of-the-winterlands, bottle-glass, bowl-of-commanding-water-elementals, bracers-of-archery,
bracers-of-defense, brazier-of-commanding-fire-elementals, breastplate, brewers-supplies,
brooch-of-shielding, broom-of-flying, bucket, burglars-pack, calligraphers-supplies, caltrops,
camel, candle, candle-of-invocation, cape-of-the-mountebank, carpenters-tools, carriage, cart,
case-crossbow-bolt, case-map-or-scroll, censer-of-controlling-air-elementals, chain-mail,
chain-shirt, chariot, chest, chime-of-opening, circlet-of-blasting, climbers-kit,
cloak-of-arachnida, cloak-of-displacement, cloak-of-elvenkind, cloak-of-protection,
cloak-of-the-bat, cloak-of-the-manta-ray, clothes-fine, clothes-travelers, club, cobblers-tools,
component-pouch, cooks-utensils, crowbar, crystal, crystal-ball-of-mind-reading,
crystal-ball-of-telepathy, crystal-ball-of-true-seeing, cube-of-force, cubic-gate, dagger,
dagger-of-venom, dancing-sword, dart, decanter-of-endless-water, deck-of-illusions, defender,
demon-armor, dimensional-shackles, disguise-kit, dragon-slayer, drum, dulcimer,
dust-of-disappearance, dust-of-dryness, dust-of-sneezing-and-choking, dwarven-plate,
dwarven-thrower, efficient-quiver, efreeti-bottle, elephant, elven-chain, emblem,
entertainers-pack, eversmoking-bottle, explorers-pack, eyes-of-charming, eyes-of-minute-seeing,
eyes-of-the-eagle, flail, flame-tongue, flute, folding-boat, forgery-kit, frost-brand, galley,
gauntlets-of-ogre-power, gem-of-brightness, gem-of-seeing, giant-slayer, glaive,
glassblowers-tools, gloves-of-missile-snaring, gloves-of-swimming-and-climbing, goggles-of-night,
grappling-hook, greataxe, greatclub, greatsword, halberd, half-plate-armor,
hammer-of-thunderbolts, handaxe, handy-haversack, hat-of-disguise, headband-of-intellect,
healers-kit, helm-of-brilliance, helm-of-comprehending-languages, helm-of-telepathy,
helm-of-teleportation, herbalism-kit, hide-armor, holy-avenger, horn, horn-of-blasting,
horseshoes-of-a-zephyr, horseshoes-of-speed, hunting-trap, immovable-rod, ink-pen,
instant-fortress, iron-flask, javelin, javelin-of-lightning, jewelers-tools, keelboat, lamp,
lance, lantern-bullseye, lantern-hooded, lantern-of-revealing, leather-armor,
leatherworkers-tools, light-hammer, lock, longbow, longship, longsword, luck-blade, lute, lyre,
mace, mace-of-disruption, mace-of-smiting, mace-of-terror, magnifying-glass, manacles,
mantle-of-spell-resistance, manual-of-bodily-health, manual-of-gainful-exercise,
manual-of-quickness-of-action, marvelous-pigments, masons-tools, mastiff, maul,
medallion-of-thoughts, mirror-of-life-trapping, mithral-armor, morningstar, mule,
navigators-tools, necklace-of-adaptation, necklace-of-fireballs, necklace-of-prayer-beads, net,
nine-lives-stealer, oathbow, oil-of-etherealness, oil-of-sharpness, oil-of-slipperiness, orb,
padded-armor, painters-supplies, pan-flute, pearl-of-power, periapt-of-health,
periapt-of-proof-against-poison, periapt-of-wound-closure, philter-of-love, pike,
pipes-of-haunting, pipes-of-the-sewers, plate-armor, plate-armor-of-etherealness, poisoners-kit,
pony, portable-hole, pot-iron, potion-of-animal-friendship, potion-of-clairvoyance,
potion-of-climbing, potion-of-diminution, potion-of-flying, potion-of-gaseous-form,
potion-of-growth, potion-of-heroism, potion-of-invisibility, potion-of-mind-reading,
potion-of-poison, potion-of-speed, potion-of-water-breathing, potters-tools, pouch, priests-pack,
quarterstaff, quiver, ram-portable, rapier, reliquary, ring-mail, ring-of-animal-influence,
ring-of-djinni-summoning, ring-of-evasion, ring-of-feather-falling, ring-of-free-action,
ring-of-invisibility, ring-of-jumping, ring-of-mind-shielding, ring-of-protection,
ring-of-regeneration, ring-of-shooting-stars, ring-of-spell-storing, ring-of-spell-turning,
ring-of-swimming, ring-of-telekinesis, ring-of-the-ram, ring-of-three-wishes, ring-of-warmth,
ring-of-water-walking, ring-of-x-ray-vision, robe-of-eyes, robe-of-scintillating-colors,
robe-of-stars, robe-of-the-archmagi, robe-of-useful-items, rod, rod-of-absorption,
rod-of-alertness, rod-of-lordly-might, rod-of-rulership, rod-of-security, rope-of-climbing,
rope-of-entanglement, rowboat, sack, saddle-exotic, saddle-military, saddle-riding, sailing-ship,
scale-mail, scarab-of-protection, scholars-pack, scimitar, scimitar-of-speed, shawm, shield,
shield-of-missile-attraction, shortbow, shortsword, shovel, sickle, signal-whistle, sled, sling,
slippers-of-spider-climbing, smiths-tools, sovereign-glue, spear, spell-scroll-cantrip,
spellbook, spellguard-shield, sphere-of-annihilation, splint-armor, sprig-of-mistletoe, spyglass,
staff, staff-of-charming, staff-of-fire, staff-of-frost, staff-of-healing, staff-of-power,
staff-of-striking, staff-of-swarming-insects, staff-of-the-magi, staff-of-the-python,
staff-of-the-woodlands, staff-of-thunder-and-lightning, staff-of-withering,
stone-of-controlling-earth-elementals, stone-of-good-luck-luckstone, studded-leather-armor,
sun-blade, sword-of-life-stealing, sword-of-sharpness, sword-of-wounding, talisman-of-pure-good,
talisman-of-the-sphere, talisman-of-ultimate-evil, thieves-tools, tinderbox, tinkers-tools,
tome-of-clear-thought, tome-of-leadership-and-influence, tome-of-understanding, torch, trident,
trident-of-fish-command, universal-solvent, vial, vicious-weapon, viol, vorpal-sword, wagon,
wand, wand-of-binding, wand-of-enemy-detection, wand-of-fear, wand-of-fireballs,
wand-of-lightning-bolts, wand-of-magic-detection, wand-of-magic-missiles, wand-of-paralysis,
wand-of-polymorph, wand-of-secrets, wand-of-the-war-mage-1, wand-of-the-war-mage-2,
wand-of-the-war-mage-3, wand-of-web, wand-of-wonder, war-pick, warhammer, warhorse, warship,
waterskin, weapon-1, weapon-2, weapon-3, weavers-tools, well-of-many-worlds, whip, wind-fan,
winged-boots, wings-of-flying, woodcarvers-tools, yew-wand
```

Only the 2014 rules (`srd51`) (193):

```text
abacus, acid-vial, alchemists-fire-flask, alms-box, animal-feed-1-day, antitoxin-vial, arrow,
arrow-of-slaying, bag-of-tricks-gray, bag-of-tricks-rust, bag-of-tricks-tan,
ball-bearings-bag-of-1000, barding-breastplate, barding-chain-mail, barding-chain-shirt,
barding-half-plate, barding-hide, barding-leather, barding-padded, barding-plate,
barding-ring-mail, barding-scale-mail, barding-splint, barding-studded-leather,
belt-of-giant-strength-cloud, belt-of-giant-strength-fire, belt-of-giant-strength-frost,
belt-of-giant-strength-hill, belt-of-giant-strength-stone, belt-of-giant-strength-storm,
bit-and-bridle, block-of-incense, blowgun-needle, carpet-of-flying-3x5, carpet-of-flying-4x6,
carpet-of-flying-5x7, carpet-of-flying-6x9, cartographers-tools, censer, chain-10-feet,
chalk-1-piece, clothes-common, clothes-costume, crossbow-bolt, crossbow-hand, crossbow-heavy,
crossbow-light, deck-of-many-things, dice-set, diplomats-pack, donkey, dragon-scale-mail-black,
dragon-scale-mail-blue, dragon-scale-mail-brass, dragon-scale-mail-bronze,
dragon-scale-mail-copper, dragon-scale-mail-gold, dragon-scale-mail-green, dragon-scale-mail-red,
dragon-scale-mail-silver, dragon-scale-mail-white, dungeoneers-pack, elemental-gem-air,
elemental-gem-earth, elemental-gem-fire, elemental-gem-water, feather-token-anchor,
feather-token-bird, feather-token-fan, feather-token-swan-boat, feather-token-tree,
feather-token-whip, figurine-of-wondrous-power-bronze-griffon,
figurine-of-wondrous-power-ebony-fly, figurine-of-wondrous-power-golden-lions,
figurine-of-wondrous-power-ivory-goats, figurine-of-wondrous-power-marble-elephant,
figurine-of-wondrous-power-obsidian-steed, figurine-of-wondrous-power-onyx-dog,
figurine-of-wondrous-power-serpentine-owl, figurine-of-wondrous-power-silver-raven,
fishing-tackle, flask-or-tankard, glamoured-studded-leather-armor, hammer, hammer-sledge,
holy-water-flask, horn-of-valhalla-brass, horn-of-valhalla-bronze, horn-of-valhalla-iron,
horn-of-valhalla-silver, horse-draft, horse-riding, hourglass, ink-1-ounce-bottle,
ioun-stone-of-absorption, ioun-stone-of-agility, ioun-stone-of-awareness,
ioun-stone-of-fortitude, ioun-stone-of-greater-absorption, ioun-stone-of-insight,
ioun-stone-of-intellect, ioun-stone-of-leadership, ioun-stone-of-mastery,
ioun-stone-of-protection, ioun-stone-of-regeneration, ioun-stone-of-reserve,
ioun-stone-of-strength, ioun-stone-of-sustenance, iron-bands-of-binding, jug-or-pitcher,
ladder-10-foot, little-bag-of-sand, manual-of-golems-clay, manual-of-golems-flesh,
manual-of-golems-iron, manual-of-golems-stone, mess-kit, mirror-steel, oil-flask,
orb-of-dragonkind, paper-one-sheet, parchment-one-sheet, perfume-vial, pick-miners, piton,
playing-card-set, poison-basic-vial, pole-10-foot, potion-of-giant-strength-cloud,
potion-of-giant-strength-fire, potion-of-giant-strength-frost, potion-of-giant-strength-hill,
potion-of-giant-strength-stone, potion-of-giant-strength-storm, potion-of-healing-common,
potion-of-healing-greater, potion-of-healing-superior, potion-of-healing-supreme,
potion-of-resistance-acid, potion-of-resistance-cold, potion-of-resistance-fire,
potion-of-resistance-force, potion-of-resistance-lightning, potion-of-resistance-necrotic,
potion-of-resistance-poison, potion-of-resistance-psychic, potion-of-resistance-radiant,
potion-of-resistance-thunder, rations-1-day, restorative-ointment, ring-of-elemental-command-air,
ring-of-elemental-command-earth, ring-of-elemental-command-fire, ring-of-elemental-command-water,
ring-of-resistance-acid, ring-of-resistance-cold, ring-of-resistance-fire,
ring-of-resistance-force, ring-of-resistance-lightning, ring-of-resistance-necrotic,
ring-of-resistance-poison, ring-of-resistance-psychic, ring-of-resistance-radiant,
ring-of-resistance-thunder, robes, rope-hempen-50-feet, rope-silk-50-feet, saddle-pack,
saddlebags, scale-merchants, sealing-wax, signet-ring, sling-bullet, small-knife, soap,
spell-scroll-1st, spell-scroll-2nd, spell-scroll-3rd, spell-scroll-4th, spell-scroll-5th,
spell-scroll-6th, spell-scroll-7th, spell-scroll-8th, spell-scroll-9th, spike-iron,
stabling-1-day, string-10-feet, tent-two-person, totem, vestments, whetstone, wooden-staff
```

Only the 2024 rules (`srd52`) (106):

```text
acid, airship, alchemists-fire, ammunition-of-slaying, antitoxin, arrows, assassins-blood,
bag-of-tricks, ball-bearings, bead-of-nourishment, belt-of-giant-strength, bolts,
bullets-firearm, bullets-sling, burnt-othur-fumes, carpet-of-flying, cartographer-tools, chain,
cloak-of-invisibility, costume, crawler-mucus, crystal-ball, dice, diplomat-pack, draft-horse,
dragon-orb, dragon-scale-mail, dragonchess, dungeoneer-pack, elemental-gem, elixir-of-health,
energy-bow, essence-of-ether, feather-token, feed-per-day, figurine-of-wondrous-power, flask,
glamoured-studded-leather, gloves-of-thievery, hand-crossbow, hat-of-many-spells, heavy-crossbow,
holy-water, horn-of-valhalla-1, horn-of-valhalla-2, horn-of-valhalla-3, horn-of-valhalla-4, ink,
ioun-stone, iron-bands, jug, ladder, light-crossbow, malice, manual-of-golems, map,
midnight-tears, mirror, musket, mysterious-deck, needles, oil, oil-of-taggit, pale-tincture,
paper, parchment, perfume, pistol, playing-cards, poison-basic, pole, potion-of-giant-strength,
potion-of-healing, potion-of-invulnerability, potion-of-longevity, potion-of-resistance,
potion-of-vitality, potions-of-healing, purple-worm-poison, quarterstaff-of-the-acrobat, rations,
riding-horse, ring-of-elemental-command, ring-of-resistance, robe, rod-of-resurrection, rope,
sending-stones, sentinel-shield, serpent-venom, shield-1, shield-2, shield-3,
shield-of-the-cavalier, spell-scroll, spell-scroll-level-1, spiders-sting, spikes-iron, string,
tent, three-dragon-ante, thunderous-greatclub, torpor, truth-serum, weapon-of-warning,
wyvern-poison
```

<!-- /generated:reference -->
