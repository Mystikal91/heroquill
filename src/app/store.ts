import { computed, effect, signal } from "@preact/signals";
import type { Content } from "../content/browser";
import { applyAbilityMethod } from "../engine/abilityScores";
import {
  type Character,
  chooseRules,
  createCharacter,
  isBlank,
  rulesToChoose,
  withRulesFlag,
} from "../engine/character";
import { CharacterParseError } from "../engine/characterSchema";
import { type DerivedSheet, deriveSheet } from "../engine/derive";
import { relinkCharacter } from "../engine/relink";
import { uuid } from "../engine/uuid";
import { ui } from "../i18n/ui";
import { openTransfer } from "../storage/bundle";
import {
  type CharacterSummary,
  deleteCharacter,
  getCurrentId,
  listCharacters,
  loadCharacter,
  requestPersistence,
  saveCharacter,
  setCurrentId,
} from "../storage/characters";
import { decodeShare, isShareHash } from "../storage/share";
import { parseBackup, parseImportFile } from "../storage/transfer";
import { editionsIn } from "./edition";
import { refreshEncounterCount } from "./encounterCount";
import { EXAMPLE_ID, buildExample } from "./example";
import { houseRules } from "./houseRules";
import { showView, view } from "./navigation";
import { transferDialog, transferInbox } from "./transferState";
import { dismissUndo } from "./undo";

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

/** A blank character whose rules are still to be chosen, that starts with the standard array, the easiest way to assign scores. */
function createNewCharacter(): Character {
  const fresh = createCharacter("srd51");
  fresh.rulesPending = true;
  applyAbilityMethod(fresh, "standard");
  return fresh;
}

export const content = signal<Content | undefined>(undefined);
export const loadError = signal<string | undefined>(undefined);
export const character = signal<Character>(createNewCharacter());
export const characters = signal<CharacterSummary[]>([]);
export const saveStatus = signal<SaveStatus>("idle");
export const importFailed = signal(false);
/** What the last import of a backup did, shown in the character bar. */
export const importNotice = signal<{ added: number; skipped: number; packs?: number } | undefined>(
  undefined,
);

/** The character just deleted, kept for a few seconds so it can be brought back. */
export const deletedCharacter = signal<Character | undefined>(undefined);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
const UNDO_MS = 15000;
/** What happened to a character that arrived in the page link, if one did. */
export const shareNotice = signal<"imported" | "failed" | undefined>(undefined);
/** True once saved characters have been read (or storage turned out to be unavailable). */
export const storageReady = signal(false);

/** The sheet is always derived: it recomputes whenever the character or content changes. */
export const sheet = computed<DerivedSheet | undefined>(() =>
  content.value ? deriveSheet(character.value, content.value.index, houseRules.value) : undefined,
);

/**
 * The sheet to print: always the character's own, never the shape of the beast they are in at the
 * moment. The paper is the character, not the Wild Shape.
 */
export const printSheet = computed<DerivedSheet | undefined>(() => {
  const c = character.value;
  if (!c.play.wildShape || !content.value) return sheet.value;
  return deriveSheet(
    { ...c, play: { ...c.play, wildShape: undefined } },
    content.value.index,
    houseRules.value,
  );
});

/** In the shape of a beast, the Sheet tab can show the beast or the character's own form. */
export const sheetForm = signal<"beast" | "own">("beast");

/**
 * The sheet the Sheet tab shows: the beast's while the druid is in its shape, unless the person
 * asked for their own form. Other screens (Play) always count the shape.
 */
export const shownSheet = computed<DerivedSheet | undefined>(() =>
  view.value === "sheet" && sheetForm.value === "own" ? printSheet.value : sheet.value,
);

/**
 * The same character as if nothing were forced by hand. The Free edit panel shows it next to
 * each field, so the player knows what the automatic value would be.
 */
export const calculated = computed<DerivedSheet | undefined>(() =>
  content.value
    ? deriveSheet({ ...character.value, overrides: {} }, content.value.index, houseRules.value)
    : undefined,
);

/** True when the player forced this value in Free edit. */
export function isForced(key: string): boolean {
  return typeof character.value.overrides[key] === "number";
}

const SAVE_DELAY_MS = 400;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export async function refreshList() {
  characters.value = await listCharacters();
}

/** Writes the current character now, cancelling any pending delayed save. */
export async function saveNow(): Promise<void> {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const current = character.value;
  try {
    await saveCharacter(current);
    await setCurrentId(current.id);
    await refreshList();
    if (saveTimer === undefined) saveStatus.value = "saved";
  } catch (error) {
    console.error("Saving failed", error);
    saveStatus.value = "failed";
  }
}

function scheduleSave() {
  saveStatus.value = "saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void saveNow(), SAVE_DELAY_MS);
}

/** Edits a copy of the character, publishes it, and saves it shortly after. */
export function updateCharacter(edit: (draft: Character) => void) {
  const draft = structuredClone(character.value);
  edit(draft);
  character.value = draft;
  scheduleSave();
}

/** Makes `next` the open character, saving the previous one first if it has unsaved edits. */
async function switchTo(next: Character) {
  if (saveTimer !== undefined) await saveNow();
  character.value = withRulesFlag(next);
  importFailed.value = false;
  await saveNow();
}

/**
 * A character that uses entries of a pack that has another id on this device (the pack was
 * downloaded again after moving to another device) is put right when the content is there.
 */
const openId = computed(() => character.value.id);
effect(() => {
  const loaded = content.value;
  openId.value;
  if (!loaded) return;
  const fixed = relinkCharacter(character.peek(), loaded.index);
  if (fixed) {
    character.value = fixed;
    scheduleSave();
  }
});

/** Loads saved characters at startup; creates the first one if there are none. */
export async function initStorage(): Promise<void> {
  try {
    void requestPersistence();
    void refreshEncounterCount();
    await refreshList();
    const currentId = await getCurrentId();
    const wanted = currentId ?? characters.value[0]?.id;
    const loaded = wanted ? await loadCharacter(wanted) : undefined;
    if (loaded) {
      character.value = withRulesFlag(loaded);
      saveStatus.value = "saved";
    } else {
      await saveNow();
    }
    // Flush pending edits when the tab is hidden or closed; the delay timer may not fire then.
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden" && saveTimer !== undefined) void saveNow();
    });
    addEventListener("pagehide", () => {
      if (saveTimer !== undefined) void saveNow();
    });
    addEventListener("hashchange", () => void importFromLink());
    await importFromLink();
  } catch (error) {
    console.error("Storage is not available", error);
    saveStatus.value = "failed";
  } finally {
    storageReady.value = true;
  }
}

/**
 * Opens the character carried by the page link (`#c=...`) as a new character, then removes
 * the fragment so reloading does not import it again.
 */
export async function importFromLink(): Promise<void> {
  if (!isShareHash(location.hash)) return;
  const hash = location.hash;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  try {
    await switchTo(await decodeShare(hash));
    shareNotice.value = "imported";
  } catch (error) {
    if (!(error instanceof CharacterParseError))
      console.error("Opening a shared link failed", error);
    shareNotice.value = "failed";
  }
}

/** The editions whose rules are loaded. */
export const editionsAvailable = computed(() =>
  editionsIn((content.value?.packs ?? []).map((p) => p.manifest.ruleset)),
);

/** True while the first step of the build screen, the rules, is still to be done. With one edition there is nothing to ask. */
export const rulesOpen = computed(
  () => editionsAvailable.value.length > 1 && rulesToChoose(character.value),
);

/** Settles the rules of the open character: they pick the rules every later step uses. */
export function setRules(ruleset: Character["ruleset"]) {
  // What could be taken back belongs to the rules of before.
  dismissUndo();
  updateCharacter((d) => chooseRules(d, ruleset));
}

/** "New character": opens a blank one on the build screen, whose first step is the rules. */
export async function startNewCharacter(): Promise<void> {
  // A blank one that is open is the new character already.
  if (!(isBlank(character.value) && rulesToChoose(character.value)))
    await switchTo(createNewCharacter());
  showView("build");
}

/**
 * Opens Aria, the example character, in the sheet. If she is already among the characters (with
 * whatever the person did to her) that one is opened, not another made; a blank character that
 * is open is dropped.
 */
export async function openExample(): Promise<void> {
  const loaded = content.value;
  if (!loaded) return;
  const open = character.value;
  const blank = isBlank(open);
  const known = characters.value.some((c) => c.id === EXAMPLE_ID);
  if (blank && open.id !== EXAMPLE_ID) {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    await deleteCharacter(open.id).catch(() => undefined);
    await refreshList();
  }
  if (known) await openCharacter(EXAMPLE_ID);
  else
    await switchTo(
      buildExample(loaded.index, {
        personalityTraits: ui("example.personality"),
        ideals: ui("example.ideals"),
        bonds: ui("example.bonds"),
        flaws: ui("example.flaws"),
        appearance: ui("example.appearance"),
      }),
    );
  showView("sheet");
}

export async function openCharacter(id: string) {
  if (id === character.value.id) return;
  if (saveTimer !== undefined) await saveNow();
  const loaded = await loadCharacter(id);
  if (!loaded) {
    await refreshList();
    return;
  }
  character.value = withRulesFlag(loaded);
  importFailed.value = false;
  await setCurrentId(id).catch(() => undefined);
}

export function duplicateCharacter() {
  const original = character.value;
  const copy = {
    ...structuredClone(original),
    id: uuid(),
    name: ui("bar.copyName", { name: original.name || ui("sheet.unnamed") }),
  };
  return switchTo(copy);
}

export async function deleteCurrentCharacter() {
  const snapshot = structuredClone(character.value);
  const removed = snapshot.id;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  try {
    await deleteCharacter(removed);
    await refreshList();
  } catch (error) {
    console.error("Deleting failed", error);
    saveStatus.value = "failed";
    return;
  }
  deletedCharacter.value = snapshot;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(() => {
    deletedCharacter.value = undefined;
  }, UNDO_MS);
  const next = characters.value[0];
  const loaded = next ? await loadCharacter(next.id) : undefined;
  await switchTo(loaded ?? createNewCharacter());
}

/** Brings back the character that was just deleted. */
export async function undoDelete() {
  const back = deletedCharacter.value;
  if (!back) return;
  clearTimeout(undoTimer);
  deletedCharacter.value = undefined;
  // Deleting the only character opened a blank one: it is not worth keeping next to this one.
  const open = character.value;
  const blank = isBlank(open);
  if (blank) await deleteCharacter(open.id).catch(() => undefined);
  await saveCharacter(back);
  await refreshList();
  await switchTo(back);
}

/** Every saved character, as saved. */
export async function allCharacters(): Promise<Character[]> {
  await saveNow();
  const all: Character[] = [];
  for (const summary of characters.value) {
    const loaded = await loadCharacter(summary.id);
    if (loaded) all.push(loaded);
  }
  return all;
}

/**
 * What to do with a character of a backup that is already here with other content: take the one
 * that changed last, keep the one here, or keep both.
 */
export type ConflictPolicy = "newest" | "keep" | "copy";

/** The flag of the rules is written when a character is opened: one without it can be the same. */
const sameCharacter = (a: Character, b: Character) =>
  rulesToChoose(a) === rulesToChoose(b) &&
  JSON.stringify({ ...a, rulesPending: undefined }) ===
    JSON.stringify({ ...b, rulesPending: undefined });

/** How many of these characters are already here with other content (the same id, not the same text). */
export async function countConflicts(incomingList: Character[]): Promise<number> {
  let n = 0;
  for (const incoming of incomingList) {
    if (!characters.value.some((s) => s.id === incoming.id)) continue;
    const here = await loadCharacter(incoming.id);
    if (here && !sameCharacter(here, incoming)) n += 1;
  }
  return n;
}

/**
 * Puts the characters of a backup back. One that is already here and the same is left alone. One
 * with the same id that differs is, as chosen: replaced by the one of the backup, left as it is, or
 * kept beside it as a copy, so that nothing is lost unless the person says so.
 */
export async function restoreCharacters(
  incomingList: Character[],
  policy: ConflictPolicy = "copy",
  /** When each incoming character last changed, if the backup says. */
  times: Record<string, number> = {},
): Promise<{ added: number; skipped: number; replaced: number }> {
  let added = 0;
  let skipped = 0;
  let replaced = 0;
  let last: Character | undefined;
  // Edits not yet saved belong to what is here: they must not land on top of what comes in.
  if (saveTimer !== undefined) await saveNow();
  for (const incoming of incomingList) {
    const here = characters.value.some((s) => s.id === incoming.id)
      ? await loadCharacter(incoming.id)
      : undefined;
    if (here && sameCharacter(here, incoming)) {
      skipped += 1;
      continue;
    }
    // With no date on the incoming one, nobody can tell which is newer: both are kept.
    const theirs = times[incoming.id];
    const mine = characters.value.find((s) => s.id === incoming.id)?.updatedAt ?? 0;
    const dated = policy === "newest" && typeof theirs === "number";
    if (here && (policy === "keep" || (dated && theirs <= mine))) {
      skipped += 1;
      continue;
    }
    if (here && dated) {
      await saveCharacter(incoming, theirs);
      // The open character is shown as it is now.
      if (character.peek().id === incoming.id) character.value = withRulesFlag(incoming);
      replaced += 1;
      last = incoming;
      continue;
    }
    const kept = here
      ? {
          ...withRulesFlag(incoming),
          id: uuid(),
          name: ui("bar.copyName", { name: incoming.name || ui("sheet.unnamed") }),
        }
      : incoming;
    await saveCharacter(kept, here ? undefined : times[incoming.id]);
    last = kept;
    added += 1;
  }
  await refreshList();
  if (last) await switchTo(last);
  return { added, skipped, replaced };
}

async function restoreBackup(backup: { characters: Character[]; unreadable: number }) {
  const done = await restoreCharacters(backup.characters);
  importNotice.value = { added: done.added, skipped: done.skipped + backup.unreadable };
}

/**
 * Reads the text of any file the app makes and does the right thing with it, without asking what
 * it is: a transfer file goes to the transfer window ("transfer"), an old backup or a single
 * character is put in directly ("done"), anything else is refused ("failed").
 */
export async function importText(text: string): Promise<"transfer" | "done" | "failed"> {
  importNotice.value = undefined;
  try {
    // A transfer file (possibly protected) has a window of its own.
    if (openTransfer(text)) {
      transferInbox.value = text;
      transferDialog.value = "import";
      importFailed.value = false;
      return "transfer";
    }
    const backup = parseBackup(text);
    if (backup) {
      await restoreBackup(backup);
      importFailed.value = false;
      return "done";
    }
    const parsed = parseImportFile(text);
    await switchTo(parsed.character);
    importFailed.value = false;
    // The packs that came with it are put with the ones here (a module loaded now: it uses this one).
    if (parsed.packs.length > 0) {
      const { addCarriedPacks } = await import("./carry");
      importNotice.value = { added: 1, skipped: 0, packs: await addCarriedPacks(parsed.packs) };
    }
    return "done";
  } catch (error) {
    if (!(error instanceof CharacterParseError)) console.error("Import failed", error);
    importFailed.value = true;
    return "failed";
  }
}
