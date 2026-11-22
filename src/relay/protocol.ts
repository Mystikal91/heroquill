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
  spellAttack?: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  proficiency?: number;
  /** The save DC of martial features. */
  martialDc?: number;
  /** The lowest die that is a critical hit, when it is under 20. */
  critRange?: number;
  attunedUsed?: number;
  attunedMax?: number;
  /** Other speeds and senses, as the player's language says them: name and value. */
  senses?: [string, string][];
  /** What the character does to damage (resistances, reductions...): name and text. */
  defenses?: [string, string][];
  /** Spells and effects in force that are not conditions, with the rounds left when they have a limit. */
  active?: { name: string; rounds?: number }[];
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

/**
 * What the DM asks a player to do on their own sheet. The player's device decides: nothing changes until they
 * accept, and the DM learns the answer. The player's sheet is theirs; the DM never writes to it.
 */
export type Proposal =
  /** Take this much damage (after the defenses the DM knows of). */
  | { kind: "damage"; amount: number; type?: string; from?: string }
  /** A condition, by the id of its entry in the rules, with its name for a player who does not have that entry. */
  | { kind: "condition"; condition: string; name?: string; rounds?: number; from?: string }
  /** A spell or an effect on the player: a name, a note, a limit in rounds and what it changes (as the rules say it). */
  | {
      kind: "effect";
      name: string;
      note?: string;
      rounds?: number;
      effects?: unknown[];
      from?: string;
    }
  /** A line of text to the player, shown to them alone. */
  | { kind: "say"; text: string }
  /** A saving throw, an ability check or a skill check; the player rolls it and the total comes back with the answer. */
  | {
      kind: "roll";
      test: "save" | "check";
      ability: AbilityKey;
      skill?: string;
      dc?: number;
      from?: string;
    };

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type AbilityKey = (typeof ABILITY_KEYS)[number];

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
  | { t: "propose"; seat: string; id: string; proposal: Proposal }
  | { t: "answer"; id: string; accepted: boolean; result?: number }
  /** A line from a player to the DM, and to nobody else. */
  | { t: "say"; text: string }
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
  | { t: "proposal"; id: string; proposal: Proposal }
  | { t: "answer"; seat: string; id: string; accepted: boolean; result?: number }
  /** The proposal did not reach a player: nobody is on that seat now. */
  | { t: "undelivered"; id: string }
  | { t: "say"; seat: string; text: string }
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

/** A list of name and text pairs, cut to a few short ones. */
function pairs(raw: unknown, count: number, length: number): [string, string][] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: [string, string][] = [];
  for (const item of raw.slice(0, count)) {
    if (!Array.isArray(item)) continue;
    const name = str(item[0], length);
    const value = str(item[1], length);
    if (name !== undefined && value !== undefined) out.push([name, value]);
  }
  return out.length > 0 ? out : undefined;
}

function readActive(raw: unknown): PlayerCard["active"] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<PlayerCard["active"]> = [];
  for (const item of raw.slice(0, 12)) {
    if (!isObject(item)) continue;
    const name = str(item.name, LIMITS.text);
    const rounds = int(item.rounds, 1, 999);
    if (name) out.push({ name, ...(rounds !== undefined && { rounds }) });
  }
  return out.length > 0 ? out : undefined;
}

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
  const attack = int(raw.spellAttack, -20, 40);
  const investigation = int(raw.passiveInvestigation, 0, 99);
  const insight = int(raw.passiveInsight, 0, 99);
  const proficiency = int(raw.proficiency, 0, 20);
  const martial = int(raw.martialDc, 0, 99);
  const crit = int(raw.critRange, 2, 20);
  const attunedUsed = int(raw.attunedUsed, 0, 9);
  const attunedMax = int(raw.attunedMax, 0, 9);
  const active = readActive(raw.active);
  const senses = pairs(raw.senses, 10, 80);
  const defenses = pairs(raw.defenses, 10, 200);
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
    ...(attack !== undefined && { spellAttack: attack }),
    ...(investigation !== undefined && { passiveInvestigation: investigation }),
    ...(insight !== undefined && { passiveInsight: insight }),
    ...(proficiency !== undefined && { proficiency }),
    ...(martial !== undefined && { martialDc: martial }),
    ...(crit !== undefined && crit < 20 && { critRange: crit }),
    ...(attunedUsed !== undefined && { attunedUsed }),
    ...(attunedMax !== undefined && { attunedMax }),
    ...(senses && { senses }),
    ...(defenses && { defenses }),
    ...(active && { active }),
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

export function readProposal(raw: unknown): Proposal | undefined {
  if (!isObject(raw)) return undefined;
  const from = str(raw.from, LIMITS.text);
  switch (raw.kind) {
    case "damage": {
      const amount = int(raw.amount, 0, 9999);
      const type = str(raw.type, 40);
      return amount === undefined
        ? undefined
        : { kind: "damage", amount, ...(type && { type }), ...(from && { from }) };
    }
    case "condition": {
      const condition = str(raw.condition, 120);
      const name = str(raw.name, LIMITS.text);
      const rounds = int(raw.rounds, 1, 999);
      return condition
        ? {
            kind: "condition",
            condition,
            ...(name && { name }),
            ...(rounds !== undefined && { rounds }),
            ...(from && { from }),
          }
        : undefined;
    }
    case "effect": {
      const name = str(raw.name, LIMITS.text)?.trim();
      if (!name) return undefined;
      const note = str(raw.note, 200);
      const rounds = int(raw.rounds, 1, 999);
      // What it changes is the rules' own vocabulary: the room only keeps it small, the player's device reads it.
      const list = Array.isArray(raw.effects) ? raw.effects.filter(isObject).slice(0, 8) : [];
      const effects = list.length > 0 && JSON.stringify(list).length <= 3000 ? list : undefined;
      return {
        kind: "effect",
        name,
        ...(note && { note }),
        ...(rounds !== undefined && { rounds }),
        ...(effects && { effects }),
        ...(from && { from }),
      };
    }
    case "say": {
      const text = str(raw.text, 400)?.trim();
      return text ? { kind: "say", text } : undefined;
    }
    case "roll": {
      const ability = ABILITY_KEYS.find((a) => a === raw.ability);
      const skill = str(raw.skill, 120);
      const dc = int(raw.dc, 1, 40);
      if (!ability || (raw.test !== "save" && raw.test !== "check")) return undefined;
      return {
        kind: "roll",
        test: raw.test,
        ability,
        ...(skill && raw.test === "check" && { skill }),
        ...(dc !== undefined && { dc }),
        ...(from && { from }),
      };
    }
    default:
      return undefined;
  }
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
    case "propose": {
      const seat = str(raw.seat, 16);
      const id = str(raw.id, 40);
      const proposal = readProposal(raw.proposal);
      return seat && id && proposal ? { t: "propose", seat, id, proposal } : undefined;
    }
    case "answer": {
      const id = str(raw.id, 40);
      const result = int(raw.result, -99, 999);
      return id && typeof raw.accepted === "boolean"
        ? { t: "answer", id, accepted: raw.accepted, ...(result !== undefined && { result }) }
        : undefined;
    }
    case "say": {
      const text = str(raw.text, 400)?.trim();
      return text ? { t: "say", text } : undefined;
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
