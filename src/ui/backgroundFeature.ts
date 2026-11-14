import type { Content } from "../content/browser";
import type { Character } from "../engine/character";

/**
 * The feature a background gives: its own, or the optional one the character took in its place
 * (an option whose data says `backgroundFeature`, switched on in the optional rules).
 */
export function backgroundFeature(
  ch: Pick<Character, "options" | "choices">,
  c: Content,
): { name: string | undefined; text: string | undefined } {
  const background = ch.choices.background;
  const chosen = (ch.options ?? []).find(
    (id) => c.index.get(id)?.data.backgroundFeature === true && c.text(id, "desc"),
  );
  if (chosen) return { name: c.name(chosen), text: c.text(chosen, "desc") };
  return {
    name: background ? c.text(background, "featureName") : undefined,
    text: background ? c.text(background, "featureDesc") : undefined,
  };
}

/**
 * The feat a 2024 background gives (its Origin feat): the entry the background names in its data,
 * with its name and text. Nothing for a background that names none (every 2014 one).
 */
export function originFeat(
  ch: Pick<Character, "choices">,
  c: Content,
): { name: string; text: string | undefined } | undefined {
  const background = ch.choices.background;
  const id = background ? c.index.get(background)?.data.feat : undefined;
  if (typeof id !== "string" || !c.index.has(id)) return undefined;
  return { name: c.name(id), text: c.text(id, "desc") };
}

/** Whether an entry of the kind `option` is an optional feature in place of a background's own. */
export const isBackgroundFeatureOption = (id: string, c: Content): boolean =>
  c.index.get(id)?.data.backgroundFeature === true;
