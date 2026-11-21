import { effect, signal } from "@preact/signals";
import {
  type AreaPick,
  type DefenseLine,
  areaDamage,
  defensesOf,
  innateDefenses,
} from "../engine/defenses";
import { deriveSheet } from "../engine/derive";
import {
  type Combatant,
  type Encounter,
  type TrackedEffect,
  type TurnReport,
  addCombatants,
  addEffect,
  changeCombatant,
  characterCombatant,
  createEncounter,
  delayTurn,
  isStarted,
  lairCombatant,
  manualCombatant,
  monsterCombatant,
  newNames,
  nextTurn,
  removeCombatant,
  resetFight,
} from "../engine/encounter";
import { type UseDef, rollRecharge } from "../engine/monsterUses";
import { currentHp } from "../engine/play";
import { uuid } from "../engine/uuid";
import { ui } from "../i18n/ui";
import { loadCharacter } from "../storage/characters";
import {
  deleteEncounter,
  getCurrentEncounterId,
  listEncounters,
  saveEncounter,
  setCurrentEncounterId,
} from "../storage/encounters";
import { encountersChanged, refreshEncounterCount } from "./encounterCount";
import { content } from "./store";
import { type UndoOffer, offerUndo, undoOffer } from "./undo";

/** All the encounters, the one changed last first (the open one is `encounter`). */
export const encounters = signal<Encounter[]>([]);
/** The encounter on screen. */
export const encounter = signal<Encounter | undefined>(undefined);
export const dmReady = signal(false);
/** The combatant whose details are open. */
export const infoFor = signal<string | undefined>(undefined);
/** The creature the window that adds a spell or an effect is open for. */
export const effectFor = signal<string | undefined>(undefined);
/** The window that adds creatures is open. */
export const adding = signal(false);
/** What the window added since it was opened, to show a running line ("3 Goblin"). */
export const addedLog = signal<{ name: string; count: number }[]>([]);
/** The characters connected from another device (a red dot in the table). Nobody is yet: the online part comes later. */
export const liveIds = signal<ReadonlySet<string>>(new Set());

// A transfer file brought fights in while this page was open: read them again.
effect(() => {
  void encountersChanged.value;
  if (dmReady.peek()) {
    dmReady.value = false;
    void loadDm();
  }
});

const RULESET_KEY = "dmRuleset";
export type DmRuleset = "srd51" | "srd52";

function savedRuleset(): DmRuleset {
  try {
    return localStorage.getItem(RULESET_KEY) === "srd52" ? "srd52" : "srd51";
  } catch {
    return "srd51";
  }
}

/** Which edition's monsters and conditions the DM picks from; the app follows the 2014 rules by default. */
export const dmRuleset = signal<DmRuleset>(savedRuleset());

export function setDmRuleset(next: DmRuleset) {
  dmRuleset.value = next;
  try {
    localStorage.setItem(RULESET_KEY, next);
  } catch {
    // Not remembered: it still holds for this visit.
  }
}

// ---- Saving: a change is kept a moment after the last one ----

const SAVE_DELAY_MS = 350;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

async function flush() {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const current = encounter.value;
  if (current) await saveEncounter(current);
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS);
}

if (typeof addEventListener === "function") {
  addEventListener("pagehide", () => void flush());
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}

function show(next: Encounter) {
  encounter.value = next;
  encounters.value = [next, ...encounters.value.filter((e) => e.id !== next.id)];
}

const defaultName = (list: readonly Encounter[]) => ui("dm.encounterName", { n: list.length + 1 });

/** Reads what is saved and opens the encounter that was open, or the newest, or a first empty one. */
export async function loadDm() {
  if (dmReady.value) return;
  const list = await listEncounters();
  encounters.value = list;
  const wanted = await getCurrentEncounterId();
  const open = list.find((e) => e.id === wanted) ?? list[0];
  if (open) encounter.value = open;
  else {
    const first = createEncounter(defaultName(list));
    encounter.value = first;
    encounters.value = [first];
    await saveEncounter(first);
    await setCurrentEncounterId(first.id);
  }
  dmReady.value = true;
}

/** Applies a change to the open encounter and keeps it. */
export function updateEncounter(edit: (e: Encounter) => Encounter) {
  const current = encounter.value;
  if (!current) return;
  show(edit(current));
  scheduleSave();
}

/** Changes one creature of the open encounter. */
export const editCombatant = (id: string, change: (c: Combatant) => Combatant) =>
  updateEncounter((e) => changeCombatant(e, id, change));

/** Where a run of changes to the hit points of one creature started, so one undo takes them all back. */
let hpAnchor: { offer: UndoOffer | undefined; id: string; hp: number; tempHp: number } | undefined;

/**
 * Changes the hit points of a creature and offers to take the change back. Changes made one after the
 * other while the offer is still showing (the quick steps) are taken back together.
 */
export function changeHp(id: string, change: (c: Combatant) => Combatant) {
  const before = encounter.value?.combatants.find((c) => c.id === id);
  if (!before) return;
  const running =
    hpAnchor?.id === id && hpAnchor.offer !== undefined && undoOffer.value === hpAnchor.offer;
  const start = running && hpAnchor ? hpAnchor : { hp: before.hp, tempHp: before.tempHp };
  editCombatant(id, change);
  const after = encounter.value?.combatants.find((c) => c.id === id);
  if (!after || (after.hp === before.hp && after.tempHp === before.tempHp)) return;
  const shown = (hp: number, temp: number) => (temp > 0 ? `${hp}+${temp}` : String(hp));
  offerUndo(
    ui("dm.hpChanged", {
      name: after.name,
      from: shown(start.hp, start.tempHp),
      to: shown(after.hp, after.tempHp),
    }),
    () => editCombatant(id, (c) => ({ ...c, hp: start.hp, tempHp: start.tempHp })),
  );
  hpAnchor = { offer: undoOffer.value, id, hp: start.hp, tempHp: start.tempHp };
}

/** The same fight from the start (see `resetFight`); it can be taken back for a few seconds. */
export function resetCurrentFight() {
  const before = encounter.value;
  if (!before) return;
  resetTurnHistory();
  infoFor.value = undefined;
  updateEncounter(resetFight);
  offerUndo(ui("dm.resetDone"), () => updateEncounter(() => before));
}

export async function selectEncounter(id: string) {
  await flush();
  const next = encounters.value.find((e) => e.id === id);
  if (!next) return;
  encounter.value = next;
  infoFor.value = undefined;
  turnHistory.length = 0;
  await setCurrentEncounterId(id);
}

export async function newEncounter() {
  await flush();
  const fresh = createEncounter(defaultName(encounters.value));
  show(fresh);
  infoFor.value = undefined;
  turnHistory.length = 0;
  await saveEncounter(fresh);
  await setCurrentEncounterId(fresh.id);
  void refreshEncounterCount();
}

/** A copy of the open encounter with the fight reset (no round, full hit points, no conditions): to use a prepared fight again. */
export async function duplicateEncounter() {
  const current = encounter.value;
  if (!current) return;
  await flush();
  const now = Date.now();
  const copy: Encounter = {
    ...current,
    id: uuid(),
    name: ui("dm.copyName", { name: current.name }),
    round: 0,
    combatants: current.combatants.map((c) => {
      const { initiative: _gone, ...rest } = c;
      return {
        ...rest,
        id: uuid(),
        hp: c.maxHp,
        tempHp: 0,
        conditions: [],
        rounds: {},
        effects: [],
      };
    }),
    created: now,
    updated: now,
  };
  const { turn: _turn, ...fresh } = copy;
  show(fresh);
  turnHistory.length = 0;
  await saveEncounter(fresh);
  await setCurrentEncounterId(fresh.id);
  void refreshEncounterCount();
}

/** Removes the open encounter; it can be brought back for a few seconds. */
export async function removeEncounter() {
  const current = encounter.value;
  if (!current) return;
  clearTimeout(saveTimer);
  await deleteEncounter(current.id);
  const rest = encounters.value.filter((e) => e.id !== current.id);
  encounters.value = rest;
  const next = rest[0];
  if (next) {
    encounter.value = next;
    await setCurrentEncounterId(next.id);
  } else {
    const fresh = createEncounter(defaultName([]));
    show(fresh);
    await saveEncounter(fresh);
    await setCurrentEncounterId(fresh.id);
  }
  infoFor.value = undefined;
  turnHistory.length = 0;
  void refreshEncounterCount();
  offerUndo(ui("dm.removedEncounter", { name: current.name }), async () => {
    await saveEncounter(current);
    void refreshEncounterCount();
    encounters.value = [current, ...encounters.value.filter((e) => e.id !== current.id)];
    encounter.value = current;
    await setCurrentEncounterId(current.id);
  });
}

// ---- Putting creatures in the fight ----

/** `count` creatures of a monster of the rules, numbered when there are several. */
export function addMonsters(entryId: string, count: number, rollHp: boolean) {
  const c = content.value;
  const entry = c?.index.get(entryId);
  if (!c || !entry) return;
  updateEncounter((e) => {
    const names = newNames(
      c.name(entryId),
      e.combatants.map((x) => x.name),
      Math.max(1, Math.min(count, 30)),
    );
    return addCombatants(
      e,
      names.map((name) => monsterCombatant(entry, name, { rollHp })),
    );
  });
  logAdded(c.name(entryId), Math.max(1, Math.min(count, 30)));
}

/** Puts an effect (a spell, a note, a concentration) on a creature. */
export const giveEffect = (id: string, effect: Omit<TrackedEffect, "id">) =>
  editCombatant(id, (c) => addEffect(c, effect));

/** Opens the window that adds creatures, with a fresh running line. */
export function openAdd() {
  addedLog.value = [];
  adding.value = true;
}

export function closeAdd() {
  adding.value = false;
}

/** Adds to the running line of what the window added. */
function logAdded(name: string, count: number) {
  const log = addedLog.value;
  const last = log.find((x) => x.name === name);
  addedLog.value = last
    ? log.map((x) => (x === last ? { ...x, count: x.count + count } : x))
    : [...log, { name, count }];
}

export function addManual(fields: {
  name: string;
  maxHp: number;
  ac: number;
  speed?: number;
  initiativeBonus: number;
}) {
  const name = fields.name.trim() || ui("dm.unnamed");
  updateEncounter((e) => addCombatants(e, [manualCombatant({ ...fields, name })]));
  logAdded(name, 1);
}

/** A character saved on this device, with the numbers of its sheet now. */
export async function addCharacter(characterId: string): Promise<boolean> {
  const c = content.value;
  if (!c) return false;
  const character = await loadCharacter(characterId);
  if (!character) return false;
  const sheet = deriveSheet(character, c.index);
  const max = sheet.hitPoints.max;
  updateEncounter((e) =>
    addCombatants(e, [
      characterCombatant({
        characterId,
        name: character.name.trim() || ui("dm.unnamed"),
        hp: currentHp(character.play, max),
        maxHp: max,
        tempHp: character.play.tempHp,
        ac: sheet.armorClass.value,
        ...(sheet.speed !== undefined && { speed: sheet.speed }),
        defenses: sheet.defenses,
        initiativeBonus: sheet.initiative,
      }),
    ]),
  );
  logAdded(character.name.trim() || ui("dm.unnamed"), 1);
  return true;
}

/** Takes a creature out of the fight; it can be put back where it was for a few seconds. */
export function removeFromFight(id: string) {
  const before = encounter.value;
  const gone = before?.combatants.find((c) => c.id === id);
  if (!before || !gone) return;
  const index = before.combatants.indexOf(gone);
  updateEncounter((e) => removeCombatant(e, id));
  if (infoFor.value === id) infoFor.value = undefined;
  offerUndo(ui("dm.removedCombatant", { name: gone.name }), () => putBack(gone, index));
}

function putBack(gone: Combatant, index: number) {
  updateEncounter((e) => {
    if (e.combatants.some((c) => c.id === gone.id)) return e;
    const list = [...e.combatants];
    list.splice(Math.min(index, list.length), 0, gone);
    return { ...e, combatants: list };
  });
}

// ---- Turns, with a way back ----

interface TurnStep {
  turn: string | undefined;
  round: number;
  /** The creature whose turn ended, as it was: its conditions, effects and their rounds come back too. */
  who:
    | {
        id: string;
        conditions: string[];
        rounds: Record<string, number>;
        effects: TrackedEffect[];
      }
    | undefined;
}

const turnHistory: TurnStep[] = [];
const MAX_HISTORY = 30;

/** What ended with the last turn, for the line under the buttons. */
export const lastTurn = signal<TurnReport["ended"] | undefined>(undefined);

export function advanceTurn() {
  const before = encounter.value;
  if (!before || !isStarted(before)) return;
  const who = before.combatants.find((c) => c.id === before.turn);
  turnHistory.push({
    turn: before.turn,
    round: before.round,
    who: who && {
      id: who.id,
      conditions: [...who.conditions],
      rounds: { ...who.rounds },
      effects: who.effects.map((x) => ({ ...x })),
    },
  });
  if (turnHistory.length > MAX_HISTORY) turnHistory.shift();
  rechargeNote.value = undefined;
  const report = nextTurn(before);
  lastTurn.value =
    report.ended.conditions.length + report.ended.effects.length > 0 ? report.ended : undefined;
  show(report.encounter);
  scheduleSave();
}

export const canGoBack = () => turnHistory.length > 0;

/** Takes the last turn back: the turn, the round, and what ran out with it. Hit points changed since stay changed. */
export function previousTurn() {
  const step = turnHistory.pop();
  if (!step) return;
  lastTurn.value = undefined;
  rechargeNote.value = undefined;
  updateEncounter((e) => ({
    ...e,
    turn: e.combatants.some((c) => c.id === step.turn) ? step.turn : e.turn,
    round: step.round,
    combatants: e.combatants.map((c) =>
      step.who && c.id === step.who.id
        ? {
            ...c,
            conditions: step.who.conditions,
            rounds: step.who.rounds,
            effects: step.who.effects,
          }
        : c,
    ),
  }));
}

export function resetTurnHistory() {
  turnHistory.length = 0;
  lastTurn.value = undefined;
}

// ---- Rolling initiative for a group of the same kind ----

const GROUP_KEY = "dmGroupInit";

function savedGroup(): boolean {
  try {
    return localStorage.getItem(GROUP_KEY) === "1";
  } catch {
    return false;
  }
}

/** Roll once for the creatures of one kind (the goblins act together) instead of one die each. */
export const groupInitiative = signal(savedGroup());

export function setGroupInitiative(on: boolean) {
  groupInitiative.value = on;
  try {
    localStorage.setItem(GROUP_KEY, on ? "1" : "0");
  } catch {
    // Not remembered: it still holds for this visit.
  }
}

// ---- Damage by kind, and to several creatures at once ----

/** What a creature defends against: its entry's lists (a monster), its sheet's (a character) and its effects. */
export function defensesFor(c: Combatant): DefenseLine[] {
  const entry = c.kind === "monster" && c.source ? content.value?.index.get(c.source) : undefined;
  return defensesOf(c, entry ? innateDefenses(entry.data) : []);
}

/** The conditions a monster is immune to, by slug (`poisoned`). */
export function conditionImmunities(c: Combatant): string[] {
  const entry = c.kind === "monster" && c.source ? content.value?.index.get(c.source) : undefined;
  const list = (entry?.data as { conditionImmunities?: unknown } | undefined)?.conditionImmunities;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

/** The area-damage mode: who is hit and how, the amount and the kind. */
export const areaMode = signal(false);
export const areaPicks = signal<Record<string, AreaPick>>({});
export const areaAmount = signal(0);
export const areaType = signal<string | undefined>(undefined);

export function startArea() {
  areaPicks.value = {};
  areaAmount.value = 0;
  areaType.value = undefined;
  areaMode.value = true;
}

export function leaveArea() {
  areaMode.value = false;
  areaPicks.value = {};
}

/** One tap on a creature: not hit, then hit in full, then half (it saved), then not hit again. */
export function cyclePick(id: string) {
  const { [id]: now, ...rest } = areaPicks.value;
  areaPicks.value =
    now === undefined
      ? { ...rest, [id]: "fail" }
      : now === "fail"
        ? { ...rest, [id]: "save" }
        : rest;
}

/** Marks every creature that is not a character as hit in full. */
export function pickCreatures() {
  const e = encounter.value;
  if (!e) return;
  areaPicks.value = Object.fromEntries(
    e.combatants
      .filter((c) => c.kind !== "character" && !c.lair)
      .map((c) => [c.id, "fail" as const]),
  );
}

/** Deals the damage to everybody marked, each through its own defenses, and offers to take it back. */
export function applyArea() {
  const e = encounter.value;
  const picks = areaPicks.value;
  const amount = areaAmount.value;
  if (!e || amount <= 0 || Object.keys(picks).length === 0) return;
  const before = new Map(
    e.combatants.filter((c) => picks[c.id]).map((c) => [c.id, { hp: c.hp, tempHp: c.tempHp }]),
  );
  const out = areaDamage(e, picks, amount, areaType.value, defensesFor);
  updateEncounter(() => out.encounter);
  offerUndo(ui("dm.area.done", { n: out.taken.length }), () =>
    updateEncounter((x) => ({
      ...x,
      combatants: x.combatants.map((c) => {
        const was = before.get(c.id);
        return was ? { ...c, ...was } : c;
      }),
    })),
  );
  leaveArea();
}

// ---- Limited abilities, legendary actions, the lair ----

/** What the last roll for a recharge said, under the turn buttons. */
export const rechargeNote = signal<string | undefined>(undefined);

/** The entry of the monster a creature was made from. */
export const monsterEntry = (c: Combatant) =>
  c.kind === "monster" && c.source ? content.value?.index.get(c.source) : undefined;

/** The name of a limited ability of a monster, as its stat block writes it in the language. */
export function abilityName(c: Combatant, def: UseDef): string {
  const text = c.source
    ? content.value?.text(c.source, `${def.list}.${def.number}.name`)
    : undefined;
  return text ?? def.key;
}

/** Rolls the die for a recharge and says what came of it. */
export function rollRechargeFor(id: string, def: UseDef) {
  const c = encounter.value?.combatants.find((x) => x.id === id);
  if (!c) return;
  const out = rollRecharge(c, def);
  editCombatant(id, () => out.creature);
  rechargeNote.value = ui(out.recharged ? "dm.recharged" : "dm.notRecharged", {
    name: abilityName(c, def),
    total: out.total,
  });
}

/** Adds the lair as a creature of its own at initiative 20. */
export function addLair() {
  const name = ui("dm.lairName");
  updateEncounter((e) => addCombatants(e, [lairCombatant(name)]));
  logAdded(name, 1);
}

/** The active creature delays its turn until after another; it can be taken back. */
export function delayActive(after: string) {
  const before = encounter.value;
  const active = before?.combatants.find((c) => c.id === before.turn);
  if (!before || !active) return;
  resetTurnHistory();
  updateEncounter((e) => delayTurn(e, after));
  offerUndo(ui("dm.delayed", { name: active.name }), () => updateEncounter(() => before));
}
