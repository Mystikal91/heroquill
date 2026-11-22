import { effect, signal } from "@preact/signals";
import { currentHp } from "../engine/play";
import { beastPool } from "../engine/wildShape";
import { ui } from "../i18n/ui";
import { roomUrl } from "../relay/address";
import { type LinkState, type RelayLink, connectRelay } from "../relay/client";
import { makeCard, sameCard } from "../relay/playerCard";
import {
  type ByeReason,
  CODE_LENGTH,
  type PlayerCard,
  type ServerMessage,
  type TrackerView,
  normaliseCode,
} from "../relay/protocol";
import { beastArmorClass } from "../ui/play/beastArmorClass";
import { rollCheck, rollLog } from "./play";
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
const ROLLS_KEY = "playerTableRolls";

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

export const shareRolls = signal(
  (() => {
    try {
      return localStorage.getItem(ROLLS_KEY) !== "off";
    } catch {
      return true;
    }
  })(),
);

export function setShareRolls(on: boolean) {
  shareRolls.value = on;
  try {
    localStorage.setItem(ROLLS_KEY, on ? "on" : "off");
  } catch {
    // A choice for this visit only.
  }
}

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
    if (!shareRolls.peek()) return;
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
