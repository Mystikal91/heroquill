import { content } from "../app/store";
import { wordEntry } from "../engine/words";
import { type UiKey, ui } from "../i18n/ui";

const DAMAGE_TYPES = new Set([
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
]);

/** The name a pack gave to a kind of damage it adds, in the language in use. */
const packName = (type: string) => {
  const c = content.value;
  const entry = c && wordEntry(c.index, "damage", type);
  return entry && c ? c.name(entry.id) : undefined;
};

/** A kind of damage in the language ("tagliente"), or as it is written when it is not a usual one. */
export const damageName = (type: string) =>
  DAMAGE_TYPES.has(type) ? ui(`hb.o.${type}` as UiKey).toLowerCase() : (packName(type) ?? type);

/** The same, with a capital: for a list on its own (resistances). */
export const damageTitle = (type: string) => {
  const key = `hb.o.${type}` as UiKey;
  return DAMAGE_TYPES.has(type) ? ui(key) : (packName(type) ?? type);
};
