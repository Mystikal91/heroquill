import { signal } from "@preact/signals";
import { deriveSheet } from "../engine/derive";
import {
  type Combatant,
  type Encounter,
  type TurnReport,
  addCombatants,
  characterCombatant,
  createEncounter,
  isStarted,
  manualCombatant,
  monsterCombatant,
  newNames,
  nextTurn,
  removeCombatant,
} from "../engine/encounter";
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
import { content } from "./store";
import { offerUndo } from "./undo";

/** All the encounters, the one changed last first (the open one is `encounter`). */
export const encounters = signal<Encounter[]>([]);
/** The encounter on screen. */
export const encounter = signal<Encounter | undefined>(undefined);
export const dmReady = signal(false);
/** The combatant whose card is open to the stat block or the notes. */
export const openCombatant = signal<string | undefined>(undefined);

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

export async function selectEncounter(id: string) {
  await flush();
  const next = encounters.value.find((e) => e.id === id);
  if (!next) return;
  encounter.value = next;
  openCombatant.value = undefined;
  turnHistory.length = 0;
  await setCurrentEncounterId(id);
}

export async function newEncounter() {
  await flush();
  const fresh = createEncounter(defaultName(encounters.value));
  show(fresh);
  openCombatant.value = undefined;
  turnHistory.length = 0;
  await saveEncounter(fresh);
  await setCurrentEncounterId(fresh.id);
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
      return { ...rest, id: uuid(), hp: c.maxHp, tempHp: 0, conditions: [], rounds: {} };
    }),
    created: now,
    updated: now,
  };
  const { turn: _turn, ...fresh } = copy;
  show(fresh);
  turnHistory.length = 0;
  await saveEncounter(fresh);
  await setCurrentEncounterId(fresh.id);
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
  openCombatant.value = undefined;
  turnHistory.length = 0;
  offerUndo(ui("dm.removedEncounter", { name: current.name }), async () => {
    await saveEncounter(current);
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
}

export function addManual(fields: {
  name: string;
  maxHp: number;
  ac: number;
  initiativeBonus: number;
}) {
  updateEncounter((e) =>
    addCombatants(e, [
      manualCombatant({ ...fields, name: fields.name.trim() || ui("dm.unnamed") }),
    ]),
  );
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
        initiativeBonus: sheet.initiative,
      }),
    ]),
  );
  return true;
}

/** Takes a creature out of the fight; it can be put back where it was for a few seconds. */
export function removeFromFight(id: string) {
  const before = encounter.value;
  const gone = before?.combatants.find((c) => c.id === id);
  if (!before || !gone) return;
  const index = before.combatants.indexOf(gone);
  updateEncounter((e) => removeCombatant(e, id));
  if (openCombatant.value === id) openCombatant.value = undefined;
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
  /** The creature whose turn ended, as it was: its conditions and their rounds come back too. */
  who: { id: string; conditions: string[]; rounds: Record<string, number> } | undefined;
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
    who: who && { id: who.id, conditions: [...who.conditions], rounds: { ...who.rounds } },
  });
  if (turnHistory.length > MAX_HISTORY) turnHistory.shift();
  const report = nextTurn(before);
  lastTurn.value = report.ended.conditions.length > 0 ? report.ended : undefined;
  show(report.encounter);
  scheduleSave();
}

export const canGoBack = () => turnHistory.length > 0;

/** Takes the last turn back: the turn, the round, and what ran out with it. Hit points changed since stay changed. */
export function previousTurn() {
  const step = turnHistory.pop();
  if (!step) return;
  lastTurn.value = undefined;
  updateEncounter((e) => ({
    ...e,
    turn: e.combatants.some((c) => c.id === step.turn) ? step.turn : e.turn,
    round: step.round,
    combatants: e.combatants.map((c) =>
      step.who && c.id === step.who.id
        ? { ...c, conditions: step.who.conditions, rounds: step.who.rounds }
        : c,
    ),
  }));
}

export function resetTurnHistory() {
  turnHistory.length = 0;
  lastTurn.value = undefined;
}
