# Heroquill

### A free D&D 5e character creator: build, play and print your character

**[heroquill.app](https://heroquill.app/)** · [Open the app](https://heroquill.app/app/) · [Try it with a ready-made character](https://heroquill.app/app/#example) · [How to create a D&D 5e character (guide)](https://heroquill.app/guide/)

Heroquill is a free, offline-first web app to **build, level up, play and print Dungeons & Dragons
5th edition characters** with the SRD 5.1 rules. No server, no account, no tracking: your characters
stay on your device, and the app works without a connection once it has been opened. It speaks
English, Italian, French, German and Spanish, and it reads the content files made for Aurora Builder
and Aurora Legacy that you already own.

> **Version 1.0 beta.** It works, but it needs more testing, so some numbers may be wrong in
> places. If something looks off, please [open an issue](https://github.com/Mystikal91/heroquill/issues).
> What is still missing is on the roadmap, inside the app (click the title).
>
> A note on how it was made: a lot of this project was written with the help of an AI assistant
> (Claude). It is a hobby project, made for fun and for my own table.

## What it does

**Build**

- A guided flow: species and subspecies, class and subclass, background, ability scores (standard
  array, point buy, rolled or manual), skills and other choices, spells, equipment and story.
- *Free edit*: override any number the rules would work out, and see what the automatic value
  would be.
- **Multiclassing** with the shared spell slots table, separate Pact Magic slots and the ability
  score prerequisites; **feats** in place of ability score improvements. Options that ask for
  something (an invocation's level, pact or cantrip; a feat's scores) say so and stay locked until
  the character has it.
- **Level up**, from the Create or Play tabs: choose the class and the hit points, see exactly what
  changes, then jump to whatever is left to decide (subclass, ability scores, spells, choices).
  With a small celebration. The classes you do not have yet wait behind an *Add a new class* button,
  and only the ones whose minimum scores you meet are offered.
- **Starting equipment, guided**: the Equipment step asks each choice the rules give your class and
  background (this or that, a martial weapon, an arcane focus...) and adds it all to the inventory with
  one button. Features that improve with the level (Brutal Critical, Extra Attack, Bardic Inspiration...)
  show only their latest step, and the Ability Score Improvement features stay off the sheet unless
  you ask for them.
- **Install it** like an app: a discreet strip offers it after a few seconds (Install, Later for a
  week, No thanks to stop), the menu has an *Install the app* entry, and on an iPhone or iPad it shows
  the steps of Safari.

**Play**

- Hit points, temporary hit points, death saves, hit dice, short and long rests.
- A *Change prepared* button for the classes that prepare spells (cleric, druid, paladin, wizard),
  also offered after a long rest.
- Spell slots, Pact Magic, concentration (with the save to keep it), class resources (rage, ki,
  Channel Divinity, Bardic Inspiration...) and the numbers that matter at the table.
- Quick rolls for checks, saves, attacks and damage, with advantage and critical hits, a dice
  tray and a roll history. Conditions with their rules.
- Effects you switch on from a weapon's attack card (Shillelagh, Magic Weapon) until the next rest;
  spells cast at will, such as the warlock's invocations, are listed with the cantrips.
- Damage with *Resistant (x1/2)* and *Vulnerable (x2)* buttons, for the character and the companions;
  rounds left for conditions, concentration and rage, with a *Next round* button that ends what runs out.
- The unarmed strike for whoever holds no weapon, and for the monk always: martial arts die,
  Dexterity, Flurry of Blows, and the monk's weapons with the same die. The claws, bite, horns,
  hooves and talons of the species of the official books (Tabaxi, Tortle, Lizardfolk, Minotaur,
  Centaur, Satyr, Aarakocra, Leonin) give it their own die and damage, even with a weapon in hand.
- Quick numbers: a strip under the tabs on a wide screen (armor class as a crest, initiative, speed,
  passive Perception, proficiency, martial and spell save DCs) and, on a phone, a button that opens a
  window with all of them. Each one can be tapped to see how it adds up.
- Class features that are played, not only read: Sacred Weapon, the Life domain's healing and
  Divine Strike, a sorcerer's Flexible Casting (slots from points and back).
- Items and coins at the table: one *Add* window (in Create, on the Sheet and in Play) with search
  as you type, chips by sort of item, the last items added, counts ("2 potions"), items of your
  own, what a potion heals and the price when the book gives one, and a *Buy* button that pays
  from the coins. *Spend* works out the coins to hand over and gives change in the biggest coins;
  *Gain* adds some. The potions of healing heal when used.

**Print and share**

- A character sheet, spell sheets and spell cards, for paper or PDF.
- Share a character as a **link, a QR code or a file**; a shared link opens the character on
  another device.

**Content**

- The whole SRD 5.1: classes, subclasses, species, backgrounds, spells, equipment and features.
- **Content packs** (footer, *Content packs*):
  - a **homebrew editor** for spells, weapons, armor, gear, properties, languages, feats, species,
    backgrounds, classes and subclasses, with export and import of your packs; weapons and armor
    can also be customized from the inventory (*Customize*);
  - an importer for **Aurora** XML files that you already have, by file, by index file (every file
    it lists is fetched) or by address. Nothing from Aurora or any publisher is bundled.
  - see [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md).

**Languages and look**

- English, Italian, French, German and Spanish, with the **official SRD translations** (about 94%
  of the rules texts). Missing texts show in English; translations are managed with Weblate (see
  [docs/TRANSLATING.md](docs/TRANSLATING.md)).
- **Automatic translation** (footer): with your own DeepL key, texts that have no translation yet
  (and the English content you imported) are translated as you read them (the casting time and the
  duration of an imported spell are translated without it), marked as such, with a
  button for the original. Translations are cached on your device. DeepL does not accept calls
  from web pages, so requests go through a small relay; see
  [docs/TRANSLATION_PROXY.md](docs/TRANSLATION_PROXY.md) to run your own.
- Eight **colour sets** (Night and gold, Classic, Bordeaux, Forest, Arcane, Ice, Copper, Obsidian), each light and dark (or automatic), and **feet or meters** (automatic by language). The look is the Fantasy one: parchment, ink and framed panels.

## Development

```bash
npm install
npm run dev        # start the dev server
npm test           # unit tests
npm run lint       # Biome lint + format check
npm run format     # fix what Biome can
npm run typecheck  # TypeScript
npm run build      # type-check and production build into dist/
```

Node 20+ is required (the PWA build step fails on older versions); Node 22 is used in CI. The
site is published to Cloudflare (Workers static assets, `wrangler.jsonc`) by the workflow in
`.github/workflows/`: the welcome page and the legal pages are in `site/`, the app is built into
`dist/app/`, and `npm run build` makes one plain page per language of the welcome page (`site/`, with the
texts in `site/texts.mjs`), the guide (`site/guide.mjs`) and the news page, made from the changelog and the
roadmap of `src/content/news.ts`, with a sitemap, the data for search engines and `changelog.json`, which the
app reads to tell what an update brings.

| Command | What it does |
|---------|--------------|
| `npm run data:srd51` | Rebuilds `data/srd51/` and `locales/en/srd51/` from the pinned 5e-database source |

The scripts in `scripts/srd-translations/` (Python, PyMuPDF) import the official SRD
translations from their PDFs into `locales/`; see [docs/TRANSLATING.md](docs/TRANSLATING.md).

### Project layout

| Path | Purpose |
|------|---------|
| `src/engine/` | Rules engine: pure TypeScript, no UI dependencies (derived sheet, multiclass, level up, play state, spells) |
| `src/data/` | Schemas of the content packs and of class progression |
| `src/content/` | Loading the packs and their texts; the roadmap and changelog |
| `src/import/aurora/` | The Aurora XML reader |
| `src/homebrew/` | The homebrew editor's model (forms to pack entries and back) |
| `src/translate/` | Automatic translation: DeepL client, cache and queue |
| `src/storage/` | IndexedDB: characters, packs, saved translations; sharing links |
| `src/app/` | App state (signals): character, navigation, language, theme, units |
| `src/ui/` | Preact components and styles |
| `data/srd51/`, `locales/` | The SRD 5.1 content and its texts, by language |
| `workers/translate-proxy/` | The Cloudflare Worker that relays DeepL requests |
| `docs/` | Guides: translating, content packs, the translation relay |

The stack is Vite, Preact with signals, strict TypeScript, valibot, Biome, Vitest and
vite-plugin-pwa.

## Contributing

Code, translations ([Weblate](https://weblate.mystikal.it/projects/heroquill/)), bug reports and
a hello are all welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/Mystikal91/heroquill/discussions).

## Versions and changelog

The version and its stage (`beta`) are in `src/app/version.ts`. What changed in each version is
listed in `src/content/news.ts` (`CHANGELOG`, newest first: write the lines in English and, if
possible, in the other languages) next to the `ROADMAP` of what is still missing. Both show in
the app, under the title.

## Credits and licenses

- Code: [MIT](LICENSE).
- Game data and translations: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), derived
  from the System Reference Document 5.1 by Wizards of the Coast LLC, including its official
  Italian, French, German and Spanish translations. The full attribution is in the app (footer,
  *Credits and licenses*) and in `data/srd51/NOTICE.md`.
- The sheet layout is inspired by the character sheets of Emmet Byrne; no artwork or text of
  his is used.

This is an unofficial fan project, not affiliated with or endorsed by Wizards of the Coast.
