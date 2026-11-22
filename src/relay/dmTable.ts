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
  /** What was asked: a line of text is "read", not "accepted". */
  kind?: "damage" | "condition" | "say" | "roll";
  /** The difficulty of a roll that was asked for, and the total the player rolled. */
  dc?: number;
  result?: number;
  /** A line of text sent: the words alone, without the name in front. */
  text?: string;
  /** When it was sent and when the answer came (the clock of the DM's device). */
  at?: number;
  answeredAt?: number;
}

/** A line a player wrote to the DM. */
export interface TableMessage {
  seat: string;
  name: string;
  text: string;
  at: number;
}

export interface DmTable {
  players: TablePlayer[];
  rolls: TableRoll[];
  proposals: ProposalRecord[];
  messages: TableMessage[];
}

export const MAX_MESSAGES = 30;

export const MAX_PROPOSALS = 12;

export const MAX_SHARED_ROLLS = 30;

export const emptyTable = (): DmTable => ({ players: [], rolls: [], proposals: [], messages: [] });

/** A proposal just sent: newest first, the oldest dropped. */
export const withProposal = (table: DmTable, record: ProposalRecord): DmTable => ({
  ...table,
  proposals: [record, ...table.proposals].slice(0, MAX_PROPOSALS),
});

const settle = (
  table: DmTable,
  id: string,
  status: ProposalRecord["status"],
  now: number,
  result?: number,
): DmTable => ({
  ...table,
  proposals: table.proposals.map((p) =>
    p.id === id ? { ...p, status, answeredAt: now, ...(result !== undefined && { result }) } : p,
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
        messages: table.messages,
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
      return settle(table, msg.id, msg.accepted ? "accepted" : "declined", now, msg.result);
    case "undelivered":
      return settle(table, msg.id, "undelivered", now);
    case "say": {
      const name = table.players.find((p) => p.seat === msg.seat)?.name ?? "";
      return {
        ...table,
        messages: [{ seat: msg.seat, name, text: msg.text, at: now }, ...table.messages].slice(
          0,
          MAX_MESSAGES,
        ),
      };
    }
    default:
      return table;
  }
}

/** A player leaves the table for good (kicked): gone from the list. */
export const withoutSeat = (table: DmTable, seat: string): DmTable => ({
  ...table,
  players: table.players.filter((p) => p.seat !== seat),
});

/** One line of what happened at the table, for the DM's list: a roll, a line from a player, or what the DM asked. */
export type TableActivity =
  | { kind: "roll"; at: number; roll: TableRoll }
  | { kind: "message"; at: number; message: TableMessage }
  | { kind: "proposal"; at: number; proposal: ProposalRecord };

/** How far apart the answer to a roll that was asked for and the same roll shared by the player can be. */
const SAME_ROLL_MS = 5000;

/**
 * Everything that happened at the table in one list, newest first. A roll the DM asked for comes twice (as the
 * answer, with its difficulty, and as a roll the player shares): only the answer stays.
 */
export function tableActivity(table: DmTable): TableActivity[] {
  const answered = table.proposals.filter(
    (p) => p.kind === "roll" && p.result !== undefined && p.answeredAt !== undefined,
  );
  const echo = (r: TableRoll) =>
    answered.some(
      (p) =>
        p.seat === r.seat &&
        p.result === r.roll.total &&
        Math.abs((p.answeredAt ?? 0) - r.at) <= SAME_ROLL_MS,
    );
  const items: TableActivity[] = [
    ...table.rolls
      .filter((r) => !echo(r))
      .map((roll) => ({ kind: "roll" as const, at: roll.at, roll })),
    ...table.messages.map((message) => ({ kind: "message" as const, at: message.at, message })),
    ...table.proposals.map((proposal) => ({
      kind: "proposal" as const,
      at: proposal.answeredAt ?? proposal.at ?? 0,
      proposal,
    })),
  ];
  return items.sort((a, b) => b.at - a.at);
}
