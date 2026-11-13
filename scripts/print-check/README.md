# Print check

Prints the Print tab of the example character with a real Chrome (DevTools protocol) and a real
Firefox (Marionette), with and without background graphics, in a dark or light colour set, and
renders the pages to PNG. It shows what the browsers' own print dialogs would give.

```bash
npm run dev                                   # in another terminal
mkdir -p out
node scripts/print-check/chrome.mjs out Scura   # chrome-Scura-bg.pdf, chrome-Scura-nobg.pdf
node scripts/print-check/firefox.mjs out Scura  # firefox-Scura-bg.pdf, firefox-Scura-nobg.pdf
python scripts/print-check/render.py out        # out/<name>-<page>.png
```

`STRESS=6 node scripts/print-check/chrome.mjs out Scura` copies the last row of the spell list six
times to see how the front page copes with a long list. The browser paths are the usual ones on
Windows; change them at the top of the scripts.

## The pages of the test characters (`pages.ts`, `npm run test:print`)

Prints the Print tab of about fifty characters (every 2014 class at levels 1, 9 and 20, some 2024 ones, and a
few with every option ticked: cards, all the spells) with a real Chrome and checks, for each one:

1. the **number of pages** against `pages.baseline.json` (`pages`);
2. that no block the print CSS wants whole (`break-inside: avoid`: a feature, a spell, a card) has its first
   words on one page and its last on another;
3. that the **front page and the story page** are each on one page: every line of them is on the same page of
   the PDF. This is the check that finds a front page that spills over (a column that does not fit moves its
   last block to the next page).

```bash
npm run build                       # it serves dist/ itself; or PRINT_URL=http://localhost:5173/app/ with npm run dev
npm run test:print                  # all of them, about two minutes
ONLY="wizard 20" npm run test:print # the characters whose name has the words
KEEP=out npm run test:print         # also keep each PDF in out/ to look at it
ACCEPT=1 npm run test:print         # write the baseline (after looking at the PDFs)
```

**When the front page is too full** even at its densest, panels of its right column leave for a page of their own,
"Sheet, continued" (`FrontMore`): first the limited uses, then the species traits and feats, then the class
features (`fitFront`, `frontSpill`). The fitting leaves 9 mm to spare, because the printed page comes out taller than
the screen shows it: a front that fits on screen by a few millimetres lost its last block to a second page in the
PDF (this test found it in a level 20 Paladin).

A page count that changes is a decision: look at the PDFs (`KEEP`), then `ACCEPT=1`. `known` in the baseline lists
what is wrong today and is not fixed yet (a front page that does not fit): it is shown, it does not fail, and
when one is fixed the check fails until its line is removed (`ACCEPT=1`). A page that does not load is tried three
times before it counts.

Only Chrome (the path is found by itself, or set `CHROME`): Firefox prints differently, see the first part. The
page counts depend on the Chrome version; if the CI image gets a new one and numbers move with no change of ours,
look at one PDF first.
