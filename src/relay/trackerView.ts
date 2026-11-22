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
  players: readonly { seat: string; name: string }[],
): Map<string, string> {
  const taken = new Set<string>();
  const found = new Map<string, string>();
  for (const c of combatants) {
    if (c.kind !== "character") continue;
    const player = players.find((p) => !taken.has(p.seat) && key(p.name) === key(c.name));
    if (!player) continue;
    taken.add(player.seat);
    found.set(c.id, player.seat);
  }
  return found;
}

const NOT_ON = { round: 0, order: [] } satisfies TrackerView;

/** The view of a fight: nothing until it starts. */
export function trackerViewOf(
  encounter: Encounter,
  players: readonly { seat: string; name: string }[],
): TrackerView {
  if (!isStarted(encounter)) return NOT_ON;
  const seats = matchSeats(encounter.combatants, players);
  return {
    round: encounter.round,
    ...(encounter.turn && { turn: encounter.turn }),
    order: initiativeOrder(encounter.combatants).map((c) => {
      const seat = seats.get(c.id);
      return {
        id: c.id,
        name: c.name,
        ...(seat && { seat }),
        ...(c.initiative !== undefined && { initiative: c.initiative }),
        ...(c.kind !== "character" && !c.lair && { band: bandOf(c) }),
      };
    }),
  };
}
