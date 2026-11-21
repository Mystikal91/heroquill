import { effect, signal } from "@preact/signals";

/** Which screen is showing: the tabs, or one of the pages (credits, content packs). */
export type View =
  | "build"
  | "sheet"
  | "play"
  | "rules"
  | "print"
  | "credits"
  | "packs"
  | "homebrew"
  | "homebrewPrint"
  | "translate"
  | "dm"
  | "about";
export type Tab = "build" | "sheet" | "play" | "rules" | "print";

const STORAGE_KEY = "tab";

/** The tab to reopen on the next visit. Print is never reopened: it is a one-off action. */
function savedTab(): "build" | "sheet" | "play" {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "sheet" || saved === "play" ? saved : "build";
  } catch {
    return "build";
  }
}

export const view = signal<View>(savedTab());

export const isPage = (v: View) =>
  v === "credits" ||
  v === "packs" ||
  v === "homebrew" ||
  v === "homebrewPrint" ||
  v === "translate" ||
  v === "dm" ||
  v === "about";

/** The tab to go back to when leaving a page. */
let lastTab: Tab = isPage(view.value) ? "build" : (view.value as Tab);

export function showView(next: View) {
  if (!isPage(next)) lastTab = next as Tab;
  view.value = next;
}

/** Leaves the credits or packs page, back to the tab that was open. */
export function leavePage() {
  view.value = lastTab;
}

effect(() => {
  if (view.value !== "build" && view.value !== "sheet" && view.value !== "play") return;
  try {
    localStorage.setItem(STORAGE_KEY, view.value);
  } catch {
    // Ignore: the tab just won't be remembered.
  }
});
