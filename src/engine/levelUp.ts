import { classData } from "../data/progression";
import type { Ability, Entry } from "../data/schema";
import type { Character } from "./character";
import { type DerivedSheet, type PackIndex, deriveSheet } from "./derive";
import { type HouseRules, NO_HOUSE_RULES } from "./houseRules";
import { unmetPrerequisites } from "./multiclass";
import { inRuleset } from "./rulesets";
import { subclassLevel } from "./subclass";

export const MAX_LEVEL = 20;

/** An ability minimum a class asks for, and the class that asks for it. */
export interface Unmet {
  classId: string;
  ability: Ability;
  minimum: number;
}

/** One way to gain a level: in a class the character already has, or in a new one. */
export interface LevelUpOption {
  classId: string;
  /** Levels already taken in this class (0 for a class the character does not have yet). */
  currentLevel: number;
  newLevel: number;
  isNew: boolean;
  /** Multiclass minimums that are not met; empty when the level can be taken freely. */
  unmet: Unmet[];
}

/** How the hit points of the new level are decided. */
export type HpChoice = { type: "average" } | { type: "roll"; value: number };

const classEntries = (index: PackIndex, ruleset: string): Entry[] =>
  [...index.values()].filter((e) => e.kind === "class" && inRuleset(e.id, ruleset));

/** The average of a hit die as the rules give it for levelling up: half the die, plus one. */
export const averageHp = (hitDie: number) => Math.floor(hitDie / 2) + 1;

/** Every class the character could gain a level in right now. Empty at level 20. */
export function levelUpOptions(
  character: Character,
  index: PackIndex,
  sheet: DerivedSheet,
  rules: HouseRules = NO_HOUSE_RULES,
): LevelUpOption[] {
  if (character.classes.length === 0 || sheet.level >= MAX_LEVEL) return [];
  // With the house rule a new class asks for no minimum: every score counts as met.
  const score = (a: Ability) =>
    rules.freeMulticlass ? Number.POSITIVE_INFINITY : sheet.abilities[a].score;

  // Multiclassing needs the minimums of the new class and of every class already taken.
  const currentUnmet: Unmet[] = character.classes.flatMap((cl) => {
    const entry = index.get(cl.classId);
    return entry
      ? unmetPrerequisites(classData(entry), score).map((u) => ({ classId: cl.classId, ...u }))
      : [];
  });

  const options: LevelUpOption[] = character.classes.map((cl) => ({
    classId: cl.classId,
    currentLevel: cl.level,
    newLevel: cl.level + 1,
    isNew: false,
    unmet: [],
  }));
  for (const entry of classEntries(index, character.ruleset)) {
    if (character.classes.some((cl) => cl.classId === entry.id)) continue;
    const own = unmetPrerequisites(classData(entry), score).map((u) => ({
      classId: entry.id,
      ...u,
    }));
    options.push({
      classId: entry.id,
      currentLevel: 0,
      newLevel: 1,
      isNew: true,
      unmet: [...currentUnmet, ...own],
    });
  }
  return options;
}

/**
 * The character one level higher in `classId`. Hit points are recorded as a roll for that
 * level; levels without a recorded roll keep counting as the average.
 */
export function applyLevelUp(
  character: Character,
  classId: string,
  hp: HpChoice,
  index: PackIndex,
): Character {
  const next = structuredClone(character);
  const entry = index.get(classId);
  if (!entry) throw new Error(`Unknown class ${classId}`);
  const average = averageHp(classData(entry).hitDie);

  let cl = next.classes.find((c) => c.classId === classId);
  if (!cl) {
    cl = { classId, level: 0 };
    next.classes.push(cl);
  }
  cl.level += 1;

  const rolls = cl.hpRolls ?? [];
  while (rolls.length < cl.level - 1) rolls.push(average);
  rolls[cl.level - 1] = hp.type === "roll" ? hp.value : average;
  cl.hpRolls = rolls;
  return next;
}

export interface CasterChange {
  classId: string;
  cantrips: [number, number];
  /** Spells known, or the spellbook, or prepared spells: whichever the class has. */
  spells: [number, number];
  maxSpellLevel: [number, number];
}

/** What a level brings, worked out from the sheet before and after it. */
export interface LevelUpSummary {
  classId: string;
  classLevel: number;
  totalLevel: number;
  proficiencyBonus: [number, number];
  hitPoints: [number, number];
  hitDice: Record<string, number>;
  /** Feature ids the character did not have before. */
  newFeatures: string[];
  slots: [number[], number[]];
  pact: { before?: { level: number; count: number }; after?: { level: number; count: number } };
  casters: CasterChange[];
  /** More ability score improvements are available than before. */
  newAsi: boolean;
}

function spellsAllowed(lists: DerivedSheet["spellcasters"][number]["lists"]): number {
  return (lists.known ?? lists.prepared)?.allowed ?? 0;
}

export function summarizeLevelUp(
  classId: string,
  before: DerivedSheet,
  after: DerivedSheet,
): LevelUpSummary {
  const casters: CasterChange[] = after.spellcasters.map((caster) => {
    const old = before.spellcasters.find((c) => c.classId === caster.classId);
    return {
      classId: caster.classId,
      cantrips: [old?.lists.cantrips?.allowed ?? 0, caster.lists.cantrips?.allowed ?? 0],
      spells: [old ? spellsAllowed(old.lists) : 0, spellsAllowed(caster.lists)],
      maxSpellLevel: [old?.lists.maxSpellLevel ?? 0, caster.lists.maxSpellLevel],
    };
  });
  return {
    classId,
    classLevel: 0,
    totalLevel: after.level,
    proficiencyBonus: [before.proficiencyBonus, after.proficiencyBonus],
    hitPoints: [before.hitPoints.max, after.hitPoints.max],
    hitDice: after.hitPoints.hitDice,
    newFeatures: after.features.filter((f) => !before.features.includes(f)),
    slots: [before.spellSlots, after.spellSlots],
    pact: {
      ...(before.pactSlots && { before: before.pactSlots }),
      ...(after.pactSlots && { after: after.pactSlots }),
    },
    casters,
    newAsi: after.asi.available > before.asi.available,
  };
}

/** Everything a level brings, for a character and the class that gains it. */
export function previewLevelUp(
  character: Character,
  classId: string,
  hp: HpChoice,
  index: PackIndex,
  rules: HouseRules = NO_HOUSE_RULES,
): LevelUpSummary {
  const before = deriveSheet(character, index, rules);
  const leveled = applyLevelUp(character, classId, hp, index);
  const summary = summarizeLevelUp(classId, before, deriveSheet(leveled, index, rules));
  summary.classLevel = leveled.classes.find((c) => c.classId === classId)?.level ?? 0;
  return summary;
}

/** A thing the player still has to decide after levelling up. */
export type LevelUpTask =
  | { kind: "subclass"; classId: string }
  | { kind: "asi"; left: number }
  | { kind: "spells"; classId: string; left: number }
  | { kind: "choices"; left: number };

/** What is still open on the sheet: a subclass, ability improvements, spells, other choices. */
export function openTasks(
  character: Character,
  sheet: DerivedSheet,
  index: PackIndex,
): LevelUpTask[] {
  const tasks: LevelUpTask[] = [];
  for (const cl of character.classes) {
    const from = subclassLevel(cl.classId, index);
    if (from !== undefined && cl.level >= from && !cl.subclassId)
      tasks.push({ kind: "subclass", classId: cl.classId });
  }
  const asiLeft = sheet.asi.available - sheet.asi.used;
  if (asiLeft > 0) tasks.push({ kind: "asi", left: asiLeft });
  for (const caster of sheet.spellcasters) {
    const left = [caster.lists.cantrips, caster.lists.known, caster.lists.prepared].reduce(
      (sum, pick) => sum + (pick ? Math.max(0, pick.allowed - pick.chosen.length) : 0),
      0,
    );
    if (left > 0) tasks.push({ kind: "spells", classId: caster.classId, left });
  }
  const choices = sheet.choices.reduce((sum, choice) => sum + choice.remaining, 0);
  if (choices > 0) tasks.push({ kind: "choices", left: choices });
  return tasks;
}
