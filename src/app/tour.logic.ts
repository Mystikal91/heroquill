import type { View } from "./navigation";

/** One stop of the guided tour: where to be, and what to point at. */
export interface TourStep {
  id: string;
  /** The tab to show for this stop; the tour stays where it is when there is none. */
  view?: View;
  /**
   * What to light up: a CSS selector, or several separated by commas (the first one that is on
   * screen wins, since the summary is at the side on a wide screen and on top on a phone). A stop
   * with no target is a card in the middle of the screen.
   */
  target?: string;
  /** A closed section (a `details`) to open, so that its target can be seen. */
  open?: string;
}

/** The stops, in order. Their texts are `tour.<id>.title` and `tour.<id>.body`. */
export const TOUR_STEPS: readonly TourStep[] = [
  { id: "welcome", view: "build" },
  { id: "characters", view: "build", target: ".bar" },
  { id: "more", view: "build", target: ".bar-row .popover-button" },
  { id: "tabs", view: "build", target: ".tabs" },
  { id: "build", view: "build", target: "#step-head-origin" },
  { id: "summary", view: "build", target: ".summary, .summary-strip" },
  { id: "sheet", view: "sheet", target: ".sheet-header" },
  { id: "play", view: "play", target: ".play-head, .hp-readout" },
  { id: "rules", view: "rules", target: ".rules-top" },
  { id: "print", view: "print", target: ".print-toolbar" },
  { id: "menu", target: ".app-menu .popover-button" },
  { id: "packs", view: "packs", target: '[data-tour="aurora"]' },
  {
    id: "translate",
    view: "translate",
    target: '[data-tour="deepl"]',
    open: '[data-tour="deepl"]',
  },
  { id: "end", view: "build" },
];

/** The stop after `index`, or undefined at the end. */
export const stepAfter = (index: number): number | undefined =>
  index + 1 < TOUR_STEPS.length ? index + 1 : undefined;

/** The stop before `index`, or undefined at the start. */
export const stepBefore = (index: number): number | undefined =>
  index > 0 ? index - 1 : undefined;

/** The part of a rectangle that is on the screen, with some room around it. */
export interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function spotAround(rect: Box, screen: { width: number; height: number }, margin = 6): Box {
  const left = Math.max(0, rect.left - margin);
  const top = Math.max(0, rect.top - margin);
  const right = Math.min(screen.width, rect.left + rect.width + margin);
  const bottom = Math.min(screen.height, rect.top + rect.height + margin);
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** True when the lit area is in the upper half of the screen, so the card goes to the lower one. */
export const cardGoesBelow = (spot: Box, screenHeight: number): boolean =>
  spot.top + spot.height / 2 < screenHeight / 2;
