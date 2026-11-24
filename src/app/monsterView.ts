import { type UiKey, signed, ui } from "../i18n/ui";
import { convertText } from "../i18n/units";

/** The ways of moving a creature can have, in the order a stat block lists them. */
const SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;

const SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"];
const TYPES = [
  "aberration",
  "beast",
  "celestial",
  "construct",
  "dragon",
  "elemental",
  "fey",
  "fiend",
  "giant",
  "humanoid",
  "monstrosity",
  "ooze",
  "plant",
  "undead",
];
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** A size by its name in the language; a size the rules do not have is written as it came. */
export const sizeText = (size: string) =>
  SIZES.includes(size) ? ui(`monster.size.${size}` as UiKey) : capital(size);

/** A type of creature by its name in the language; one the rules do not have is written as it came. */
export const typeText = (type: string) =>
  TYPES.includes(type) ? ui(`monster.type.${type}` as UiKey) : type;

/** The modifier of an ability score. */
export const modifier = (score: number) => Math.floor((score - 10) / 2);

/** An ability score as a stat block writes it: `16 (+3)`. */
export const scoreText = (score: number) => `${score} (${signed(modifier(score))})`;

/** A challenge rating, with the fractions below 1 written as fractions: 0.125 is 1/8. */
export function challengeText(rating: number): string {
  if (rating === 0.125) return "1/8";
  if (rating === 0.25) return "1/4";
  if (rating === 0.5) return "1/2";
  return String(rating);
}

/** Feet in the units in use. */
const feet = (n: number) => convertText(`${n} ft.`);

/** Speeds as `30 ft., fly 60 ft. (hover)`; the walking speed has no name. */
export function speedText(speed: Record<string, number | true>): string {
  const parts = SPEED_MODES.filter((mode) => typeof speed[mode] === "number").map((mode) =>
    mode === "walk"
      ? feet(speed[mode] as number)
      : `${ui(`monster.speed.${mode}` as UiKey)} ${feet(speed[mode] as number)}${
          mode === "fly" && speed.hover ? ` (${ui("monster.speed.hover")})` : ""
        }`,
  );
  return parts.join(", ");
}

const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"];

/** A sense by its name in the language; a file may write it in capitals or invent one, which is shown as it came. */
const senseName = (sense: string) => {
  const slug = sense.toLowerCase();
  return SENSES.includes(slug) ? ui(`monster.sense.${slug}` as UiKey) : sense;
};

/** Senses as `darkvision 60 ft., passive Perception 12`. */
export function sensesText(
  senses: Record<string, number>,
  blindBeyond: string[] = [],
  passivePerception?: number,
): string {
  const parts = Object.entries(senses).map(
    ([sense, range]) =>
      `${senseName(sense)} ${feet(range)}${
        blindBeyond.includes(sense) ? ` (${ui("monster.sense.blindBeyond")})` : ""
      }`,
  );
  if (passivePerception !== undefined)
    parts.push(ui("monster.passivePerception", { n: passivePerception }));
  return parts.join(", ");
}

export interface Usage {
  type: string;
  times?: number;
  minValue?: number;
  restTypes?: string[];
}

/** How often an action can be used: `3/Day`, `Recharge 5-6`, `Recharges after a short or long rest`. */
export function usageText(usage: Usage | undefined): string | undefined {
  if (!usage) return undefined;
  if (usage.type === "per day") return ui("monster.usage.perDay", { n: usage.times ?? 1 });
  if (usage.type === "recharge on roll")
    return ui("monster.usage.recharge", { n: usage.minValue ?? 6 });
  if (usage.type === "recharge after rest") {
    const types = usage.restTypes ?? [];
    if (types.length === 1)
      return ui(types[0] === "short" ? "monster.usage.shortRest" : "monster.usage.longRest");
    return ui("monster.usage.rest");
  }
  return undefined;
}
