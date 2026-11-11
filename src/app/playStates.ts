import type { PlayState } from "../engine/character";
import { exhaustionLevel } from "../engine/exhaustion";
import { deathStatus } from "../engine/play";

/**
 * What the play screen shows about the state of the character as a whole, beyond the numbers:
 * the signals the styles key on (a vignette at the edges, a glow, a colour wash). Each one is
 * absent when the character is not in that state.
 */
export interface PlayStates {
  /** At 0 hit points: dying, stable (three successes) or dead (three failures). */
  dying?: "dying" | "stable" | "dead";
  /** Concentrating on a spell. */
  focus?: "on";
  /** The character has inspiration. */
  inspired?: "on";
  /** The character holds a die of Bardic Inspiration. */
  bardic?: "on";
  /** The character has temporary hit points. */
  temp?: "on";
  /** The conditions by their slug, separated by spaces: `poisoned frightened`. */
  conditions?: string;
}

export function playStates(play: PlayState, max: number): PlayStates {
  // A character with no class has no hit points yet: nothing to be dying of.
  const status = max > 0 ? deathStatus(play, max) : "alive";
  // The levels of exhaustion colour the screen as the condition did.
  const conditions = [
    ...play.conditions.map((id) => id.split("/")[1]),
    ...(exhaustionLevel(play) > 0 ? ["exhaustion"] : []),
  ]
    .filter((slug, i, all): slug is string => Boolean(slug) && all.indexOf(slug) === i)
    .join(" ");
  return {
    ...(status !== "alive" && { dying: status }),
    ...(play.concentration && { focus: "on" as const }),
    ...(play.inspiration && { inspired: "on" as const }),
    ...(play.bardicDie !== undefined && { bardic: "on" as const }),
    ...(play.tempHp > 0 && { temp: "on" as const }),
    ...(conditions && { conditions }),
  };
}

/** The states as the data attributes the styles read, for the aura and for the screen itself. */
export function stateAttributes(states: PlayStates) {
  return {
    "data-dying": states.dying,
    "data-focus": states.focus,
    "data-inspired": states.inspired,
    "data-bardic": states.bardic,
    "data-temp": states.temp,
    "data-conditions": states.conditions,
  };
}
