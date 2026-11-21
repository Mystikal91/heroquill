import {
  type ByeReason,
  type ClientMessage,
  LIMITS,
  PROTOCOL_VERSION,
  type PlayerCard,
  type PlayerInfo,
  type ServerMessage,
  type TrackerView,
} from "./protocol";

/**
 * What a room is and how it answers, with no sockets and no storage: the Durable Object of the relay is a
 * thin shell around these functions, so every rule can be tested here with plain objects.
 *
 * The room keeps the seats (a name, a token that gives the seat back after a reconnection, the last card),
 * the last tracker the DM published, and when anything last happened. It is not the authority on the fight:
 * the DM's browser is.
 */

export interface Seat {
  token: string;
  name: string;
  card?: PlayerCard;
}

export interface RoomState {
  /** The SHA-256 of the DM's secret: the room can tell the DM from anybody, and cannot be the DM. */
  secretHash: string;
  created: number;
  lastActive: number;
  seats: Record<string, Seat>;
  nextSeat: number;
  tracker?: TrackerView;
}

/** Who a socket is, once it has said hello. */
export type Who = { role: "dm" } | { role: "player"; seat: string };

export type Target = "self" | "dm" | "players" | { seat: string };

export interface Out {
  to: Target;
  msg: ServerMessage;
}

/** What the shell knows that the room does not keep: the time, new tokens, who is connected. */
export interface Env {
  now: number;
  /** The SHA-256 of the secret in a DM's hello, worked out by the shell (the logic does no hashing). */
  secretHash?: string;
  newToken: () => string;
  online: { dm: boolean; seats: ReadonlySet<string> };
}

/** Sockets to close: the old one of a seat or of the DM that a new one replaces, or all of them. */
export type Drop = { dm: true } | { seat: string } | { all: true };

export interface Step {
  /** The room after the message; undefined when it is gone (the DM closed it). */
  state: RoomState | undefined;
  who?: Who;
  out: Out[];
  /** Close the socket that sent the message, with this reason. */
  bye?: ByeReason;
  drop?: { reason: ByeReason; targets: Drop[] };
  /** The state changed in a way that is worth saving. */
  dirty: boolean;
}

const bye = (state: RoomState | undefined, reason: ByeReason): Step => ({
  state,
  out: [],
  bye: reason,
  dirty: false,
});

const infoOf = (state: RoomState, online: ReadonlySet<string>, withCards: boolean): PlayerInfo[] =>
  Object.entries(state.seats).map(([seat, s]) => ({
    seat,
    name: s.name,
    online: online.has(seat),
    ...(withCards && s.card && { card: s.card }),
  }));

export const isExpired = (state: RoomState, now: number) =>
  now - state.lastActive >= LIMITS.roomHours * 3_600_000;

/** A message from a socket that has not said hello: the DM opens a room, a player joins one. */
function hello(
  state: RoomState | undefined,
  msg: Extract<ClientMessage, { t: "hello" }>,
  env: Env,
): Step {
  if (msg.role === "dm") {
    if (!env.secretHash) return bye(state, "bad-message");
    const room: RoomState = state ?? {
      secretHash: env.secretHash,
      created: env.now,
      lastActive: env.now,
      seats: {},
      nextSeat: 1,
    };
    if (room.secretHash !== env.secretHash) return bye(state, "bad-secret");
    const next = { ...room, lastActive: env.now };
    return {
      state: next,
      who: { role: "dm" },
      out: [
        {
          to: "self",
          msg: {
            t: "welcome",
            v: PROTOCOL_VERSION,
            role: "dm",
            players: infoOf(next, env.online.seats, true),
            ...(next.tracker && { tracker: next.tracker }),
            dmOnline: true,
          },
        },
        { to: "players", msg: { t: "dm", online: true } },
      ],
      // The DM on a second device or tab replaces the first.
      ...(env.online.dm && {
        drop: { reason: "replaced" as const, targets: [{ dm: true as const }] },
      }),
      dirty: !state,
    };
  }

  if (!state) return bye(state, "no-room");
  const name = msg.name.trim() || "Player";
  const rejoin =
    msg.seat !== undefined && msg.token !== undefined && state.seats[msg.seat]?.token === msg.token
      ? msg.seat
      : undefined;
  let seatId = rejoin;
  let room = state;
  if (seatId === undefined) {
    if (Object.keys(state.seats).length >= LIMITS.players) return bye(state, "full");
    seatId = `p${state.nextSeat}`;
    room = {
      ...state,
      nextSeat: state.nextSeat + 1,
      seats: { ...state.seats, [seatId]: { token: env.newToken(), name } },
    };
  }
  const seat = room.seats[seatId] as Seat;
  room = { ...room, lastActive: env.now };
  const online = new Set(env.online.seats).add(seatId);
  return {
    state: room,
    who: { role: "player", seat: seatId },
    out: [
      {
        to: "self",
        msg: {
          t: "welcome",
          v: PROTOCOL_VERSION,
          role: "player",
          seat: seatId,
          token: seat.token,
          // The others at the table by name only: cards are for the DM.
          players: infoOf(room, online, false),
          ...(room.tracker && { tracker: room.tracker }),
          dmOnline: env.online.dm,
        },
      },
      { to: "dm", msg: { t: "presence", seat: seatId, name: seat.name, online: true } },
      ...(seat.card
        ? [{ to: "dm" as const, msg: { t: "card" as const, seat: seatId, card: seat.card } }]
        : []),
    ],
    ...(rejoin !== undefined &&
      env.online.seats.has(seatId) && {
        drop: { reason: "replaced" as const, targets: [{ seat: seatId }] },
      }),
    dirty: rejoin === undefined,
  };
}

/** What the room does with one message. `who` is undefined until the socket has said hello. */
export function step(
  state: RoomState | undefined,
  who: Who | undefined,
  msg: ClientMessage,
  env: Env,
): Step {
  if (who === undefined)
    return msg.t === "hello" ? hello(state, msg, env) : bye(state, "bad-message");
  if (!state) return bye(state, "expired");
  if (msg.t === "hello") return bye(state, "bad-message");
  if (msg.t === "ping")
    return {
      state: { ...state, lastActive: env.now },
      who,
      out: [{ to: "self", msg: { t: "pong" } }],
      dirty: false,
    };

  const room: RoomState = { ...state, lastActive: env.now };

  if (who.role === "dm") {
    switch (msg.t) {
      case "tracker":
        return {
          state: { ...room, tracker: msg.view },
          who,
          out: [{ to: "players", msg: { t: "tracker", view: msg.view } }],
          dirty: true,
        };
      case "askInitiative": {
        const known = msg.seats?.filter((s) => room.seats[s]);
        const ask: ServerMessage = {
          t: "askInitiative",
          ...(known && known.length > 0 && { seats: known }),
        };
        return {
          state: room,
          who,
          out:
            known && known.length > 0
              ? known.map((seat) => ({ to: { seat }, msg: ask }))
              : [{ to: "players", msg: ask }],
          dirty: false,
        };
      }
      case "kick": {
        const seat = room.seats[msg.seat];
        if (!seat) return { state: room, who, out: [], dirty: false };
        const { [msg.seat]: _gone, ...seats } = room.seats;
        return {
          state: { ...room, seats },
          who,
          out: [
            { to: "dm", msg: { t: "presence", seat: msg.seat, name: seat.name, online: false } },
          ],
          drop: { reason: "kicked", targets: [{ seat: msg.seat }] },
          dirty: true,
        };
      }
      case "close":
        return {
          state: undefined,
          who,
          out: [],
          drop: { reason: "closed", targets: [{ all: true }] },
          dirty: true,
        };
      default:
        return { state: room, who, out: [], dirty: false };
    }
  }

  const seat = room.seats[who.seat];
  if (!seat) return bye(room, "kicked");
  switch (msg.t) {
    case "card": {
      const same = JSON.stringify(seat.card) === JSON.stringify(msg.card);
      return {
        state: {
          ...room,
          seats: {
            ...room.seats,
            [who.seat]: { ...seat, name: msg.card.name || seat.name, card: msg.card },
          },
        },
        who,
        out: [{ to: "dm", msg: { t: "card", seat: who.seat, card: msg.card } }],
        dirty: !same,
      };
    }
    case "roll":
      // Rolls are for the DM: the DM rolls behind a screen, so nothing is shared back.
      return {
        state: room,
        who,
        out: [{ to: "dm", msg: { t: "roll", seat: who.seat, roll: msg.roll } }],
        dirty: false,
      };
    case "initiative":
      return {
        state: room,
        who,
        out: [{ to: "dm", msg: { t: "initiative", seat: who.seat, value: msg.value } }],
        dirty: false,
      };
    default:
      return { state: room, who, out: [], dirty: false };
  }
}

/** A socket went away: who hears of it. */
export function leave(state: RoomState | undefined, who: Who | undefined): Out[] {
  if (!state || !who) return [];
  if (who.role === "dm") return [{ to: "players", msg: { t: "dm", online: false } }];
  const seat = state.seats[who.seat];
  return seat
    ? [{ to: "dm", msg: { t: "presence", seat: who.seat, name: seat.name, online: false } }]
    : [];
}
