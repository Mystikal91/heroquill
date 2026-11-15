import { content } from "../../../app/store";
import type { Effect } from "../../../data/schema";
import { effectName, summarize } from "../Effects";
import { optionLabel } from "../labels";
import { kindName } from "../names";
import type { Words } from "./blocks";

/**
 * An effect as a line of a printed page. What only the machine reads (a flag, a condition on other
 * rules) says nothing to a reader and is left out; a proficiency says just what it is in.
 */
export function printedEffect(effect: Effect): string {
  if (effect.type === "flag" || effect.type === "when") return "";
  if (effect.type === "proficiency")
    return `${effectName(effect.type)}: ${optionLabel(effect.target.replace(/^[a-z]+:/, ""))}`;
  return `${effectName(effect.type)}: ${summarize(effect)}`.replace(/: $/, "");
}

/** The words of the document as the app says them now: the names of the content, in the language in use. */
export const liveWords = (): Words => ({
  name: (id) => content.value?.name(id) ?? id,
  word: (kind, slug) =>
    kind === "option" ? optionLabel(slug) : (content.value?.name(`srd51:${kind}/${slug}`) ?? slug),
  effect: printedEffect,
  kind: kindName,
});
