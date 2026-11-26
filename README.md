# Heroquill

### A free D&D 5e character creator: build, play and print your character, and run the fight as the DM

**[heroquill.app](https://heroquill.app/)** · [Open the app](https://heroquill.app/app/) · [Try it with a ready-made character](https://heroquill.app/app/#example) · [How to create a D&D 5e character (guide)](https://heroquill.app/guide/)

Heroquill is a free, offline-first web app to **build, level up, play and print Dungeons & Dragons
5th edition characters** with the SRD 5.1 rules (2014) or the SRD 5.2.1 rules (2024), chosen for each
character, and, on its **DM side**, to run encounters with an initiative tracker and an optional
online table for the players. No account, no tracking: your characters, campaigns and encounters
stay on your device, and the app works without a connection once it has been opened (the online
table goes through a small relay that keeps nothing for more than twelve hours). It speaks
English, Italian, French, German and Spanish, and it reads the content files made for Aurora Builder
and Aurora Legacy that you already own.

> If something looks off, a number does not add up or a text is missing, please
> [open an issue](https://github.com/Mystikal91/heroquill/issues). What is still missing is on the
> roadmap, inside the app (click the title).
>
> A note on how it was made: a lot of this project was written with the help of an AI assistant
> (Claude). It is a hobby project, made for fun and for my own table.

## What it does

**Build**

- A guided flow in a few steps: the rules (2014 or 2024, chosen once), species, class, ability scores (standard array, point buy, rolled or
  manual) and background, each with a short hint, while a card of the character fills in beside them.
  Then the sheet is ready to play; choices, spells, equipment, story and features are optional cards
  to refine whenever you like. *Assign for me* places the scores where the class needs them, and
  *Choose for me* fills the open picks and the spells with the ones that suit the character.
- *Free edit*: override any number the rules would work out, and see what the automatic value
  would be.
- **Multiclassing** with the shared spell slots table, separate Pact Magic slots and the ability
  score prerequisites; **feats** in place of ability score improvements. Options that ask for
  something (an invocation's level, pact or cantrip; a feat's scores) say so and stay locked until
  the character has it.
- **Level up**, from the top of the Sheet or from Create: choose the class and the hit points, see
  exactly what changes, then jump to whatever is left to decide (subclass, ability scores, spells,
  choices).
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
- Casting says what it spends, with an undo, and asks before a slot of another level; free uses and
  rituals have their place, and a spell that cannot be paid for has its button off.
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

**Run the game (DM mode)**

A Player / DM switch in the header (in the ☰ menu on a phone) turns the app into the Dungeon Master's
side; the welcome screen offers both.

- **Campaigns** with their party and **encounters** ready to reuse: the SRD monsters, creatures entered by hand and the party's characters.
- An **initiative tracker**: rolled or typed initiative, turns and rounds, hit points with damage and
  healing (resistant, vulnerable, temporary), conditions and effects that count their rounds, groups
  of the same monster, and the creature in turn beside the table with its actions.
- **Saved effects and environment effects**: effects written by hand can be saved for every fight of every
  campaign; the lair carries environment effects (damage, a saving throw, a condition) through its
  rounds, and applies them to whoever is inside.
- **Monster rolls**: pick the targets, roll the attack against their armor class and the damage
  with their defenses, or an area with half damage on a save; checks and saves for every creature,
  and the DM's own dice.
- An **online table** (optional): the DM opens it and gives a short code; players join from their
  own Heroquill. The DM sees their hit points, armor class, conditions and rolls, asks for initiative
  or a roll with a DC, and proposes damage, conditions and effects that the player accepts on their
  own sheet (the DM never changes it). Lines of text go both ways. Players see the order of the fight
  and whose turn it is, and the environment effects the DM shows; the DM chooses how much they see of the monsters. No account: the relay
  (`workers/room-relay/`, a Cloudflare Durable Object) passes messages, keeps only the seats, the
  last card of each player and the last order (with the effects shown), and deletes the table when the DM closes it or after
  twelve hours without messages. See the [privacy policy](https://heroquill.app/privacy).

**Print and share**

- A character sheet, spell sheets and spell cards, for paper or PDF.
- A **fillable PDF**: the same pages with the numbers, names, boxes to tick and notes as form
  fields that any PDF reader can change; and a **blank sheet** with every page (spell pages
  included) to fill by hand or on a computer.
- Share a character as a **link, a QR code or a file**; a shared link opens the character on
  another device.

**Content**

- The whole SRD 5.1: classes, subclasses, species, backgrounds, spells, equipment and features.
- The SRD 5.2.1 (the 2024 rules), next to it: classes and subclasses, species, backgrounds, feats, spells,
  equipment (with mounts, vehicles and poisons), magic items, monsters, alignments and the new rules
  (weapon mastery, Divine and Primal Order, Heroic Inspiration, Exhaustion). A character follows the
  edition chosen when it was made; content from Aurora is 2014 rules and works with both (see
  [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md)).
- **Content packs** (footer, *Content packs*):
  - the **Homebrew studio**, an editor for spells, weapons, armor, gear, properties, languages, feats, species,
    backgrounds, classes and subclasses, with export and import of your packs; weapons and armor
    can also be customized from the inventory (*Customize*);
  - an importer for **Aurora** XML files that you already have, by file, by index file (every file
    it lists is fetched) or by address. Nothing from Aurora or any publisher is bundled.
  - see [docs/CONTENT_PACKS.md](docs/CONTENT_PACKS.md).

**Languages and look**

- English, Italian, French, German and Spanish, with the **official SRD translations** (about 94%
  of the 5.1 rules texts; the 5.2.1 texts are complete in all four languages, partly written by hand and still to be read against the books). Missing texts show in English; translations are managed with Weblate (see
  [docs/TRANSLATING.md](docs/TRANSLATING.md)).
- **Automatic translation** (footer, off by default): texts that have no translation yet (and the
  English content you imported) are translated as you read them, marked as such, with a button for
  the original: with your own DeepL key, or else with the free translation of our relay or MyMemory
  (the casting time and the duration of an imported spell are translated without any of them).
  Translations are cached on your device. DeepL does not accept calls from web pages, so requests go
  through a small relay; see [docs/TRANSLATION_PROXY.md](docs/TRANSLATION_PROXY.md) to run your own.
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
npm run relay:dev  # the online table's relay, locally (wrangler), on port 8787
npm run relay:spike # a scripted table against the local relay
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
| `npm run data:srd52` | Rebuilds `data/srd52/` and `locales/en/srd52/` from the pinned source of the 2024 rules and `scripts/srd52/supplement/` |

The scripts in `scripts/srd-translations/` (Python, PyMuPDF) import the official SRD
translations from their PDFs into `locales/`; see [docs/TRANSLATING.md](docs/TRANSLATING.md).

### Project layout

| Path | Purpose |
|------|---------|
| `src/engine/` | Rules engine: pure TypeScript, no UI dependencies (derived sheet, multiclass, level up, play state, spells) |
| `src/data/` | Schemas of the content packs and of class progression |
| `src/content/` | Loading the packs and their texts; the roadmap and changelog |
| `src/import/aurora/` | The Aurora XML reader |
| `src/homebrew/` | The Homebrew studio's model (forms to pack entries and back) |
| `src/translate/` | Automatic translation: DeepL client, cache and queue |
| `src/storage/` | IndexedDB: characters, packs, campaigns, encounters, saved translations; sharing links |
| `src/app/` | App state (signals): character, navigation, language, theme, units, the DM side |
| `src/relay/` | The online table: message protocol, the room's rules, the client with reconnection |
| `src/ui/` | Preact components and styles (`src/ui/dm/` is the DM side, loaded only when opened) |
| `data/srd51/`, `data/srd52/`, `locales/` | The SRD 5.1 and 5.2.1 content and its texts, by language |
| `workers/translate-proxy/` | The Cloudflare Worker that relays DeepL requests |
| `workers/room-relay/` | The Cloudflare Worker and Durable Object of the online table |
| `docs/` | Guides: translating, content packs, the translation relay |

The stack is Vite, Preact with signals, strict TypeScript, valibot, Biome, Vitest and
vite-plugin-pwa.

## Contributing

Code, translations ([Weblate](https://weblate.mystikal.it/projects/heroquill/)), bug reports and
a hello are all welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Questions and ideas go in
[Discussions](https://github.com/Mystikal91/heroquill/discussions), and there is a
[Discord server](https://discord.gg/k6utY79gYs) to chat.

## Versions and changelog

The version is in `src/app/version.ts`. What changed in each version is
listed in `src/content/news.ts` (`CHANGELOG`, newest first: write the lines in English and, if
possible, in the other languages; since 1.35 each line has a `kind`, feature, improvement or fix, shown
as a tag) next to the `ROADMAP` of what is still missing. Both show in
the app, under the title.

## Credits and licenses

- Code: [MIT](LICENSE).
- Game data and translations: [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/), derived
  from the System Reference Document 5.1 and the System Reference Document 5.2.1 by Wizards of the
  Coast LLC, including their official Italian, French, German and Spanish translations. The full attribution is in the app (footer,
  *Credits and licenses*) and in `data/srd51/NOTICE.md` and `data/srd52/NOTICE.md`.
- The sheet layout is inspired by the character sheets of Emmet Byrne; no artwork or text of
  his is used.

This is an unofficial fan project, not affiliated with or endorsed by Wizards of the Coast.
