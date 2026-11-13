import { signal } from "@preact/signals";

/**
 * How many panels of the front page's right column have gone to the page that follows it. A front
 * that is too full even at its densest (a level 20 character with many features and uses) used to
 * spill its last blocks onto a second page at the browser's will; now the panels leave in order,
 * the limited uses first, then the species traits and feats, then the class features, and are
 * drawn on a page of their own (`FrontMore`).
 */
export const frontSpill = signal(0);
