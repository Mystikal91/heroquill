import { computed, effect, signal } from "@preact/signals";
import * as v from "valibot";
import { EffectSchema } from "../data/schema";
import {
  addProposedEffect,
  currentHp,
  customRoundsKey,
  setRounds,
  toggleCondition,
} from "../engine/play";
import { beastPool } from "../engine/wildShape";
import { ui } from "../i18n/ui";
import { roomUrl } from "../relay/address";
import { type LinkState, type RelayLink, connectRelay } from "../relay/client";
import { makeCard, sameCard } from "../relay/playerCard";
import {
  type ByeReason,
  CODE_LENGTH,
  type PlayerCard,
  type Proposal,
  type ServerMessage,
  type TrackerView,
  normaliseCode,
} from "../relay/protocol";
import { damageName } from "../ui/damageName";
import { movementLines } from "../ui/movementLines";
import { damageEffectRows } from "../ui/play/DamageEffects";
import { beastArmorClass } from "../ui/play/beastArmorClass";
import { changePlay, damageCharacter, rollCheck, rollLog } from "./play";
import { character, content, sheet } from "./store";

/**
 * The player's side of the online table. The device keeps the code, the seat and the token of the table it joined
 * (`localStorage`, this device only), joins again by itself when the app opens, and sends the DM two things and
 * only two: a small card (name, hit points, armor class, speed, conditions) whenever it changes, and the rolls
 * made here, unless the person turns that off. Nothing comes back from the DM except the fight's order.
 */

interface Saved {
  code: string;
  seat?: string;
  token?: string;
}

const KEY = "playerTable";

const read = (): Saved | undefined => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Saved | null;
    return raw && typeof raw.code === "string" ? raw : undefined;
  } catch {
    return undefined;
  }
};
const write = (saved: Saved | undefined) => {
  try {
    if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
    else localStorage.removeItem(KEY);
  } catch {
    // Without storage the table works until the page is closed.
  }
};

/** The code of the table this device is at, if any. */
export const joinedCode = signal<string | undefined>(read()?.code);
export const playerState = signal<LinkState>("connecting");
/** Why the room sent the player away, when it did. */
export const playerBye = signal<ByeReason | undefined>(undefined);
export const dmOnline = signal(false);
export const trackerView = signal<TrackerView | undefined>(undefined);
export const initiativeAsked = signal(false);

/** The lines the DM sent, newest first; `read` once the player has seen them (the DM learns it then). */
export const dmMessages = signal<{ id: string; text: string; at: number; read: boolean }[]>([]);
const MAX_DM_MESSAGES = 10;
/** The lines this player sent to the DM, newest first, so the panel reads as a conversation. */
export const sentMessages = signal<{ text: string; at: number }[]>([]);
/** The seat this device holds at the table: the order of the fight marks it as "you". */
export const mySeat = signal<string | undefined>(read()?.seat);

/** Lines of the DM not read yet. */
export const unreadFromDm = computed(() => dmMessages.value.filter((m) => !m.read).length);

/** It is this player's turn in the DM's fight. */
export const myTurn = computed(() => {
  const view = trackerView.value;
  const seat = mySeat.value;
  if (!view || !seat || view.round === 0) return false;
  return view.order.some((c) => c.id === view.turn && c.seat === seat);
});

let link: RelayLink | undefined;
let stopWatching: (() => void) | undefined;
let lastCard: PlayerCard | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

/** The card as the sheet says it now, or nothing until there is a sheet. */
export function currentCard(): PlayerCard | undefined {
  const s = sheet.value;
  const c = content.value;
  if (!s || !c) return undefined;
  const play = character.value.play;
  const shape = beastPool(play);
  const beastAc = beastArmorClass(c, play);
  const caster = s.spellcasters[0];
  const passive = (slug: string) => {
    const skill = s.skills.find((k) => k.id === `${character.value.ruleset}:skill/${slug}`);
    return skill ? 10 + skill.bonus : undefined;
  };
  const investigation = passive("investigation");
  const insight = passive("insight");
  return makeCard({
    name: character.value.name.trim() || ui("table.defaultName"),
    cls: character.value.classes.map((k) => `${c.name(k.classId)} ${k.level}`).join(" / "),
    hp: shape ? shape.hp : currentHp(play, s.hitPoints.max),
    maxHp: shape ? shape.max : s.hitPoints.max,
    tempHp: shape ? 0 : play.tempHp,
    ac: beastAc ?? s.armorClass.value,
    ...(s.speed !== undefined && { speed: s.speed }),
    initiativeBonus: s.initiative,
    passivePerception: s.passivePerception,
    ...(investigation !== undefined && { passiveInvestigation: investigation }),
    ...(insight !== undefined && { passiveInsight: insight }),
    proficiency: s.proficiencyBonus,
    martialDc: s.martialSaveDc,
    ...(caster && { spellDc: caster.saveDc, spellAttack: caster.attackBonus }),
    critRange: s.critRange,
    attunedUsed: s.attunement.used,
    attunedMax: s.attunement.max,
    senses: movementLines(s.movement, s.senses),
    defenses: damageEffectRows(),
    active: [
      ...(play.customEffects ?? [])
        .filter((e) => !e.off)
        .map((e) => {
          const rounds = play.rounds?.[customRoundsKey(e.id)];
          return { name: e.name, ...(rounds !== undefined && { rounds }) };
        }),
      ...(play.activeSpells ?? []).map((id) => ({ name: c.name(id) })),
    ],
    conditions: [
      ...play.conditions.map((id) => c.name(id)),
      ...(play.concentration
        ? [ui("table.concentrating", { spell: c.name(play.concentration) })]
        : []),
    ],
  });
}

function sendCard(force = false) {
  const card = currentCard();
  if (!card || !link) return;
  if (!force && sameCard(lastCard, card)) return;
  if (link.send({ t: "card", card })) lastCard = card;
}

/** Watches the sheet and the roll history while the line is up: a short wait first, so a flurry of changes is one card. */
function watch() {
  stopWatching?.();
  let seen = rollLog.peek()[0]?.id ?? 0;
  stopWatching = effect(() => {
    // Reading these makes the effect run again when they change.
    const card = currentCard();
    const log = rollLog.value;
    if (card) {
      clearTimeout(timer);
      timer = setTimeout(() => sendCard(), 400);
    }
    const fresh = log.filter((e) => e.id > seen).reverse();
    if (fresh.length === 0) return;
    seen = log[0]?.id ?? seen;
    for (const e of fresh)
      link?.send({
        t: "roll",
        roll: {
          label: e.label,
          detail: e.detail,
          ...(e.total !== undefined && { total: e.total }),
          ...(e.tone && { tone: e.tone }),
        },
      });
  });
}

function onMessage(saved: Saved, msg: ServerMessage) {
  switch (msg.t) {
    case "welcome":
      write({
        code: saved.code,
        ...(msg.seat && { seat: msg.seat }),
        ...(msg.token && { token: msg.token }),
      });
      saved.seat = msg.seat;
      saved.token = msg.token;
      mySeat.value = msg.seat;
      dmOnline.value = msg.dmOnline;
      trackerView.value = msg.tracker;
      lastCard = undefined;
      sendCard(true);
      watch();
      break;
    case "dm":
      dmOnline.value = msg.online;
      break;
    case "tracker":
      trackerView.value = msg.view;
      break;
    case "askInitiative":
      initiativeAsked.value = true;
      break;
    case "proposal":
      if (queue.length < MAX_QUEUE) queue.push({ id: msg.id, proposal: msg.proposal });
      void drain();
      break;
    default:
      break;
  }
}

function connect(saved: Saved) {
  link?.close();
  stopWatching?.();
  stopWatching = undefined;
  playerBye.value = undefined;
  playerState.value = "connecting";
  dmOnline.value = false;
  joinedCode.value = saved.code;
  link = connectRelay({
    url: roomUrl(saved.code),
    hello: () => ({
      t: "hello",
      v: 1,
      role: "player",
      name: character.value.name.trim().slice(0, 80) || ui("table.defaultName"),
      ...(saved.seat && saved.token && { seat: saved.seat, token: saved.token }),
    }),
    onState: (state, bye) => {
      playerState.value = state;
      if (state === "ended") {
        playerBye.value = bye;
        stopWatching?.();
        stopWatching = undefined;
        write(undefined);
      }
    },
    onMessage: (msg) => onMessage(saved, msg),
  });
}

/** Joins the table with a code the DM gave; false when the code cannot be one. */
export function joinTable(typed: string): boolean {
  const code = normaliseCode(typed);
  if (!code || code.length !== CODE_LENGTH) return false;
  const old = read();
  // The same table keeps its seat; another one starts fresh.
  const saved: Saved = old && old.code === code ? old : { code };
  write(saved);
  connect(saved);
  return true;
}

/** Joins again the table this device was at (the app was closed, or the page reloaded). */
export function resumeTable() {
  if (link) return;
  const saved = read();
  if (saved) connect(saved);
}

/** Leaves the table: the seat is dropped here and the line closed (the DM sees the player go). */
export function leaveTable() {
  link?.close();
  link = undefined;
  stopWatching?.();
  stopWatching = undefined;
  clearTimeout(timer);
  write(undefined);
  joinedCode.value = undefined;
  trackerView.value = undefined;
  initiativeAsked.value = false;
  playerBye.value = undefined;
  dmOnline.value = false;
  mySeat.value = undefined;
  sentMessages.value = [];
  dmMessages.value = [];
  tableRequest.value = undefined;
}

/** The DM asked for the initiative: roll it as the quick strip does and send the total. */
export function answerInitiative() {
  const s = sheet.value;
  if (!s) return;
  const roll = rollCheck(ui("play.initiative"), s.initiative, undefined, undefined, "check", "dex");
  link?.send({ t: "initiative", value: roll.total });
  initiativeAsked.value = false;
}

// ---- What the DM proposes ----

/** What the DM asks of the player now, shown in a card of its own: a roll, damage or a condition. */
export interface TableRequest {
  proposal: Exclude<Proposal, { kind: "say" }>;
  /** Who asks: the DM, or a creature of the DM ("The goblin"). */
  from: string;
  /** What is asked, in a few words ("A Wisdom saving throw", "7 fire damage"). */
  what: string;
  /** For a roll: the player's own bonus, and once rolled the total and whether it beat the difficulty. */
  bonus?: number;
  outcome?: { total: number; success?: boolean };
}

export const tableRequest = signal<TableRequest | undefined>(undefined);

const queue: { id: string; proposal: Proposal }[] = [];
let asking = false;
/** More than this at once is a flood, not a game: the rest are dropped. */
const MAX_QUEUE = 20;
/** The answer the card of the request waits for. */
let settle: ((yes: boolean) => void) | undefined;

const abilityName = (ability: string) => content.value?.name(`srd51:ability/${ability}`) ?? ability;

const forRounds = (rounds: number | undefined) =>
  rounds === undefined ? "" : ` ${ui("table.proposal.rounds", { n: rounds })}`;

/** The name of a condition the DM proposed: the player's own word for it when they have it, else the DM's. */
function conditionLabel(p: Extract<Proposal, { kind: "condition" }>): string {
  const c = content.value;
  return (c?.index.has(p.condition) ? c.name(p.condition) : undefined) ?? p.name ?? p.condition;
}

/** What a request asks, in a few words, for the title of its card. */
function whatOf(p: Exclude<Proposal, { kind: "say" }>): string {
  switch (p.kind) {
    case "damage":
      return p.type
        ? ui("table.req.damageTyped", { amount: p.amount, type: damageName(p.type) })
        : ui("table.req.damage", { amount: p.amount });
    case "condition":
      return ui("table.req.condition", { condition: conditionLabel(p) }) + forRounds(p.rounds);
    case "effect":
      return ui("table.req.effect", { effect: p.name }) + forRounds(p.rounds);
    case "roll":
      return p.skill
        ? ui("table.req.rollSkill", { skill: content.value?.name(p.skill) ?? p.skill })
        : ui(p.test === "save" ? "table.req.rollSave" : "table.req.rollCheck", {
            ability: abilityName(p.ability),
          });
  }
}

/** The bonus the player rolls with for what the DM asked, on their own numbers. */
function askedBonus(p: Extract<Proposal, { kind: "roll" }>): number | undefined {
  const s = sheet.value;
  if (!s) return undefined;
  if (p.skill) return s.skills.find((k) => k.id === p.skill)?.bonus;
  return p.test === "save" ? s.saves[p.ability].bonus : s.abilities[p.ability].modifier;
}

/** Rolls what the DM asked for, on the player's own numbers, and gives the total. */
function rollAsked(p: Extract<Proposal, { kind: "roll" }>): number | undefined {
  const s = sheet.value;
  const c = content.value;
  if (!s || !c) return undefined;
  const name = c.name(`srd51:ability/${p.ability}`);
  if (p.skill) {
    const skill = s.skills.find((k) => k.id === p.skill);
    if (!skill) return undefined;
    return rollCheck(
      c.name(skill.id),
      skill.bonus,
      skill.proficient && s.proficientSkillFloor ? { floor: s.proficientSkillFloor } : undefined,
      true,
      undefined,
      skill.ability,
    ).total;
  }
  if (p.test === "save")
    return rollCheck(
      `${name} - ${ui("sheet.savingThrow")}`,
      s.saves[p.ability].bonus,
      undefined,
      undefined,
      "save",
      p.ability,
    ).total;
  return rollCheck(name, s.abilities[p.ability].modifier, undefined, true, "check", p.ability)
    .total;
}

/** Does what the player accepted, on their own sheet. */
function apply(p: Proposal) {
  if (p.kind === "damage") damageCharacter(p.amount);
  else if (p.kind === "condition") {
    // A condition this device has is the rules' own, with its rounds; one it does not have (a homebrew the DM owns)
    // becomes an effect with its name, which the Active effects panel shows and the rounds end.
    if (content.value?.index.has(p.condition))
      changePlay((play) =>
        play.conditions.includes(p.condition)
          ? play
          : setRounds(toggleCondition(play, p.condition), p.condition, p.rounds),
      );
    else
      changePlay((play) =>
        addProposedEffect(play, {
          name: conditionLabel(p),
          effects: [],
          ...(p.rounds !== undefined && { rounds: p.rounds }),
        }),
      );
  } else if (p.kind === "effect") {
    // What it changes is read like any effect of the rules: what does not fit is left out, and the name stays.
    const parsed = v.safeParse(v.array(EffectSchema), p.effects ?? []);
    changePlay((play) =>
      addProposedEffect(play, {
        name: p.name,
        ...(p.note && { note: p.note }),
        effects: parsed.success ? parsed.output : [],
        ...(p.rounds !== undefined && { rounds: p.rounds }),
      }),
    );
  }
}

/** The player answered the card of a request: yes (accept, or roll) or no (ignore). */
export function answerRequest(yes: boolean) {
  const done = settle;
  settle = undefined;
  done?.(yes);
}

/** A line of the DM is not a question: it waits in the list and the DM learns it was read when it is seen. */
function heard(id: string, text: string) {
  dmMessages.value = [{ id, text, at: Date.now(), read: false }, ...dmMessages.value].slice(
    0,
    MAX_DM_MESSAGES,
  );
}

/** The player has seen the lines of the DM (the notice was closed, or the panel opened): the DM sees "read". */
export function readDmMessages() {
  const unread = dmMessages.value.filter((m) => !m.read);
  if (unread.length === 0) return;
  for (const m of unread) link?.send({ t: "answer", id: m.id, accepted: true });
  dmMessages.value = dmMessages.value.map((m) => (m.read ? m : { ...m, read: true }));
}

/**
 * Shows the requests one at a time in their card; nothing happens without a yes. A roll stays on the card with its
 * total and whether it beat the difficulty, until the player closes it.
 */
async function drain() {
  if (asking) return;
  asking = true;
  try {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { id, proposal } = next;
      if (proposal.kind === "say") {
        heard(id, proposal.text);
        continue;
      }
      const from = ("from" in proposal && proposal.from) || ui("table.proposal.dm");
      const bonus = proposal.kind === "roll" ? askedBonus(proposal) : undefined;
      const request: TableRequest = {
        proposal,
        from,
        what: whatOf(proposal),
        ...(bonus !== undefined && { bonus }),
      };
      const yes = await new Promise<boolean>((resolve) => {
        settle = resolve;
        tableRequest.value = request;
      });
      let result: number | undefined;
      if (yes && proposal.kind === "roll") result = rollAsked(proposal);
      else if (yes) apply(proposal);
      link?.send({ t: "answer", id, accepted: yes, ...(result !== undefined && { result }) });
      if (yes && proposal.kind === "roll" && result !== undefined) {
        const success = proposal.dc === undefined ? undefined : result >= proposal.dc;
        await new Promise<boolean>((resolve) => {
          settle = resolve;
          tableRequest.value = {
            ...request,
            outcome: { total: result, ...(success !== undefined && { success }) },
          };
        });
      }
      tableRequest.value = undefined;
    }
  } finally {
    asking = false;
  }
}

/** A line from the player to the DM alone; false when the line is not up. */
export function tellDm(text: string): boolean {
  const line = text.trim().slice(0, 400);
  const sent = line.length > 0 && Boolean(link?.send({ t: "say", text: line }));
  if (sent)
    sentMessages.value = [{ text: line, at: Date.now() }, ...sentMessages.value].slice(0, 10);
  return sent;
}

/** Something waits for the player at the table: their turn, the initiative asked, a request. */
export const tableAttention = computed(
  () => initiativeAsked.value || myTurn.value || tableRequest.value !== undefined,
);
