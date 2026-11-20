import { computed } from "@preact/signals";
import { printSettings } from "../../app/printSettings";
import { character, content, printSheet } from "../../app/store";
import { type Character, createCharacter } from "../../engine/character";
import { type DerivedSheet, deriveSheet } from "../../engine/derive";

/**
 * What the print pages draw: the character, or nothing at all for a blank sheet. A blank sheet is
 * the same pages with every value left empty, so the pages read these instead of the store, and
 * write a value through `shown` (which gives nothing on a blank sheet).
 */

/** True when the sheet is printed blank, to be filled by hand or in the PDF. */
export const blank = computed(() => printSettings.value.blank);

/** A character with nothing chosen, in the edition of the open one: it gives the lists of a sheet (the skills). */
const emptyCharacter = computed<Character>(() => {
  const empty = createCharacter(character.value.ruleset);
  return { ...empty, id: "blank" };
});

/** The character the pages print. */
export const printedCharacter = computed<Character>(() =>
  blank.value ? emptyCharacter.value : character.value,
);

/** The sheet the pages print. */
export const printedSheet = computed<DerivedSheet | undefined>(() => {
  if (!blank.value) return printSheet.value;
  const c = content.value;
  return c ? deriveSheet(emptyCharacter.value, c.index) : undefined;
});

/**
 * A value as the page writes it: nothing on a blank sheet. Nothing is a non-breaking space, so that
 * the empty value keeps the line it takes when written and the words around it stay where they are
 * on a filled sheet (an empty number shrank to nothing and its caption moved up).
 */
export function shown<T extends string | number>(value: T): T | " " {
  return blank.value ? " " : value;
}
