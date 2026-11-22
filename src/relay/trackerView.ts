import type { Combatant, Encounter } from "../engine/encounter";
import { initiativeOrder, isStarted } from "../engine/encounter";
import type { Band, TrackerView } from "./protocol";

/**
 * What the players see of the fight: the order, whose turn it is and how hurt the creatures look. Never the
 * numbers of a monster's hit points or armor class, and nothing of its notes or abilities.
 */

/** How hurt a creature looks: untouched, hurt, at half its hit points or less, or down. */
export function bandOf(c: Pick<Combatant, "hp" | "maxHp">): Band {
  if (c.hp <= 0) return "down";
  if (c.hp >= c.maxHp) return "unhurt";
  return c.hp * 2 <= c.maxHp ? "bloodied" : "hurt";
}

const key = (name: string) => name.trim().toLocaleLowerCase();

/**
 * Which player sits where: the character of a seat is the one with the same name (the app has no other link
 * between a device and a member of the party). One seat for one character, in the order they are listed.
 */
export function matchSeats(
  combatants: readonly Combatant[],
  players: readonly { seat: string; name: string; online?: boolean }[],
): Map<string, string> {
  const taken = new Set<string>();
  const found = new Map<string, string>();
  for (const c of combatants) {
    if (c.kind !== "character") continue;
    // A player who is here wins over an old seat of the same name that is not.
    const same = players.filter((p) => !taken.has(p.seat) && key(p.name) === key(c.name));
    const player = same.find((p) => p.online) ?? same[0];
    if (!player) continue;
    taken.add(player.seat);
    found.set(c.id, player.seat);
  }
  return found;
}

const NOT_ON = { round: 0, order: [] } satisfies TrackerView;

/** What the DM chose to keep from the players (the settings of the online table). */
export interface Hiding {
  /** Only the creature whose turn it is, with no initiatives. */
  order?: boolean;
  bands?: boolean;
  /** Creatures that are not a player's show under this name. */
  names?: string;
}

/** The view of a fight: nothing until it starts. */
export function trackerViewOf(
  encounter: Encounter,
  players: readonly { seat: string; name: string }[],
  hiding: Hiding = {},
): TrackerView {
  if (!isStarted(encounter)) return NOT_ON;
  const seats = matchSeats(encounter.combatants, players);
  const all = initiativeOrder(encounter.combatants);
  const shown = hiding.order ? all.filter((c) => c.id === encounter.turn) : all;
  return {
    round: encounter.round,
    ...(encounter.turn && { turn: encounter.turn }),
    order: shown.map((c) => {
      const seat = seats.get(c.id);
      const own = c.kind === "character";
      return {
        id: c.id,
        name: !own && !c.lair && hiding.names ? hiding.names : c.name,
        ...(seat && { seat }),
        ...(!hiding.order && c.initiative !== undefined && { initiative: c.initiative }),
        ...(!own && !c.lair && !hiding.bands && { band: bandOf(c) }),
      };
    }),
  };
}
