import { signal } from "@preact/signals";
import { newCode, newSecret, roomUrl } from "../relay/address";
import { type LinkState, type RelayLink, connectRelay } from "../relay/client";
import { type DmTable, emptyTable, reduceTable, withoutSeat } from "../relay/dmTable";
import { type ByeReason, LIMITS } from "../relay/protocol";
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
let owner: string | undefined;
let lastSaved = 0;

function stop() {
  link?.close();
  link = undefined;
  owner = undefined;
  tableCode.value = undefined;
  tableBye.value = undefined;
  tableView.value = emptyTable();
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
