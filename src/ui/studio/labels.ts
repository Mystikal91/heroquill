import en from "../../../locales/en/ui.json";
import { content } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import { type UiKey, ui } from "../../i18n/ui";

/** `healAtSlotLevel` -> `Heal at slot level`: a label for what no one has written a text for yet. */
export function humanize(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const has = (key: string): key is UiKey => key in en;

/** The label of a field: the text the editor has for it, or its name made readable. */
export function fieldLabel(key: string): string {
  const data = `fd.${key}`;
  if (has(data)) return ui(data);
  const text = `hb.f.${key}`;
  return has(text) ? ui(text) : humanize(key);
}

/** What an option of a choice is called: an ability by its name, a known word by its text, else the word made readable. */
export function optionLabel(id: string): string {
  if ((ABILITIES as readonly string[]).includes(id))
    return content.value?.name(`srd51:ability/${id}`) ?? id.toUpperCase();
  const text = `hb.o.${id}`;
  if (has(text)) return ui(text);
  return humanize(id);
}

/** The label of a field of an effect: its own text, since the same word means other things in a form. */
export function effectFieldLabel(key: string): string {
  const text = `fx.f.${key}`;
  return has(text) ? ui(text) : humanize(key);
}
