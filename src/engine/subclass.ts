import { type SubclassData, subclassData } from "../data/progression";
import type { Entry } from "../data/schema";
import type { Character } from "./character";
import type { PackIndex } from "./derive";
import { subclassOf } from "./rulesets";

/** The level at which every class of the 2024 rules takes its subclass. */
const SUBCLASS_LEVEL_2024 = 3;

/** Whether the class has reached its subclass: always, except a 2014 subclass on a 2024 class below the 3rd level. */
export function subclassReached(sub: Entry, classId: string, level: number): boolean {
  return sub.parent === classId || !subclassOf(sub, classId) || level >= SUBCLASS_LEVEL_2024;
}

/**
 * What a subclass gives on a class. The 2024 rules give the subclass at the 3rd level: on a 2024 class, what a
 * 2014 one gives at the 1st and the 2nd (a domain, an arcane tradition) comes at the 3rd. The later levels are
 * those of the book.
 */
export function subclassDataOn(sub: Entry, classId: string): SubclassData {
  const data = subclassData(sub);
  if (sub.parent === classId || !subclassOf(sub, classId)) return data;
  const at = (level: number) => Math.max(level, SUBCLASS_LEVEL_2024);
  const early = data.levels.filter((l) => l.level < SUBCLASS_LEVEL_2024);
  const third = data.levels.filter((l) => l.level === SUBCLASS_LEVEL_2024);
  return {
    ...data,
    levels:
      early.length === 0
        ? data.levels
        : [
            {
              ...third[0],
              level: SUBCLASS_LEVEL_2024,
              features: [...early, ...third].flatMap((l) => l.features),
            },
            ...data.levels.filter((l) => l.level > SUBCLASS_LEVEL_2024),
          ],
    spells: data.spells.map((s) => ({ ...s, classLevel: at(s.classLevel) })),
  };
}

/**
 * The classes that have reached the level where a subclass is chosen and have none: the lowest
 * level at which any of the class's subclasses gives something is when the choice is due.
 */
export function classesNeedingSubclass(character: Character, index: PackIndex): string[] {
  const due: string[] = [];
  for (const cl of character.classes) {
    if (cl.subclassId) continue;
    const level = subclassLevel(cl.classId, index);
    if (level !== undefined && cl.level >= level) due.push(cl.classId);
  }
  return due;
}

/** The level at which a class chooses its subclass, or nothing when it has no subclasses. */
export function subclassLevel(classId: string, index: PackIndex): number | undefined {
  const levels = [...index.values()]
    .filter((e) => e.kind === "subclass" && subclassOf(e, classId))
    .flatMap((e) => subclassDataOn(e, classId).levels.map((l) => l.level));
  return levels.length > 0 ? Math.min(...levels) : undefined;
}
