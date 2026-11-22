import { computed, effect, signal } from "@preact/signals";
import {
  type Campaign,
  type PartyMember,
  addMember,
  changeMember,
  createCampaign,
  newMember,
  removeMember,
  renameCampaign,
} from "../engine/campaign";
import { combatantNumbers } from "../engine/combatantNumbers";
import {
  type AreaPick,
  type DefenseLine,
  areaDamage,
  defensesOf,
  innateDefenses,
} from "../engine/defenses";
import { deriveSheet } from "../engine/derive";
import { parseDice, rollD20, rollExpression } from "../engine/dice";
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
  endCombat,
  isStarted,
  lairCombatant,
  manualCombatant,
  monsterCombatant,
  newNames,
  nextTurn,
  removeCombatant,
  resetFight,
  startCombat,
  toggleCondition,
} from "../engine/encounter";
import { type ActionRolls, type DamagePart, attackHits, doubleDice } from "../engine/monsterRolls";
import { type UseDef, rollRecharge } from "../engine/monsterUses";
import { currentHp } from "../engine/play";
import { uuid } from "../engine/uuid";
import { ui } from "../i18n/ui";
import { matchSeats, trackerViewOf } from "../relay/trackerView";
import {
  deleteCampaign,
  getCurrentCampaignId,
  listCampaigns,
  saveCampaign,
  setCurrentCampaignId,
} from "../storage/campaigns";
import { loadCharacter } from "../storage/characters";
import {
  deleteEncounter,
  getCurrentEncounterId,
  listEncounters,
  saveEncounter,
  setCurrentEncounterId,
} from "../storage/encounters";
import { damageName } from "../ui/damageName";
import { onlineSettings } from "./dmSettings";
import { encountersChanged, refreshEncounterCount } from "./encounterCount";
import { addLog, rollMode } from "./play";
import { content } from "./store";
import {
  askInitiative,
  onCard,
  onInitiative,
  propose,
  publishTracker,
  seatOnline,
  switchTable,
  tableOnline,
  tableView,
} from "./table";
import { type UndoOffer, offerUndo, undoOffer } from "./undo";

/** All the encounters, the one changed last first (the open one is `encounter`). */
export const encounters = signal<Encounter[]>([]);
/** The encounter on screen. */
export const encounter = signal<Encounter | undefined>(undefined);
export const dmReady = signal(false);

/** All the campaigns, and the one open: its party and its encounters are what the page shows. */
export const campaigns = signal<Campaign[]>([]);
export const campaign = signal<Campaign | undefined>(undefined);
/** The part of the page on screen: the campaign and its party, or the fights. */
export type DmSection = "campaign" | "encounter" | "rules" | "settings";
export const dmSection = signal<DmSection>("encounter");
/** The window that offers to put the party in the open encounter. */
export const partyPrompt = signal(false);
/** The window was opened by pressing Start: the fight begins when it is answered. */
const startAfterParty = signal(false);
/** The encounters of the open campaign, the one changed last first. */
export const campaignEncounters = computed(() =>
  encounters.value.filter((e) => e.campaignId === campaign.value?.id),
);
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

/**
 * Opens a campaign: the encounter that was open in it, or its newest, or a first empty one.
 * The campaign and the encounter are remembered.
 */
async function openCampaign(next: Campaign) {
  campaign.value = next;
  const mine = encounters.value.filter((e) => e.campaignId === next.id);
  const wanted = await getCurrentEncounterId();
  const open = mine.find((e) => e.id === wanted) ?? mine[0];
  if (open) encounter.value = open;
  else {
    const first = createEncounter(defaultName(mine), next.id);
    show(first);
    await saveEncounter(first);
  }
  const shown = encounter.value;
  if (shown) await setCurrentEncounterId(shown.id);
  await setCurrentCampaignId(next.id);
  void switchTable(next.id);
}

/**
 * Reads what is saved and opens the campaign that was open (the newest if none was, a first one if there
 * are none). Fights with no campaign, or with one that is not here (a file brought them), join the first.
 */
export async function loadDm() {
  if (dmReady.value) return;
  let camps = await listCampaigns();
  let list = await listEncounters();
  if (camps.length === 0) {
    const first = createCampaign(ui("dm.campaign.default"));
    await saveCampaign(first);
    camps = [first];
  }
  const home = camps[0];
  if (home) {
    const strays = new Set(
      list.filter((e) => !camps.some((c) => c.id === e.campaignId)).map((e) => e.id),
    );
    if (strays.size > 0) {
      list = list.map((e) => (strays.has(e.id) ? { ...e, campaignId: home.id } : e));
      for (const e of list) if (strays.has(e.id)) await saveEncounter(e);
    }
  }
  campaigns.value = camps;
  encounters.value = list;
  const wanted = await getCurrentCampaignId();
  const current = camps.find((c) => c.id === wanted) ?? home;
  if (current) await openCampaign(current);
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
  const fresh = createEncounter(defaultName(campaignEncounters.value), campaign.value?.id);
  show(fresh);
  infoFor.value = undefined;
  turnHistory.length = 0;
  await saveEncounter(fresh);
  await setCurrentEncounterId(fresh.id);
  void refreshEncounterCount();
  // The party joins a new fight: the window asks who.
  if ((campaign.value?.party.length ?? 0) > 0) {
    startAfterParty.value = false;
    partyPrompt.value = true;
  }
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
  const next = rest.find((e) => e.campaignId === current.campaignId);
  if (next) {
    encounter.value = next;
    await setCurrentEncounterId(next.id);
  } else {
    const fresh = createEncounter(defaultName([]), current.campaignId);
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

/** The numbers of the sheet of a character saved on this device, now. */
async function characterStats(characterId: string) {
  const c = content.value;
  if (!c) return undefined;
  const character = await loadCharacter(characterId);
  if (!character) return undefined;
  const sheet = deriveSheet(character, c.index);
  const max = sheet.hitPoints.max;
  return {
    name: character.name.trim() || ui("dm.unnamed"),
    hp: currentHp(character.play, max),
    maxHp: max,
    tempHp: character.play.tempHp,
    ac: sheet.armorClass.value,
    ...(sheet.speed !== undefined && { speed: sheet.speed }),
    defenses: sheet.defenses,
    initiativeBonus: sheet.initiative,
  };
}

/** A character saved on this device, with the numbers of its sheet now. */
export async function addCharacter(characterId: string): Promise<boolean> {
  const stats = await characterStats(characterId);
  if (!stats) return false;
  updateEncounter((e) => addCombatants(e, [characterCombatant({ characterId, ...stats })]));
  logAdded(stats.name, 1);
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

/**
 * Deals damage to everybody marked, each through its own defenses, and offers to take it back.
 * Gives what each creature took.
 */
/** The seat of the player whose character this is, when they are at the table now. */
function onlineSeatOf(e: Encounter, c: Combatant): string | undefined {
  const seat = matchSeats(e.combatants, tableView.value.players).get(c.id);
  return seat && seatOnline(seat) ? seat : undefined;
}

function dealDamage(
  picks: Record<string, AreaPick>,
  amount: number,
  kind: string | undefined,
  from?: string,
): { id: string; dealt: number }[] {
  const e = encounter.value;
  if (!e || amount <= 0 || Object.keys(picks).length === 0) return [];
  const before = new Map(
    e.combatants.filter((c) => picks[c.id]).map((c) => [c.id, { hp: c.hp, tempHp: c.tempHp }]),
  );
  const out = areaDamage(e, picks, amount, kind, defensesFor);
  // A player who is at the table takes damage on their own sheet, and only if they accept: the character keeps
  // the hit points it had here, and the card the player sends brings the new ones.
  const asked = new Map(
    out.taken.flatMap((t) => {
      const c = e.combatants.find((x) => x.id === t.id);
      const seat = c && onlineSeatOf(e, c);
      return seat ? [[t.id, seat] as const] : [];
    }),
  );
  updateEncounter(() =>
    asked.size === 0
      ? out.encounter
      : {
          ...out.encounter,
          combatants: out.encounter.combatants.map((c) =>
            asked.has(c.id) ? (e.combatants.find((x) => x.id === c.id) ?? c) : c,
          ),
        },
  );
  for (const [id, seat] of asked) {
    const dealt = out.taken.find((t) => t.id === id)?.dealt ?? 0;
    const name = e.combatants.find((x) => x.id === id)?.name ?? "";
    if (dealt > 0)
      propose(
        seat,
        { kind: "damage", amount: dealt, ...(kind && { type: kind }), ...(from && { from }) },
        ui("dm.prop.damage", { name, amount: dealt }) + (kind ? ` (${damageName(kind)})` : ""),
      );
  }
  offerUndo(ui("dm.area.done", { n: out.taken.length }), () =>
    updateEncounter((x) => ({
      ...x,
      combatants: x.combatants.map((c) => {
        const was = before.get(c.id);
        return was ? { ...c, ...was } : c;
      }),
    })),
  );
  return out.taken;
}

/** Deals the area's damage to everybody marked. */
export function applyArea() {
  dealDamage(areaPicks.value, areaAmount.value, areaType.value);
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

// ---- Rolling an action of a creature against others ----

/** What an attack roll came to, for each creature it was made against. */
export interface AttackOutcome {
  natural: number;
  bonus: number;
  total: number;
  critical: boolean;
  fumble: boolean;
  results: { id: string; name: string; ac: number; hit: boolean }[];
}

/** The action being rolled: who is picked in the table, the attack and the damage. */
export interface RollFlow {
  attackerId: string;
  attackerName: string;
  action: string;
  /** The bonus of the attack; none when the action has only its damage. */
  bonus?: number;
  damage: DamagePart[];
  step: "attack" | "damage";
  /** The creatures picked in the table: attacked, then the ones the damage goes to. */
  targets: string[];
  attack?: AttackOutcome;
  /** What each damage roll came to, in the order they were rolled. */
  lines: string[];
  /** How many rolls were made, so the box can play the die again, and the total of the last one. */
  rolls: number;
  last?: number;
}

export const rollFlow = signal<RollFlow | undefined>(undefined);

/** Starts rolling an action of a creature: the table is shown to pick who is attacked. */
export function startRoll(attacker: Combatant, action: string, rolls: ActionRolls) {
  infoFor.value = undefined;
  leaveArea();
  rollFlow.value = {
    attackerId: attacker.id,
    attackerName: attacker.name,
    action,
    ...(rolls.attackBonus !== undefined && { bonus: rolls.attackBonus }),
    damage: rolls.damage,
    step: rolls.attackBonus === undefined ? "damage" : "attack",
    targets: [],
    lines: [],
    rolls: 0,
  };
}

export function closeRoll() {
  rollFlow.value = undefined;
}

export function toggleRollTarget(id: string) {
  const flow = rollFlow.value;
  if (!flow || id === flow.attackerId) return;
  rollFlow.value = {
    ...flow,
    targets: flow.targets.includes(id)
      ? flow.targets.filter((x) => x !== id)
      : [...flow.targets, id],
  };
}

/** One d20 for the attack, compared with the armor class of each creature picked; the ones it misses are let go. */
export function rollFlowAttack() {
  const flow = rollFlow.value;
  const e = encounter.value;
  if (!flow || !e || flow.bonus === undefined) return;
  const roll = rollD20(flow.bonus);
  const results = e.combatants
    .filter((c) => flow.targets.includes(c.id))
    .map((c) => {
      const ac = combatantNumbers(c).ac;
      return { id: c.id, name: c.name, ac, hit: attackHits(roll, ac) };
    });
  rollFlow.value = {
    ...flow,
    lines: [],
    rolls: flow.rolls + 1,
    last: roll.total,
    attack: {
      natural: roll.natural,
      bonus: flow.bonus,
      total: roll.total,
      critical: roll.critical,
      fumble: roll.fumble,
      results,
    },
    targets: results.length > 0 ? results.filter((r) => r.hit).map((r) => r.id) : [],
  };
}

export function rollFlowToDamage() {
  const flow = rollFlow.value;
  if (flow) rollFlow.value = { ...flow, step: "damage" };
}

const signedText = (n: number) => (n === 0 ? "" : n > 0 ? ` +${n}` : ` ${n}`);

/**
 * Rolls the damage of one kind once (the dice doubled after a critical hit) and deals it to everybody picked,
 * each through its own defenses. Rolling it is what confirms who was picked.
 */
export function rollFlowDamage(part: DamagePart, shown: (dice: string) => string) {
  const flow = rollFlow.value;
  const e = encounter.value;
  if (!flow || !e) return;
  const dice = flow.attack?.critical ? doubleDice(part.dice) : part.dice;
  const parsed = parseDice(dice);
  const rolled = parsed ? rollExpression(parsed) : undefined;
  const total = rolled?.total ?? 0;
  const picks = Object.fromEntries(flow.targets.map((id) => [id, "fail" as const]));
  const taken = dealDamage(picks, total, part.type, flow.attackerName);
  const names = new Map(e.combatants.map((c) => [c.id, c.name]));
  const faces = rolled
    ? ` [${rolled.rolls.map((g) => g.join(", ")).join(" + ")}]${signedText(rolled.modifier)}`
    : "";
  const line = `${shown(dice)}${faces} = ${total}${taken.map((t) => ` · ${names.get(t.id) ?? ""} ${t.dealt}`).join("")}`;
  rollFlow.value = { ...flow, lines: [...flow.lines, line], rolls: flow.rolls + 1, last: total };
}

// ---- Campaigns and their parties ----

/** Changes the open campaign and keeps it. */
function updateCampaign(edit: (c: Campaign) => Campaign) {
  const current = campaign.value;
  if (!current) return;
  const next = edit(current);
  campaign.value = next;
  campaigns.value = campaigns.value.map((c) => (c.id === next.id ? next : c));
  void saveCampaign(next);
}

/** Opens another campaign: its own encounters are the ones shown. */
export async function selectCampaign(id: string) {
  await flush();
  const next = campaigns.value.find((c) => c.id === id);
  if (!next) return;
  infoFor.value = undefined;
  turnHistory.length = 0;
  await openCampaign(next);
}

export async function newCampaign(name: string) {
  const fresh = createCampaign(name.trim() || ui("dm.campaign.default"));
  await saveCampaign(fresh);
  campaigns.value = [fresh, ...campaigns.value];
  await selectCampaign(fresh.id);
}

export const renameOpenCampaign = (name: string) => updateCampaign((c) => renameCampaign(c, name));

/** Removes the open campaign with its encounters; they can all be brought back for a few seconds. */
export async function removeCampaign() {
  const gone = campaign.value;
  if (!gone) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const fights = encounters.value.filter((e) => e.campaignId === gone.id);
  for (const f of fights) await deleteEncounter(f.id);
  await deleteCampaign(gone.id);
  encounters.value = encounters.value.filter((e) => e.campaignId !== gone.id);
  let rest = campaigns.value.filter((c) => c.id !== gone.id);
  if (rest.length === 0) {
    const fresh = createCampaign(ui("dm.campaign.default"));
    await saveCampaign(fresh);
    rest = [fresh];
  }
  campaigns.value = rest;
  encounter.value = undefined;
  infoFor.value = undefined;
  turnHistory.length = 0;
  const next = rest[0];
  if (next) await openCampaign(next);
  void refreshEncounterCount();
  offerUndo(ui("dm.campaign.removed", { name: gone.name }), async () => {
    await saveCampaign(gone);
    for (const f of fights) await saveEncounter(f);
    campaigns.value = [gone, ...campaigns.value];
    encounters.value = [...fights, ...encounters.value];
    await openCampaign(gone);
    void refreshEncounterCount();
  });
}

export const addPlayer = () =>
  updateCampaign((c) =>
    addMember(c, newMember({ name: ui("dm.party.newName", { n: c.party.length + 1 }), speed: 30 })),
  );

/** A player taken from a character of this device: their numbers now, and a link to the sheet. */
export async function addPlayerFromCharacter(characterId: string) {
  const stats = await characterStats(characterId);
  if (!stats) return;
  updateCampaign((c) =>
    addMember(
      c,
      newMember({
        name: stats.name,
        maxHp: stats.maxHp,
        ac: stats.ac,
        ...(stats.speed !== undefined && { speed: stats.speed }),
        initiativeBonus: stats.initiativeBonus,
        characterId,
      }),
    ),
  );
}

export const changePlayer = (id: string, change: (m: PartyMember) => PartyMember) =>
  updateCampaign((c) => changeMember(c, id, change));

export const removePlayer = (id: string) => updateCampaign((c) => removeMember(c, id));

/** What stands for a player in the table: the character they were taken from, or their own id. */
const sourceOf = (m: PartyMember) => m.characterId ?? m.id;

/** The players of the open campaign that are not in the open encounter yet. */
export function missingPlayers(): PartyMember[] {
  const inside = new Set(
    (encounter.value?.combatants ?? []).flatMap((c) =>
      c.kind === "character" && c.source ? [c.source] : [],
    ),
  );
  return (campaign.value?.party ?? []).filter((m) => !inside.has(sourceOf(m)));
}

/** Puts players of the party in the open encounter, at the numbers the party gives (a linked sheet adds its defenses). */
export async function addPlayersToFight(ids: readonly string[]) {
  const party = (campaign.value?.party ?? []).filter((m) => ids.includes(m.id));
  const made: Combatant[] = [];
  for (const m of party) {
    const live = m.characterId ? await characterStats(m.characterId) : undefined;
    made.push(
      characterCombatant({
        characterId: sourceOf(m),
        name: m.name,
        hp: m.maxHp,
        maxHp: m.maxHp,
        tempHp: 0,
        ac: m.ac,
        ...(m.speed !== undefined && { speed: m.speed }),
        ...(live?.defenses && { defenses: live.defenses }),
        initiativeBonus: m.initiativeBonus,
      }),
    );
  }
  updateEncounter((e) => {
    const inside = new Set(e.combatants.flatMap((c) => (c.source ? [c.source] : [])));
    return addCombatants(
      e,
      made.filter((c) => !c.source || !inside.has(c.source)),
    );
  });
  for (const m of party) logAdded(m.name, 1);
  partyPrompt.value = false;
  if (startAfterParty.value) beginFight();
}

/** Closes the window that asks who joins; a fight that was being started goes on without the ones left out. */
export function closePartyPrompt() {
  if (!partyPrompt.value) return;
  partyPrompt.value = false;
  if (startAfterParty.value) beginFight();
}

/** Asks which players of the party join the open encounter, if some are missing. */
export function offerParty() {
  if (missingPlayers().length > 0) {
    startAfterParty.value = false;
    partyPrompt.value = true;
  }
}

/** The seats the DM is waiting on for an initiative, while the fight is held back to hear them. */
export const initiativeWait = signal<string[] | undefined>(undefined);
let waitTimer: ReturnType<typeof setTimeout> | undefined;
/** The fight that is being held back. */
let waitFor: string | undefined;
/** How long the start waits for the players' initiative before going on without it. */
const WAIT_MS = 30_000;

/** Really starts the fight: the first turn goes to whoever is first in the order now. */
export function startNow() {
  clearTimeout(waitTimer);
  initiativeWait.value = undefined;
  resetTurnHistory();
  updateEncounter(startCombat);
}

/** The players at the table, here now, whose character has no initiative yet. */
function seatsToAsk(e: Encounter): string[] {
  const players = tableView.value.players;
  const seats = matchSeats(e.combatants, players);
  return e.combatants.flatMap((c) => {
    const seat = seats.get(c.id);
    return seat && c.initiative === undefined && players.find((p) => p.seat === seat)?.online
      ? [seat]
      : [];
  });
}

function beginFight() {
  startAfterParty.value = false;
  const e = encounter.value;
  const seats = e && tableOnline() && onlineSettings.value.askInitiative ? seatsToAsk(e) : [];
  if (!e || seats.length === 0) return startNow();
  // The players at the table are asked by themselves; the fight starts when they have all answered, or after a while.
  askInitiative(seats);
  initiativeWait.value = seats;
  waitFor = e.id;
  clearTimeout(waitTimer);
  waitTimer = setTimeout(() => {
    if (initiativeWait.value && encounter.value?.id === waitFor) startNow();
  }, WAIT_MS);
}

// A player's answer goes into the order, and the last one awaited starts the fight.
onInitiative((seat, value) => {
  const e = encounter.value;
  if (!e) return;
  const id = [...matchSeats(e.combatants, tableView.value.players)].find(
    ([, s]) => s === seat,
  )?.[0];
  if (!id) return;
  editCombatant(id, (c) => ({ ...c, initiative: value }));
  const wait = initiativeWait.value;
  if (!wait?.includes(seat) || waitFor !== e.id) return;
  const rest = wait.filter((s) => s !== seat);
  if (rest.length === 0) startNow();
  else initiativeWait.value = rest;
});

// What a player's card says of their character's numbers goes into the order, so the DM sees them as they are.
onCard((seat, card) => {
  const e = encounter.value;
  if (!e) return;
  const id = [...matchSeats(e.combatants, tableView.value.players)].find(
    ([, s]) => s === seat,
  )?.[0];
  const c = e.combatants.find((x) => x.id === id);
  if (!c) return;
  const same =
    c.hp === card.hp &&
    c.maxHp === card.maxHp &&
    c.tempHp === card.tempHp &&
    c.ac === card.ac &&
    (card.speed === undefined || c.speed === card.speed);
  if (same) return;
  editCombatant(c.id, (x) => ({
    ...x,
    hp: card.hp,
    maxHp: card.maxHp,
    tempHp: card.tempHp,
    ac: card.ac,
    ...(card.speed !== undefined && { speed: card.speed }),
  }));
});

/**
 * Puts a condition on a creature, or takes it off. On a player at the table the condition is a proposal: it
 * goes on the character when they accept (taking it off is the DM's own note: the player's sheet is theirs).
 */
export function toggleConditionOf(c: Combatant, conditionId: string) {
  const e = encounter.value;
  const seat = e && !c.conditions.includes(conditionId) ? onlineSeatOf(e, c) : undefined;
  if (!seat) return editCombatant(c.id, (y) => toggleCondition(y, conditionId));
  const name = content.value?.name(conditionId) ?? conditionId;
  propose(
    seat,
    { kind: "condition", condition: conditionId },
    ui("dm.prop.condition", { name: c.name, condition: name }),
    (accepted) => {
      if (accepted)
        editCombatant(c.id, (y) =>
          y.conditions.includes(conditionId) ? y : toggleCondition(y, conditionId),
        );
    },
  );
}

// The players see the fight as it is: the order, whose turn, how hurt the creatures look.
effect(() => {
  const e = encounter.value;
  const players = tableView.value.players;
  const hide = onlineSettings.value;
  if (e)
    publishTracker(
      trackerViewOf(e, players, {
        order: hide.hideOrder,
        bands: hide.hideBands,
        ...(hide.hideNames && { names: ui("table.unknownCreature") }),
      }),
    );
});

/** Starts the fight; players of the party that are not in it yet are asked about first. */
export function startFight() {
  if (missingPlayers().length > 0) {
    startAfterParty.value = true;
    partyPrompt.value = true;
    return;
  }
  beginFight();
}

/** Ends the fight (no round, no turn); it can be taken back for a few seconds. */
export function endFight() {
  const before = encounter.value;
  if (!before) return;
  resetTurnHistory();
  updateEncounter(endCombat);
  offerUndo(ui("dm.endDone"), () => updateEncounter(() => before));
}

// ---- Checks and saves of a creature ----

/**
 * A check or a saving throw of a creature: a d20 with its bonus, in the way of rolling chosen with the dice
 * (advantage, disadvantage), into the history of rolls. Unlike the player's rolls, nothing of the character
 * open on this device counts (its exhaustion, its Bless).
 */
export function rollForCreature(label: string, bonus: number) {
  const roll = rollD20(bonus, rollMode.value);
  const faces = roll.dice.length > 1 ? `[${roll.dice.join(", ")}] → ${roll.used}` : `${roll.used}`;
  const shown = bonus === 0 ? "" : bonus > 0 ? ` +${bonus}` : ` ${bonus}`;
  addLog({
    label,
    detail: `d20 ${faces}${shown}`,
    total: roll.total,
    ...(roll.critical && { tone: "critical" as const }),
    ...(roll.fumble && { tone: "fumble" as const }),
  });
}
