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

/** The colours a condition of a pack can give to the glow at the edges of the screen. */
export const CONDITION_TINTS: Record<string, string> = {
  red: "rgba(214, 70, 60, 0.55)",
  orange: "rgba(235, 135, 40, 0.55)",
  yellow: "rgba(230, 200, 60, 0.5)",
  green: "rgba(80, 180, 90, 0.5)",
  teal: "rgba(50, 175, 170, 0.5)",
  blue: "rgba(70, 120, 225, 0.55)",
  violet: "rgba(140, 90, 215, 0.55)",
  pink: "rgba(232, 106, 163, 0.5)",
  grey: "rgba(150, 155, 165, 0.55)",
  black: "rgba(0, 0, 0, 0.75)",
};

/** The glow of the condition the character took last that has a colour of its own, if any. */
export function conditionTint(
  play: PlayState,
  colorOf: (id: string) => string | undefined,
): string | undefined {
  for (const id of [...play.conditions].reverse()) {
    const color = colorOf(id);
    if (color && color in CONDITION_TINTS) return CONDITION_TINTS[color];
    // Any colour a person picked: `#rrggbb`, glowing as the named ones do.
    const hex = color && /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    if (hex)
      return `rgba(${Number.parseInt(hex[1] ?? "0", 16)}, ${Number.parseInt(hex[2] ?? "0", 16)}, ${Number.parseInt(hex[3] ?? "0", 16)}, 0.55)`;
  }
  return undefined;
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
