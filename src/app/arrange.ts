import { signal } from "@preact/signals";
import {
  type Arrangement,
  bundleFromIndex,
  copyEntries,
  dependenciesOf,
  importBundle,
  isReferenced,
  moveEntries,
  nameBasedId,
  renameId,
} from "../homebrew/arrange";
import { dropEntries, ownedEntries } from "../homebrew/entries";
import { newHomebrewPack } from "../homebrew/pack";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { askConfirm } from "./confirm";
import { editingPackId, openHomebrewPack } from "./homebrew";
import { language } from "./language";
import { migrateSavedCharacters } from "./migrate";
import { content } from "./store";
import {
  applyChange,
  flushStudio,
  openStudioPack,
  selectedEntry,
  undoChange,
  workingPack,
} from "./studio";
import { offerUndo } from "./undo";
import { addUserPack, userPacks } from "./userPacks";

/** The entries ticked in the list of the open pack. */
export const selection = signal<readonly string[]>([]);

/** What was copied or cut, waiting to be pasted into a pack. */
export const clipboard = signal<
  { packId: string; ids: string[]; mode: "copy" | "cut" } | undefined
>(undefined);

export const clearSelection = () => {
  selection.value = [];
};

export function toggleSelected(id: string) {
  const now = selection.value;
  selection.value = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
}

/** Ticks every entry between the last one ticked and this one, as a click with Shift does in a list. */
export function selectRange(ids: readonly string[], to: string) {
  const last = selection.value[selection.value.length - 1] ?? selectedEntry.value;
  const a = last ? ids.indexOf(last) : -1;
  const b = ids.indexOf(to);
  if (a < 0 || b < 0) return toggleSelected(to);
  const [from, until] = a < b ? [a, b] : [b, a];
  selection.value = [...new Set([...selection.value, ...ids.slice(from, until + 1)])];
}

const homebrewPacks = () => userPacks.value.filter((p) => p.origin === "homebrew");
const find = (id: string) => userPacks.value.find((p) => p.id === id);

/** The entries an action is about: the ticked ones, or the one that is open. */
export function targets(): string[] {
  if (selection.value.length > 0) return [...selection.value];
  return selectedEntry.value ? [selectedEntry.value] : [];
}

/** The packs an entry of the open pack can go to: the other homebrew ones. */
export const otherPacks = (): UserPackRecord[] =>
  homebrewPacks().filter((p) => p.id !== editingPackId.value);

const reversed = (map: ReadonlyMap<string, string>) => new Map([...map].map(([a, b]) => [b, a]));

/**
 * Writes the packs a change touched and puts the characters right, then offers to take it all back:
 * the packs as they were, and the characters with the ids the other way round.
 */
async function commit(done: Arrangement, label: string) {
  if (done.records.length === 0) return;
  const before = done.records.flatMap((r) => find(r.id) ?? []);
  for (const record of done.records) await addUserPack(record);
  if (done.idMap.size > 0) await migrateSavedCharacters(done.idMap);
  offerUndo(label, async () => {
    for (const old of before) await addUserPack(old);
    if (done.idMap.size > 0) await migrateSavedCharacters(reversed(done.idMap));
    await reopen(editingPackId.value);
  });
}

/** Opens the pack again from storage, with a clean history: after an arrangement the old steps no longer apply. */
async function reopen(id: string | undefined, select?: string) {
  await openStudioPack(id);
  if (select) selectedEntry.value = select;
}

/** Asks whether to bring what the entries refer to, when there is something. */
async function withDependencies(source: UserPackRecord, ids: string[]): Promise<string[]> {
  const needed = dependenciesOf(source, ids);
  if (needed.length === 0) return ids;
  const bring = await askConfirm({
    title: ui("studio.askDependencies", { n: needed.length }),
    confirm: ui("studio.bringThem"),
    cancel: ui("studio.onlyThese"),
  });
  return bring ? [...ids, ...needed] : ids;
}

async function sourceAndIds(ids: string[]) {
  await flushStudio();
  const open = workingPack();
  const source = open && find(open.id);
  if (!source || ids.length === 0) return undefined;
  return { source, ids: await withDependencies(source, ids) };
}

/** Makes a copy of the entries inside their own pack. */
export async function duplicateEntries(ids: string[] = targets()) {
  await flushStudio();
  const source = workingPack() && find(workingPack()?.id ?? "");
  if (!source || ids.length === 0) return;
  const done = copyEntries(source, source, ids, { rename: (name) => ui("hb.copyName", { name }) });
  await commit(done, ui("studio.duplicated", { n: ids.length }));
  await reopen(source.id, done.newIds[0]);
  clearSelection();
}

/** Copies entries into another pack, or into the open one when a different pack is the source. */
export async function copyEntriesTo(targetId: string, ids: string[] = targets()) {
  const plan = await sourceAndIds(ids);
  const target = find(targetId);
  if (!plan || !target) return;
  const done = copyEntries(plan.source, target, plan.ids);
  await commit(done, ui("studio.copied", { n: ids.length, pack: target.name }));
  clearSelection();
}

/** Moves entries to another pack. */
export async function moveEntriesTo(targetId: string, ids: string[] = targets()) {
  const plan = await sourceAndIds(ids);
  const target = find(targetId);
  if (!plan || !target) return;
  const others = homebrewPacks().filter((p) => p.id !== plan.source.id && p.id !== target.id);
  const done = moveEntries(plan.source, target, plan.ids, others);
  await commit(done, ui("studio.moved", { n: ids.length, pack: target.name }));
  clearSelection();
  await reopen(plan.source.id);
}

/** Puts what was copied or cut in the open pack. */
export async function pasteHere() {
  const held = clipboard.value;
  const target = workingPack() && find(workingPack()?.id ?? "");
  const source = held && find(held.packId);
  if (!held || !source || !target) return;
  await flushStudio();
  const ids = await withDependencies(source, held.ids);
  if (held.mode === "copy" || source.id === target.id) {
    const done = copyEntries(
      source,
      target,
      ids,
      source.id === target.id ? { rename: (n) => ui("hb.copyName", { name: n }) } : {},
    );
    await commit(done, ui("studio.pasted", { n: held.ids.length }));
    await reopen(target.id, done.newIds[0]);
    return;
  }
  const others = homebrewPacks().filter((p) => p.id !== source.id && p.id !== target.id);
  const done = moveEntries(source, target, ids, others);
  await commit(done, ui("studio.moved", { n: held.ids.length, pack: target.name }));
  clipboard.value = undefined;
  await reopen(target.id, done.newIds[0]);
}

export function copySelection() {
  const open = workingPack();
  const ids = targets();
  if (open && ids.length > 0) clipboard.value = { packId: open.id, ids, mode: "copy" };
}

export function cutSelection() {
  const open = workingPack();
  const ids = targets();
  if (open && ids.length > 0) clipboard.value = { packId: open.id, ids, mode: "cut" };
}

/** Deletes entries with what they own; the change can be undone with the notice or Ctrl+Z. */
export function deleteEntries(ids: string[] = targets()) {
  const record = workingPack();
  if (!record || ids.length === 0) return;
  const all = ids.flatMap((id) => [id, ...ownedEntries(record, id).map((e) => e.id)]);
  applyChange(dropEntries(record, all));
  clearSelection();
  if (selectedEntry.value && all.includes(selectedEntry.value)) selectedEntry.value = undefined;
  offerUndo(ui("studio.deleted", { n: ids.length }), undoChange);
}

/**
 * Gives an entry that was made without a name an id from the name it has now (`spell/spell` becomes
 * `spell/frost-bite`), unless something refers to the old one. Done when the name is left.
 */
export async function nameTheId(id: string) {
  await flushStudio();
  const record = workingPack();
  const name = record?.strings[`${id}.name`];
  if (!record || !name) return;
  const next = nameBasedId(record, id, name);
  if (!next || next === id) return;
  const mine = homebrewPacks();
  if (isReferenced(mine, id)) return;
  const done = renameId(record, id, next, []);
  for (const r of done.records) await addUserPack(r);
  await reopen(record.id, next);
}

/**
 * Copies entries of the rules (or of content imported from another tool) into a homebrew pack to
 * change them: the open pack, else the first one, else a new one. What comes from imported content
 * stays on this device. Opens the studio on the copy.
 */
export async function copyFromRules(ids: string[]): Promise<boolean> {
  const c = content.value;
  if (!c || ids.length === 0 || !ids.every((id) => c.index.has(id))) return false;
  await flushStudio();
  let pack = (editingPackId.value && find(editingPackId.value)) || homebrewPacks()[0];
  // A new pack is written in the language of the app, since the texts of the copy are read in it.
  if (!pack) pack = { ...newHomebrewPack(ui("hb.myPack")), lang: language.value };
  const bundle = bundleFromIndex(
    c.index,
    { fields: (id) => c.fields(id), read: (id, field) => c.displayed(id, field) ?? "" },
    ids,
    pack.lang,
  );
  const imported = userPacks.value.some(
    (p) => p.origin === "personal" && ids.some((id) => id.startsWith(`${p.id}:`)),
  );
  const done = importBundle(bundle, pack, {
    rename: (name) => ui("hb.copyName", { name }),
    restricted: imported,
    from: (id) => id,
  });
  await addUserPack(done.record);
  openHomebrewPack(done.record.id);
  await reopen(done.record.id, done.newIds[0]);
  return true;
}
