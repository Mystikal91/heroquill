import { effect, signal } from "@preact/signals";
import { currentHp } from "../engine/play";
import { toggleCondition } from "../engine/play";
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
import { beastArmorClass } from "../ui/play/beastArmorClass";
import { askConfirm } from "./confirm";
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
  return makeCard({
    name: character.value.name.trim() || ui("table.defaultName"),
    hp: shape ? shape.hp : currentHp(play, s.hitPoints.max),
    maxHp: shape ? shape.max : s.hitPoints.max,
    tempHp: shape ? 0 : play.tempHp,
    ac: beastAc ?? s.armorClass.value,
    ...(s.speed !== undefined && { speed: s.speed }),
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

const queue: { id: string; proposal: Proposal }[] = [];
let asking = false;
/** More than this at once is a flood, not a game: the rest are dropped. */
const MAX_QUEUE = 20;

function describe(p: Proposal): string {
  const from = ("from" in p && p.from) || ui("table.proposal.dm");
  switch (p.kind) {
    case "damage":
      return p.type
        ? ui("table.proposal.damageTyped", { from, amount: p.amount, type: damageName(p.type) })
        : ui("table.proposal.damage", { from, amount: p.amount });
    case "condition":
      return ui("table.proposal.condition", {
        from,
        condition: content.value?.name(p.condition) ?? p.condition,
      });
    case "say":
      return ui("table.proposal.say", { text: p.text });
    case "roll": {
      const c = content.value;
      const ability = c?.name(`srd51:ability/${p.ability}`) ?? p.ability;
      const what = p.skill
        ? ui("table.proposal.rollSkill", { skill: c?.name(p.skill) ?? p.skill })
        : ui(p.test === "save" ? "table.proposal.rollSave" : "table.proposal.rollCheck", {
            ability,
          });
      const dc = p.dc !== undefined ? ui("table.proposal.dc", { dc: p.dc }) : "";
      return ui("table.proposal.rollAsk", { from, what, dc });
    }
  }
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
  else if (p.kind === "condition")
    changePlay((play) =>
      play.conditions.includes(p.condition) ? play : toggleCondition(play, p.condition),
    );
}

/** Asks about the proposals one at a time (a second question would cancel the first); nothing happens without a yes. */
async function drain() {
  if (asking) return;
  asking = true;
  try {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { id, proposal } = next;
      const say = proposal.kind === "say";
      const yes = await askConfirm({
        title: describe(proposal),
        confirm: ui(
          say
            ? "table.proposal.ok"
            : proposal.kind === "roll"
              ? "table.proposal.roll"
              : "table.proposal.accept",
        ),
        cancel: ui(say ? "table.proposal.ok" : "table.proposal.decline"),
      });
      // A line of text only needs reading; the rest need a yes.
      const accepted = say || yes;
      let result: number | undefined;
      if (accepted && proposal.kind === "roll") result = rollAsked(proposal);
      else if (accepted) apply(proposal);
      link?.send({ t: "answer", id, accepted, ...(result !== undefined && { result }) });
    }
  } finally {
    asking = false;
  }
}
