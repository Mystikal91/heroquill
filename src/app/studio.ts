import { effect, signal } from "@preact/signals";
import {
  type History,
  canRedo,
  canUndo,
  change,
  redo,
  replacePresent,
  startHistory,
  undo,
} from "../homebrew/history";
import type { UserPackRecord } from "../storage/packs";
import { noteChange } from "./backup";
import { editingPackId } from "./homebrew";
import { addUserPack, userPacks } from "./userPacks";

/**
 * The homebrew studio: the pack that is open is held here while it is worked on, so that every
 * keystroke shows at once (in the preview and the list) and the device is written to a moment after
 * the last one. Rewriting the content of the app on every letter would be far too slow.
 */

export type StudioMode = "guided" | "advanced";
const MODE_KEY = "homebrewMode";

function savedMode(): StudioMode {
  try {
    return localStorage.getItem(MODE_KEY) === "advanced" ? "advanced" : "guided";
  } catch {
    return "guided";
  }
}

/** Guided shows what a beginner needs; advanced shows every control. Remembered between visits. */
export const studioMode = signal<StudioMode>(savedMode());
export function setStudioMode(mode: StudioMode) {
  studioMode.value = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // The choice just is not remembered.
  }
}

const SIDEBAR_KEY = "homebrewSidebar";

/** The left column (packs and their entries) is open, or folded into a narrow strip. Remembered. */
export const sidebarOpen = signal(
  (() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "closed";
    } catch {
      return true;
    }
  })(),
);
export function setSidebarOpen(open: boolean) {
  sidebarOpen.value = open;
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
  } catch {
    // The choice just is not remembered.
  }
}

/** The pack being worked on and what can be undone in it; absent while no pack is open. */
export const history = signal<History<UserPackRecord> | undefined>(undefined);

/** The search, the kind and the order of the list of entries of the open pack. */
export const entrySearch = signal("");
export const entryKind = signal("");
export const entrySort = signal<"name" | "kind">("name");

/** The command palette, the window to start from an existing entry, and the list of keys are open. */
export const paletteOpen = signal(false);
export const startFromOpen = signal(false);
export const helpOpen = signal(false);

/** The language the texts are being written in: undefined for the pack's own, a code for a translation. */
export const studioLanguage = signal<string | undefined>(undefined);

/** The entry open in the editor. */
export const selectedEntry = signal<string | undefined>(undefined);

/** `saved` (on the device), `pending` (a change waits for its turn), `saving`. */
export const saveState = signal<"saved" | "pending" | "saving">("saved");

/** The pack as it is now, with the changes not yet written. */
export const workingPack = (): UserPackRecord | undefined => history.value?.present;

const SAVE_MS = 700;
let timer: ReturnType<typeof setTimeout> | undefined;

async function write() {
  clearTimeout(timer);
  timer = undefined;
  const record = workingPack();
  if (!record) return;
  saveState.value = "saving";
  await addUserPack(record);
  // Something was changed while it was written: that is not saved yet.
  saveState.value = timer ? "pending" : "saved";
}

/** Writes at once what waits, for before leaving the pack or handing it to another editor. */
export async function flushStudio(): Promise<void> {
  if (saveState.value === "pending") await write();
}

function schedule() {
  saveState.value = "pending";
  clearTimeout(timer);
  timer = setTimeout(() => void write(), SAVE_MS);
}

/** Makes a change to the pack. A `key` (entry and field) joins quick changes of one thing into one undo step. */
export function applyChange(next: UserPackRecord, key?: string) {
  const h = history.value;
  if (!h) return;
  const updated = change(h, next, key);
  if (updated === h) return;
  history.value = updated;
  noteChange(updated.present.id);
  schedule();
}

export function undoChange() {
  const h = history.value;
  if (!h || !canUndo(h)) return;
  history.value = undo(h);
  schedule();
}

export function redoChange() {
  const h = history.value;
  if (!h || !canRedo(h)) return;
  history.value = redo(h);
  schedule();
}

/** Opens a pack: its record is taken from the packs of the device, with a clean history. */
export async function openStudioPack(id: string | undefined): Promise<void> {
  await flushStudio();
  const record = id
    ? userPacks.value.find((p) => p.id === id && p.origin === "homebrew")
    : undefined;
  editingPackId.value = record?.id;
  history.value = record ? startHistory(record) : undefined;
  selectedEntry.value = undefined;
  saveState.value = "saved";
}

/**
 * The pack was changed somewhere else (an import, the old forms, another entry point): when
 * nothing here waits to be saved, follow it; and when the pack is gone, close it.
 */
effect(() => {
  const stored = userPacks.value;
  const h = history.peek();
  if (!h) return;
  const here = stored.find((p) => p.id === h.present.id);
  if (!here) {
    history.value = undefined;
    editingPackId.value = undefined;
    selectedEntry.value = undefined;
    return;
  }
  if (here !== h.present && saveState.peek() === "saved") history.value = replacePresent(h, here);
});

/** The entry open in the editor, if it is still there. */
export function currentEntry() {
  const id = selectedEntry.value;
  return id ? workingPack()?.pack.entries.find((e) => e.id === id) : undefined;
}
