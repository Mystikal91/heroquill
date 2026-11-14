import { signal } from "@preact/signals";
import { copyDraft } from "../homebrew/copy";
import { type Draft, newHomebrewPack, removeEntry, saveDraft } from "../homebrew/model";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { showView } from "./navigation";
import { content } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The homebrew pack open in the editor. */
export const editingPackId = signal<string | undefined>(undefined);

export const editingPack = (): UserPackRecord | undefined =>
  userPacks.value.find((p) => p.id === editingPackId.value && p.origin === "homebrew");

/** Starts a homebrew pack and opens it in the editor. */
export async function createHomebrewPack(name: string): Promise<void> {
  const record = newHomebrewPack(name);
  await addUserPack(record);
  openHomebrewPack(record.id);
}

export function openHomebrewPack(id: string): void {
  editingPackId.value = id;
  showView("homebrew");
}

/** Back to the list of homebrew packs, which is what the editor page shows when no pack is open. */
export function closeHomebrewPack(): void {
  editingPackId.value = undefined;
}

/** Opens the homebrew page on its list of packs, from wherever it was last left. */
export function showHomebrewList(): void {
  closeHomebrewPack();
  showView("homebrew");
}

/** A form waiting to be opened in the editor: the copy of a rules entry. Taken by the editor page. */
let waitingDraft: Draft | undefined;

export function takeWaitingDraft(): Draft | undefined {
  const draft = waitingDraft;
  waitingDraft = undefined;
  return draft;
}

/**
 * Opens a copy of a rules entry in the homebrew editor, to save as a new entry: in the pack being
 * edited, else the first homebrew pack, else a new one. False when the editor cannot open it.
 */
export async function copyAsNewHomebrew(id: string): Promise<boolean> {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return false;
  const draft = copyDraft(
    entry,
    { index: c.index, fields: (i) => c.fields(i), read: (i, f) => c.displayed(i, f) ?? "" },
    (name) => ui("hb.copyName", { name }),
  );
  if (!draft) return false;
  let pack = editingPack() ?? userPacks.value.find((p) => p.origin === "homebrew");
  if (!pack) {
    pack = newHomebrewPack("");
    await addUserPack(pack);
  }
  waitingDraft = draft;
  openHomebrewPack(pack.id);
  return true;
}

/** The entry belongs to a homebrew pack: the person wrote it. */
export function isHomebrewId(id: string): boolean {
  const pack = id.split(":")[0];
  return userPacks.value.some((p) => p.origin === "homebrew" && p.id === pack);
}

/** The slugs of every entry of one kind the app knows. */
function slugsOf(kind: string): string[] {
  return [...(content.value?.index.values() ?? [])]
    .filter((e) => e.kind === kind)
    .map((e) => e.id.split("/")[1] ?? "")
    .filter(Boolean);
}

/** Saves a form in the open pack: a new entry, or a replacement for `editing`. */
export async function saveHomebrewEntry(draft: Draft, editing?: string): Promise<void> {
  const record = editingPack();
  if (!record) return;
  const saved = saveDraft(
    record,
    draft,
    { languages: slugsOf("language"), skills: slugsOf("skill") },
    editing,
  );
  await addUserPack(saved.record);
}

export async function deleteHomebrewEntry(id: string): Promise<void> {
  const record = editingPack();
  if (record) await addUserPack(removeEntry(record, id));
}

export async function renameHomebrewPack(name: string): Promise<void> {
  const record = editingPack();
  if (record && name.trim() && name.trim() !== record.name)
    await addUserPack({ ...record, name: name.trim() });
}
