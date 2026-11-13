import { type Character, createCharacter } from "../engine/character";
import { type PackIndex, deriveSheet } from "../engine/derive";
import type { SpellPick } from "../engine/spells";
import { srd51Index as index } from "./srd51";

export const CLASSES = [
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
];
export const SPECIES = [
  "dwarf",
  "elf",
  "halfling",
  "human",
  "dragonborn",
  "gnome",
  "half-elf",
  "half-orc",
  "tiefling",
];
export const LEVELS = [1, 2, 3, 4, 5, 6, 8, 9, 11, 13, 17, 20];

const subclassOf = (classId: string) =>
  [...index.values()].find((e) => e.kind === "subclass" && e.parent === classId)?.id;

export function build(cls: string, level: number, species: string, subclass = true): Character {
  const c = createCharacter("srd51");
  c.choices.species = `srd51:species/${species}`;
  const classId = `srd51:class/${cls}`;
  c.classes = [
    { classId, level, ...(subclass && level >= 3 && { subclassId: subclassOf(classId) }) },
  ];
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  c.inventory = [
    { itemId: "srd51:item/longsword", quantity: 1, equipped: true },
    { itemId: "srd51:item/chain-mail", quantity: 1, equipped: true },
  ];
  return c;
}

/**
 * Fills every open choice and spell pick with the first valid options, as a person would. The
 * index is the 2014 SRD's unless another one is given (the 2024 characters of the print check).
 */
export function complete(c: Character, rules: PackIndex = index): Character {
  const fill = (pick: SpellPick | undefined) => (pick ? pick.pool.slice(0, pick.allowed) : []);
  for (let pass = 0; pass < 6; pass++) {
    const sheet = deriveSheet(c, rules);
    let changed = false;
    for (const choice of sheet.choices) {
      if (choice.remaining <= 0) continue;
      const rest = choice.options.filter((o) => !choice.selected.includes(o));
      c.selections[choice.key] = [...choice.selected, ...rest.slice(0, choice.remaining)];
      changed = true;
    }
    for (const caster of sheet.spellcasters) {
      const next = {
        cantrips: fill(caster.lists.cantrips),
        known: fill(caster.lists.known),
        prepared: fill(caster.lists.prepared),
      };
      const old = c.spells[caster.classId];
      if (JSON.stringify(old) !== JSON.stringify(next)) {
        c.spells[caster.classId] = next;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return c;
}
