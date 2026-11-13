import { subclassData } from "../data/progression";
import type { Character } from "./character";
import type { PackIndex } from "./derive";
import { subclassOf } from "./rulesets";

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
    .flatMap((e) => subclassData(e).levels.map((l) => l.level));
  return levels.length > 0 ? Math.min(...levels) : undefined;
}
