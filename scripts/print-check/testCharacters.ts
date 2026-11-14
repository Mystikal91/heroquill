// The test characters of the print check: every 2014 class at levels 1, 9 and 20, some 2024 ones, and a few
// with every print option ticked. `pages.ts` prints them; `export.ts` writes them as a transfer file.
import { type Character, createCharacter } from "../../src/engine/character";
import type { PackIndex } from "../../src/engine/derive";
import { subclassOf } from "../../src/engine/rulesets";
import { CLASSES, SPECIES, build, complete } from "../../src/test/characters";
import { bothIndex } from "../../src/test/srd52";

/** Print settings: what the Print tab has ticked. `all` also asks for the cards and every spell. */
export const SETTINGS = {
  default: {},
  all: { spellCards: true, featureCards: true, includeAvailable: true },
} as const;
export type Config = keyof typeof SETTINGS;

export interface Case {
  name: string;
  config: Config;
  character: Character;
}

function made2014(cls: string, level: number, species: string): Character {
  return complete(build(cls, level, species));
}

function made2024(cls: string, level: number): Character {
  const c = createCharacter("srd52");
  const classId = `srd52:class/${cls}`;
  const sub = [...bothIndex.values()].find((e) => e.kind === "subclass" && subclassOf(e, classId));
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/sage";
  c.classes = [{ classId, level, ...(level >= 3 && sub && { subclassId: sub.id }) }];
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  return complete(c, bothIndex as PackIndex);
}

export function cases(): Case[] {
  const list: Case[] = [];
  const add = (name: string, character: Character, config: Config = "default") => {
    character.name = name;
    list.push({ name, config, character });
  };
  CLASSES.forEach((cls, i) => {
    [1, 9, 20].forEach((level, j) => {
      const species = SPECIES[(i + j * 3) % SPECIES.length] ?? "human";
      add(`2014 ${cls} ${level} ${species}`, made2014(cls, level, species));
    });
  });
  for (const cls of ["wizard", "cleric", "bard", "fighter"]) {
    add(`2014 ${cls} 20 with everything`, made2014(cls, 20, "human"), "all");
  }
  for (const cls of ["fighter", "wizard", "cleric", "bard", "druid"]) {
    for (const level of [1, 20]) add(`2024 ${cls} ${level}`, made2024(cls, level));
  }
  add("2024 wizard 20 with everything", made2024("wizard", 20), "all");
  return list;
}
