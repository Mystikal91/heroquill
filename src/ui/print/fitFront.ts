/**
 * The front page is one page tall. A character with a long spell list or many class features does
 * not fit at the usual size, so the page gets denser, level by level, until every column fits (the
 * levels are `data-density` in print.css). The notes already give way first; this is for the rest.
 */
export const DENSITY_LEVELS = 3;

/**
 * How much room the front is fitted to leave. The browser that prints lays a page out taller than
 * the screen shows it (an ability block of the printed sheet is about a millimetre taller than on
 * screen), and a front that fits by a few millimetres on screen loses its last block to a second
 * page in the PDF: a level 20 Paladin lost its Charisma that way, found by `npm run test:print`.
 * Fitting with this much to spare leaves room for the difference.
 */
export const SPARE = "9mm";

/**
 * The spare room when the question is whether a panel has to leave the front for another page:
 * a millimetre less than none (a column may be that much too tall: it still printed on one page).
 * A page of its own for three lines of limited uses is worse than a front that is tight, so a panel
 * goes only when the front really does not fit at its densest.
 */
export const SPILL_SPARE = "-1mm";

/** True when a column of the front is taller than the room it has. */
const overflows = (page: HTMLElement): boolean =>
  [...page.querySelectorAll<HTMLElement>(".p-col")].some(
    (c) => c.scrollHeight > c.clientHeight + 1,
  );

/** Runs `measure` in a front that is shorter than the page by `spare`. */
function withSpare<T>(page: HTMLElement, spare: string, measure: () => T): T {
  const height = page.style.height;
  page.style.height = `calc(var(--p-page-h) - ${spare})`;
  try {
    return measure();
  } finally {
    page.style.height = height;
  }
}

/** How many panels of the right column may leave the front for another page, at most. */
export const SPILL_STEPS = 3;

/**
 * Makes the front fit its page: it gets denser (`data-density`), and when the densest is not enough
 * a panel of the right column leaves for the page that follows (`data-spill`, one more panel each
 * time: the limited uses, then the traits and feats, then the class features; print.css hides them).
 * A panel leaves only when the front is still more than a few millimetres too full at its densest.
 * Returns what it settled on; the page that follows needs the spill.
 */
export function fitFront(page: HTMLElement): { density: number; spill: number } {
  for (let spill = 0; spill <= SPILL_STEPS; spill++) {
    page.dataset.spill = String(spill);
    const density = withSpare(page, SPARE, () => {
      for (let level = 0; level <= DENSITY_LEVELS; level++) {
        page.dataset.density = String(level);
        if (!overflows(page)) return level;
      }
      return undefined;
    });
    if (density !== undefined) return { density, spill };
    // At the densest it is tight but within what the printer's difference leaves: no panel goes.
    page.dataset.density = String(DENSITY_LEVELS);
    if (withSpare(page, SPILL_SPARE, () => !overflows(page)))
      return { density: DENSITY_LEVELS, spill };
  }
  return { density: DENSITY_LEVELS, spill: SPILL_STEPS };
}
