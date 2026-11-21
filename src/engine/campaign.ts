import { uuid } from "./uuid";

/** A player of the party: what the Dungeon Master needs to put them in a fight. */
export interface PartyMember {
  id: string;
  name: string;
  maxHp: number;
  ac: number;
  speed?: number;
  initiativeBonus: number;
  /** The character of this device the numbers came from: their sheet is read again when they join a fight. */
  characterId?: string;
}

/** A campaign: a name and the party that plays it. Its encounters point back to it. */
export interface Campaign {
  id: string;
  name: string;
  party: PartyMember[];
  created: number;
  updated: number;
}

export const MAX_PARTY = 12;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const whole = (n: unknown, fallback = 0) =>
  typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : fallback;
const text = (value: unknown, fallback = "", max = 80) =>
  typeof value === "string" ? value.slice(0, max) : fallback;

export function createCampaign(name: string, now = Date.now()): Campaign {
  return { id: uuid(), name, party: [], created: now, updated: now };
}

const touch = (c: Campaign): Campaign => ({ ...c, updated: Date.now() });

export const renameCampaign = (c: Campaign, name: string): Campaign =>
  touch({ ...c, name: name.slice(0, 80) });

/** A player with the numbers of a new level 1 character, to be filled in. */
export function newMember(
  fields: Partial<Omit<PartyMember, "id">> & { name: string },
): PartyMember {
  return {
    id: uuid(),
    name: fields.name.slice(0, 80),
    maxHp: clamp(whole(fields.maxHp, 10), 1, 99999),
    ac: clamp(whole(fields.ac, 10), 0, 99),
    ...(fields.speed !== undefined && { speed: clamp(whole(fields.speed), 0, 999) }),
    initiativeBonus: clamp(whole(fields.initiativeBonus, 0), -20, 30),
    ...(fields.characterId && { characterId: fields.characterId }),
  };
}

/** Adds a player, up to the size of a party. */
export function addMember(c: Campaign, member: PartyMember): Campaign {
  if (c.party.length >= MAX_PARTY) return c;
  return touch({ ...c, party: [...c.party, member] });
}

export function changeMember(
  c: Campaign,
  id: string,
  change: (m: PartyMember) => PartyMember,
): Campaign {
  return touch({
    ...c,
    party: c.party.map((m) => (m.id === id ? normalise({ ...change(m), id: m.id }) : m)),
  });
}

/** Keeps the numbers of a player in their limits, without changing who they are. */
function normalise(m: PartyMember): PartyMember {
  const { id, ...rest } = m;
  return { ...newMember(rest), id };
}

export const removeMember = (c: Campaign, id: string): Campaign =>
  touch({ ...c, party: c.party.filter((m) => m.id !== id) });

function readMember(raw: unknown): PartyMember | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return undefined;
  return {
    id: r.id,
    name: text(r.name),
    maxHp: clamp(whole(r.maxHp, 1), 1, 99999),
    ac: clamp(whole(r.ac, 10), 0, 99),
    ...(typeof r.speed === "number" && { speed: clamp(whole(r.speed), 0, 999) }),
    initiativeBonus: clamp(whole(r.initiativeBonus), -20, 30),
    ...(typeof r.characterId === "string" &&
      r.characterId !== "" && { characterId: r.characterId }),
  };
}

/** A campaign read from storage or a file, repaired where it can be; undefined when it is not one. */
export function readCampaign(raw: unknown): Campaign | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id === "") return undefined;
  const now = Date.now();
  return {
    id: r.id,
    name: text(r.name),
    party: (Array.isArray(r.party) ? r.party : [])
      .map(readMember)
      .filter((m): m is PartyMember => m !== undefined)
      .slice(0, MAX_PARTY),
    created: whole(r.created, now),
    updated: whole(r.updated, now),
  };
}
