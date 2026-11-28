import { computed, effect, signal } from "@preact/signals";

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
  | "about"
  | "houseRules";
export type Tab = "build" | "sheet" | "play" | "rules" | "print";

const STORAGE_KEY = "tab";
const MODE_KEY = "mode";

/** The tab to reopen on the next visit. Print is never reopened: it is a one-off action. */
function savedTab(): "build" | "sheet" | "play" {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "sheet" || saved === "play" ? saved : "build";
  } catch {
    return "build";
  }
}

/** Whether the app was last used as the Dungeon Master: it opens there again. */
function savedMaster(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "master";
  } catch {
    return false;
  }
}

export const view = signal<View>(savedMaster() ? "dm" : savedTab());

export const isPage = (v: View) =>
  v === "credits" ||
  v === "packs" ||
  v === "homebrew" ||
  v === "homebrewPrint" ||
  v === "translate" ||
  v === "dm" ||
  v === "about" ||
  v === "houseRules";

/** The tab to go back to when leaving a page, or when the player side is chosen again. */
let lastTab: Tab = savedTab();
/** Where a page goes back to: the tab, or the Dungeon Master's screen. */
let lastHome: Tab | "dm" = view.value === "dm" ? "dm" : lastTab;

export function showView(next: View) {
  if (!isPage(next)) lastTab = next as Tab;
  if (!isPage(next) || next === "dm") lastHome = next as Tab | "dm";
  view.value = next;
}

/** Leaves a page such as the credits, back to the tab or the Dungeon Master's screen that was open. */
export function leavePage() {
  view.value = lastHome;
}

/** The two ways of using the app: playing a character, or running the game as the Dungeon Master. */
export type Mode = "player" | "master";

export const mode = computed<Mode>(() => (view.value === "dm" ? "master" : "player"));

export function setMode(next: Mode) {
  if (next === mode.value) return;
  showView(next === "master" ? "dm" : lastTab);
}

effect(() => {
  if (view.value !== "build" && view.value !== "sheet" && view.value !== "play") return;
  try {
    localStorage.setItem(STORAGE_KEY, view.value);
  } catch {
    // Ignore: the tab just won't be remembered.
  }
});

effect(() => {
  const v = view.value;
  // Only the two homes say which side is in use: a page such as the credits leaves it as it was.
  if (isPage(v) && v !== "dm") return;
  try {
    localStorage.setItem(MODE_KEY, v === "dm" ? "master" : "player");
  } catch {
    // Ignore: the app opens on the player side.
  }
});
