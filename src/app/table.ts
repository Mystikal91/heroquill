import { signal } from "@preact/signals";
import { uuid } from "../engine/uuid";
import { newCode, newSecret, roomUrl } from "../relay/address";
import { type LinkState, type RelayLink, connectRelay } from "../relay/client";
import { type DmTable, emptyTable, reduceTable, withProposal, withoutSeat } from "../relay/dmTable";
import {
  type ByeReason,
  LIMITS,
  type PlayerCard,
  type Proposal,
  type TrackerView,
} from "../relay/protocol";
import { dbDelete, dbGet, dbPut } from "../storage/db";

/**
 * The DM's table of the open campaign: a room on the relay where the players of the campaign can join with a
 * code. The code and the secret live on this device only (the `meta` store, never in a transfer file); a table
 * is opened again by itself when the campaign is, as long as the room can still be there.
 */

interface SavedTable {
  code: string;
  secret: string;
  /** Last time this device talked to the room: after the room's lifetime it is surely gone. */
  touched: number;
}

const key = (campaignId: string) => `table:${campaignId}`;
const LIFETIME_MS = LIMITS.roomHours * 3_600_000;

/** The code of the open table, if there is one. */
export const tableCode = signal<string | undefined>(undefined);
export const tableState = signal<LinkState>("connecting");
/** Why the room ended the table, when it did. */
export const tableBye = signal<ByeReason | undefined>(undefined);
export const tableView = signal<DmTable>(emptyTable());

let link: RelayLink | undefined;
let wanted: TrackerView | undefined;
let sentView = "";
let initiativeHandler: ((seat: string, value: number) => void) | undefined;
let cardHandler: ((seat: string, card: PlayerCard) => void) | undefined;
/** What to do when a player answers a proposal, by its id. */
const answers = new Map<string, (accepted: boolean) => void>();
let owner: string | undefined;
let lastSaved = 0;

function stop() {
  link?.close();
  link = undefined;
  owner = undefined;
  tableCode.value = undefined;
  tableBye.value = undefined;
  tableView.value = emptyTable();
  sentView = "";
  wanted = undefined;
}

function touch(campaignId: string, saved: SavedTable) {
  const now = Date.now();
  // A message a second would write a lot; the clock only has to be right to the hour.
  if (now - lastSaved < 600_000) return;
  lastSaved = now;
  void dbPut("meta", { ...saved, touched: now }, key(campaignId));
}

function connect(campaignId: string, saved: SavedTable) {
  link?.close();
  owner = campaignId;
  tableCode.value = saved.code;
  tableBye.value = undefined;
  tableState.value = "connecting";
  tableView.value = emptyTable();
  link = connectRelay({
    url: roomUrl(saved.code),
    hello: () => ({ t: "hello", v: 1, role: "dm", secret: saved.secret }),
    heartbeatMs: 45_000,
    onState: (state, bye) => {
      if (owner !== campaignId) return;
      tableState.value = state;
      if (state === "ended") {
        tableBye.value = bye;
        // A closed or lost table is not to be opened again by itself.
        if (bye !== "replaced") void dbDelete("meta", key(campaignId));
      }
    },
    onMessage: (msg) => {
      if (owner !== campaignId) return;
      tableView.value = reduceTable(tableView.value, msg, Date.now());
      // The room keeps the last view, but a room that came back empty is told again.
      if (msg.t === "welcome") {
        sentView = "";
        if (wanted) publishTracker(wanted);
      }
      if (msg.t === "initiative") initiativeHandler?.(msg.seat, msg.value);
      if (msg.t === "card") cardHandler?.(msg.seat, msg.card);
      if (msg.t === "welcome")
        for (const p of msg.players) if (p.card) cardHandler?.(p.seat, p.card);
      if (msg.t === "answer") answers.get(msg.id)?.(msg.accepted);
      if (msg.t === "answer" || msg.t === "undelivered") answers.delete(msg.id);
      touch(campaignId, saved);
    },
  });
}

/** Called when a campaign opens: leaves the table of the one before and takes up this one's, if it has one. */
export async function switchTable(campaignId: string) {
  if (owner === campaignId) return;
  stop();
  const saved = await dbGet<SavedTable>("meta", key(campaignId));
  if (!saved || Date.now() - saved.touched > LIFETIME_MS) {
    if (saved) void dbDelete("meta", key(campaignId));
    return;
  }
  connect(campaignId, saved);
}

/** Opens a table for the campaign with a new code. */
export async function openTable(campaignId: string) {
  stop();
  const saved: SavedTable = { code: newCode(), secret: newSecret(), touched: Date.now() };
  lastSaved = saved.touched;
  await dbPut("meta", saved, key(campaignId));
  connect(campaignId, saved);
}

/** Closes the table for everyone: the room is deleted and the players are told. */
export async function closeTable(campaignId: string) {
  if (owner === campaignId) {
    link?.send({ t: "close" });
    // Give the message a moment to leave before the line is shut.
    await new Promise((r) => setTimeout(r, 150));
    stop();
  }
  await dbDelete("meta", key(campaignId));
}

/** Sends a player away: their seat is gone and the room turns their token down. */
export const kickPlayer = (seat: string) => {
  if (link?.send({ t: "kick", seat })) tableView.value = withoutSeat(tableView.value, seat);
};

/** Asks the players for their initiative (the ones given, or everybody). */
export const askInitiative = (seats?: string[]) =>
  link?.send(seats ? { t: "askInitiative", seats } : { t: "askInitiative" });

/** Who answers when a player gives their initiative: the DM page puts the combatant's number in. */
export function onInitiative(handler: (seat: string, value: number) => void) {
  initiativeHandler = handler;
}

/** Whether the table is up, so a message can be sent now. */
export const tableOnline = () => link?.state() === "online";

/**
 * Shows the players the fight as it is now. Only a change is sent, and the last view is kept to be sent again
 * when the line comes back.
 */
export function publishTracker(view: TrackerView) {
  wanted = view;
  const text = JSON.stringify(view);
  if (text === sentView || !link) return;
  if (link.send({ t: "tracker", view })) sentView = text;
}

/** What to do with a player's card: the DM page keeps its numbers for that character in step. */
export function onCard(handler: (seat: string, card: PlayerCard) => void) {
  cardHandler = handler;
}

/** Whether a player is here now: a proposal only goes to someone who is. */
export const seatOnline = (seat: string) =>
  tableOnline() && tableView.value.players.some((p) => p.seat === seat && p.online);

/**
 * Asks a player to do something on their own sheet. Nothing changes until they accept; `done` hears the answer
 * (false when it did not reach them). The list of the table shows what is waiting and what came of it.
 */
export function propose(
  seat: string,
  proposal: Proposal,
  label: string,
  done?: (accepted: boolean) => void,
): boolean {
  const id = uuid().slice(0, 12);
  if (!link?.send({ t: "propose", seat, id, proposal })) return false;
  if (done) answers.set(id, done);
  tableView.value = withProposal(tableView.value, { id, seat, label, status: "waiting" });
  return true;
}
