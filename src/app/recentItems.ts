import { signal } from "@preact/signals";
import { rememberRecent } from "../engine/itemSearch";

const KEY = "recentItems";

function load(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];
  } catch {
    return [];
  }
}

/** The items the person added last on this device, the newest first: the picker offers them at the top. */
export const recentItems = signal<string[]>(load());

/** Remembers an item that was just added. */
export function noteRecentItem(id: string) {
  recentItems.value = rememberRecent(recentItems.value, id);
  try {
    localStorage.setItem(KEY, JSON.stringify(recentItems.value));
  } catch {
    // Without storage the list lives until the page closes.
  }
}
