/**
 * The words the app and the room relay (`workers/room-relay`) say to each other. One file, imported by both,
 * so they cannot drift. Messages are small JSON; everything that comes in is read by `parseClientMessage`,
 * which keeps only what is known and cuts what is too long: the room never stores or forwards a stranger's blob.
 *
 * Who sees what: a player's card and rolls go to the Dungeon Master only (the DM rolls behind a screen, so
 * nothing goes the other way); the tracker the DM publishes goes to every player.
 */

export const PROTOCOL_VERSION = 1;

export const LIMITS = {
  /** Players in a room (the DM is one more socket). */
  players: 10,
  /** Bytes of one message, as text. */
  messageBytes: 8192,
  /** Messages a socket may send in a second. */
  perSecond: 20,
  /** A room with no message for this long is deleted. */
  roomHours: 12,
  /** Characters of a name or a label. */
  text: 80,
  /** Creatures in the tracker the players see. */
  order: 60,
  conditions: 20,
} as const;

/** How hurt a creature looks, which is all the players see of a monster's hit points. */
export type Band = "unhurt" | "hurt" | "bloodied" | "down";

/** What a player lets the DM see of their sheet; only `name`, `hp`, `maxHp` and `ac` are always there. */
export interface PlayerCard {
  name: string;
  /** Class and level as text ("Rogue 3"). */
  cls?: string;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  speed?: number;
  initiativeBonus?: number;
  passivePerception?: number;
  spellDc?: number;
  conditions: string[];
  concentration?: string;
}

/** One roll a player made, as the roll history says it. */
export interface SharedRoll {
  label: string;
  detail: string;
  total?: number;
  tone?: "critical" | "fumble";
}

/** The part of the fight the players see. */
export interface TrackerView {
  round: number;
  /** The id of the creature whose turn it is. */
  turn?: string;
  order: { id: string; name: string; seat?: string; initiative?: number; band?: Band }[];
}

export type ByeReason =
  | "no-room"
  | "bad-secret"
  | "full"
  | "kicked"
  | "closed"
  | "expired"
  | "bad-message"
  | "too-fast"
  | "replaced";

export type ClientMessage =
  | { t: "hello"; v: number; role: "dm"; secret: string }
  | { t: "hello"; v: number; role: "player"; name: string; seat?: string; token?: string }
  | { t: "card"; card: PlayerCard }
  | { t: "roll"; roll: SharedRoll }
  | { t: "initiative"; value: number }
  | { t: "tracker"; view: TrackerView }
  | { t: "askInitiative"; seats?: string[] }
  | { t: "kick"; seat: string }
  | { t: "close" }
  | { t: "ping" };

/** A seat as the DM sees it. */
export interface PlayerInfo {
  seat: string;
  name: string;
  online: boolean;
  card?: PlayerCard;
}

export type ServerMessage =
  | {
      t: "welcome";
      v: number;
      role: "dm" | "player";
      /** A player's seat and the token that gives it back after a reconnection. */
      seat?: string;
      token?: string;
      players: PlayerInfo[];
      tracker?: TrackerView;
      dmOnline: boolean;
    }
  | { t: "presence"; seat: string; name: string; online: boolean }
  | { t: "dm"; online: boolean }
  | { t: "card"; seat: string; card: PlayerCard }
  | { t: "roll"; seat: string; roll: SharedRoll }
  | { t: "initiative"; seat: string; value: number }
  | { t: "tracker"; view: TrackerView }
  | { t: "askInitiative"; seats?: string[] }
  | { t: "pong" }
  | { t: "bye"; reason: ByeReason };

// ---- Reading what comes in ----

const isObject = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const str = (x: unknown, max: number): string | undefined =>
  typeof x === "string" ? x.slice(0, max) : undefined;

const int = (x: unknown, min: number, max: number): number | undefined =>
  typeof x === "number" && Number.isFinite(x)
    ? Math.min(max, Math.max(min, Math.trunc(x)))
    : undefined;

export function readCard(raw: unknown): PlayerCard | undefined {
  if (!isObject(raw)) return undefined;
  const name = str(raw.name, LIMITS.text);
  const hp = int(raw.hp, 0, 99999);
  const maxHp = int(raw.maxHp, 1, 99999);
  const ac = int(raw.ac, 0, 99);
  if (name === undefined || hp === undefined || maxHp === undefined || ac === undefined)
    return undefined;
  const cls = str(raw.cls, LIMITS.text);
  const speed = int(raw.speed, 0, 999);
  const bonus = int(raw.initiativeBonus, -20, 30);
  const passive = int(raw.passivePerception, 0, 99);
  const dc = int(raw.spellDc, 0, 99);
  const concentration = str(raw.concentration, LIMITS.text);
  return {
    name,
    ...(cls && { cls }),
    hp: Math.min(hp, maxHp),
    maxHp,
    tempHp: int(raw.tempHp, 0, 99999) ?? 0,
    ac,
    ...(speed !== undefined && { speed }),
    ...(bonus !== undefined && { initiativeBonus: bonus }),
    ...(passive !== undefined && { passivePerception: passive }),
    ...(dc !== undefined && { spellDc: dc }),
    conditions: (Array.isArray(raw.conditions) ? raw.conditions : [])
      .map((c) => str(c, LIMITS.text))
      .filter((c): c is string => c !== undefined && c !== "")
      .slice(0, LIMITS.conditions),
    ...(concentration && { concentration }),
  };
}

export function readRoll(raw: unknown): SharedRoll | undefined {
  if (!isObject(raw)) return undefined;
  const label = str(raw.label, 200);
  const detail = str(raw.detail, 200);
  if (label === undefined || detail === undefined) return undefined;
  const total = int(raw.total, -9999, 99999);
  return {
    label,
    detail,
    ...(total !== undefined && { total }),
    ...((raw.tone === "critical" || raw.tone === "fumble") && { tone: raw.tone }),
  };
}

const BANDS: readonly Band[] = ["unhurt", "hurt", "bloodied", "down"];

export function readTracker(raw: unknown): TrackerView | undefined {
  if (!isObject(raw) || !Array.isArray(raw.order)) return undefined;
  const order: TrackerView["order"] = [];
  for (const item of raw.order.slice(0, LIMITS.order)) {
    if (!isObject(item)) continue;
    const id = str(item.id, 64);
    const name = str(item.name, LIMITS.text);
    if (!id || name === undefined) continue;
    const seat = str(item.seat, 16);
    const initiative = int(item.initiative, -99, 99);
    order.push({
      id,
      name,
      ...(seat && { seat }),
      ...(initiative !== undefined && { initiative }),
      ...(BANDS.includes(item.band as Band) && { band: item.band as Band }),
    });
  }
  const turn = str(raw.turn, 64);
  return { round: int(raw.round, 0, 999) ?? 0, ...(turn && { turn }), order };
}

/** A message from a socket, or undefined when it is not one of ours (wrong shape, too big, not JSON). */
export function parseClientMessage(text: string): ClientMessage | undefined {
  if (text.length > LIMITS.messageBytes) return undefined;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObject(raw)) return undefined;
  switch (raw.t) {
    case "hello": {
      const v = int(raw.v, 0, 999);
      if (v === undefined) return undefined;
      if (raw.role === "dm") {
        const secret = str(raw.secret, 128);
        return secret && secret.length >= 16 ? { t: "hello", v, role: "dm", secret } : undefined;
      }
      if (raw.role === "player") {
        const name = str(raw.name, LIMITS.text)?.trim() ?? "";
        const seat = str(raw.seat, 16);
        const token = str(raw.token, 64);
        return {
          t: "hello",
          v,
          role: "player",
          name,
          ...(seat && { seat }),
          ...(token && { token }),
        };
      }
      return undefined;
    }
    case "card": {
      const card = readCard(raw.card);
      return card ? { t: "card", card } : undefined;
    }
    case "roll": {
      const roll = readRoll(raw.roll);
      return roll ? { t: "roll", roll } : undefined;
    }
    case "initiative": {
      const value = int(raw.value, -99, 99);
      return value === undefined ? undefined : { t: "initiative", value };
    }
    case "tracker": {
      const view = readTracker(raw.view);
      return view ? { t: "tracker", view } : undefined;
    }
    case "askInitiative": {
      const seats = Array.isArray(raw.seats)
        ? raw.seats.map((s) => str(s, 16)).filter((s): s is string => Boolean(s))
        : undefined;
      return { t: "askInitiative", ...(seats && seats.length > 0 && { seats }) };
    }
    case "kick": {
      const seat = str(raw.seat, 16);
      return seat ? { t: "kick", seat } : undefined;
    }
    case "close":
      return { t: "close" };
    case "ping":
      return { t: "ping" };
    default:
      return undefined;
  }
}

/** The characters a join code is made of: no 0, O, 1, I or L, which look alike. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

/** A join code as typed by a person: upper case, spaces and dashes gone; undefined when it cannot be one. */
export function normaliseCode(text: string): string | undefined {
  const code = text.toUpperCase().replace(/[\s-]/g, "");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c))
    ? code
    : undefined;
}

// ---- How a socket is closed ----

const CLOSE_BASE = 4000;

/** The close code of each reason: the room says why with the code, so a client needs no extra message. */
export const CLOSE_CODES: Record<ByeReason, number> = {
  "no-room": CLOSE_BASE + 1,
  "bad-secret": CLOSE_BASE + 2,
  full: CLOSE_BASE + 3,
  kicked: CLOSE_BASE + 4,
  closed: CLOSE_BASE + 5,
  expired: CLOSE_BASE + 6,
  "bad-message": CLOSE_BASE + 7,
  "too-fast": CLOSE_BASE + 8,
  replaced: CLOSE_BASE + 9,
};

/** The reason behind a close code, or nothing when the socket simply dropped (a connection that can be retried). */
export function byeFromCode(code: number): ByeReason | undefined {
  return (Object.keys(CLOSE_CODES) as ByeReason[]).find((r) => CLOSE_CODES[r] === code);
}
