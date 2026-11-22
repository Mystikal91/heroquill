import type { PlayerCard, PlayerInfo, ServerMessage, SharedRoll } from "./protocol";

/** What the DM's screen knows about the table: who is there, their last card, the rolls they shared. */
export interface TablePlayer {
  seat: string;
  name: string;
  online: boolean;
  card?: PlayerCard;
  /** The number the player gave when asked for the initiative. */
  initiative?: number;
}

export interface TableRoll {
  seat: string;
  name: string;
  roll: SharedRoll;
  at: number;
}

/** What the DM asked of a player, and what came of it. */
export interface ProposalRecord {
  id: string;
  seat: string;
  /** The line the DM reads ("Aria: 7 fire damage"). */
  label: string;
  status: "waiting" | "accepted" | "declined" | "undelivered";
  /** The difficulty of a roll that was asked for, and the total the player rolled. */
  dc?: number;
  result?: number;
}

export interface DmTable {
  players: TablePlayer[];
  rolls: TableRoll[];
  proposals: ProposalRecord[];
}

export const MAX_PROPOSALS = 12;

export const MAX_SHARED_ROLLS = 30;

export const emptyTable = (): DmTable => ({ players: [], rolls: [], proposals: [] });

/** A proposal just sent: newest first, the oldest dropped. */
export const withProposal = (table: DmTable, record: ProposalRecord): DmTable => ({
  ...table,
  proposals: [record, ...table.proposals].slice(0, MAX_PROPOSALS),
});

const settle = (
  table: DmTable,
  id: string,
  status: ProposalRecord["status"],
  result?: number,
): DmTable => ({
  ...table,
  proposals: table.proposals.map((p) =>
    p.id === id ? { ...p, status, ...(result !== undefined && { result }) } : p,
  ),
});

const upsert = (players: TablePlayer[], seat: string, change: (p: TablePlayer) => TablePlayer) =>
  players.some((p) => p.seat === seat)
    ? players.map((p) => (p.seat === seat ? change(p) : p))
    : [...players, change({ seat, name: "", online: false })];

/** The table after a message from the room (pure: the clock is given). */
export function reduceTable(table: DmTable, msg: ServerMessage, now: number): DmTable {
  switch (msg.t) {
    case "welcome":
      return {
        // A welcome is the whole picture: keep the numbers the DM already had for a player still here.
        players: msg.players.map((p: PlayerInfo) => ({
          seat: p.seat,
          name: p.name,
          online: p.online,
          ...(p.card && { card: p.card }),
          ...(table.players.find((x) => x.seat === p.seat)?.initiative !== undefined && {
            initiative: table.players.find((x) => x.seat === p.seat)?.initiative,
          }),
        })),
        rolls: table.rolls,
        proposals: table.proposals,
      };
    case "presence":
      return {
        ...table,
        players: upsert(table.players, msg.seat, (p) => ({
          ...p,
          name: msg.name || p.name,
          online: msg.online,
        })),
      };
    case "card":
      return {
        ...table,
        players: upsert(table.players, msg.seat, (p) => ({ ...p, card: msg.card })),
      };
    case "initiative":
      return {
        ...table,
        players: upsert(table.players, msg.seat, (p) => ({ ...p, initiative: msg.value })),
      };
    case "roll": {
      const name = table.players.find((p) => p.seat === msg.seat)?.name ?? "";
      return {
        ...table,
        rolls: [{ seat: msg.seat, name, roll: msg.roll, at: now }, ...table.rolls].slice(
          0,
          MAX_SHARED_ROLLS,
        ),
      };
    }
    case "answer":
      return settle(table, msg.id, msg.accepted ? "accepted" : "declined", msg.result);
    case "undelivered":
      return settle(table, msg.id, "undelivered");
    default:
      return table;
  }
}

/** A player leaves the table for good (kicked): gone from the list. */
export const withoutSeat = (table: DmTable, seat: string): DmTable => ({
  ...table,
  players: table.players.filter((p) => p.seat !== seat),
});
