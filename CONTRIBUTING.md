# Contributing to Heroquill

Thank you for wanting to help. Heroquill is a free D&D 5e character creator, made in spare time,
so small and focused contributions are the easiest to look at.

You do not need to write code to help:

- **Say you like it.** Write in [Discussions](https://github.com/Mystikal91/heroquill/discussions)
  or to hello@heroquill.app, or come to the [Discord server](https://discord.gg/k6utY79gYs).
- **Translate it.** Translations are done in the browser on
  [Weblate](https://weblate.mystikal.it/projects/heroquill/), with no code and no GitHub account
  needed. Weblate sends the changes to this repository as a pull request.
- **Report a problem or suggest something.** Open an
  [issue](https://github.com/Mystikal91/heroquill/issues): what you did, what you
  expected, what happened, and your browser and device. A screenshot or an exported character
  (with nothing private in it) helps a lot.

## Changing the code

```bash
npm install
npm run dev        # start the dev server
npm test           # unit tests
npm run lint       # Biome lint + format check
npm run typecheck  # TypeScript
```

Before opening a pull request, run `npm run lint`, `npm run typecheck` and `npm test`; they are
what the checks on the pull request run too. Then:

1. Keep the change small and about one thing. Open an issue first for anything big.
2. Write the code and comments in English, in the style of the files around it.
3. Add or update a test when the behaviour of the rules, the importer or the sheet changes.
4. Add a line to `CHANGELOG` in `src/content/news.ts` (English, and the other languages if you can).
5. Do not edit the translations in `locales/` by hand for languages other than English: they go
   through Weblate, so they are not overwritten. Texts of the app are added in English in
   `locales/en/ui.json`.

## Rules data

The rules come from the System Reference Document 5.1 (CC-BY-4.0) and are rebuilt with
`npm run data:srd51`; do not edit `data/srd51/` by hand. See
[docs/TRANSLATING.md](docs/TRANSLATING.md) for the official translations.

## Licence

By contributing you agree that your code is released under the [MIT](LICENSE) licence, and your
translations under the same licence as the texts they translate.
