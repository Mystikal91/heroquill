import { ABILITIES, type Ability } from "../data/schema";
import { STANDARD_ARRAY, applyAbilityMethod, standardPointBuy } from "../engine/abilityScores";
import type { PendingChoice } from "../engine/choices";
import { abilityPriority, suggestPicks, suggestSpells, suggestedBase } from "../engine/suggest";
import { character, content, sheet, updateCharacter } from "./store";

/**
 * The build screen's "Assign for me" and "Choose for me": what `engine/suggest.ts` picks, put on the
 * character. Each one only fills what is empty or sets a starting point; the person changes it after.
 */

/** The abilities in the order the first class of the character wants them. */
export function classPriority(): Ability[] {
  const first = character.value.classes[0]?.classId;
  const data = first ? content.value?.index.get(first)?.data : undefined;
  const required = (
    (data as { multiclassing?: { prerequisites?: { ability?: string }[] } } | undefined)
      ?.multiclassing?.prerequisites ?? []
  )
    .map((p) => p.ability)
    .filter((a): a is Ability => ABILITIES.includes(a as Ability));
  return abilityPriority(first, required);
}

const sameRules = (a: Record<string, number>, b: Record<string, number>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

/**
 * Gives the abilities the values of the method in the class's order. By hand, it first switches to the
 * standard array; the point buy takes the standard array too (it costs the 27 points exactly), unless
 * the person changed its rules.
 */
export function assignAbilitiesForMe() {
  const order = classPriority();
  updateCharacter((d) => {
    const book = standardPointBuy();
    const customRules =
      d.pointBuyRules !== undefined &&
      (d.pointBuyRules.budget !== book.budget || !sameRules(d.pointBuyRules.costs, book.costs));
    if (d.abilityMethod === "manual" || (d.abilityMethod === "pointbuy" && customRules))
      applyAbilityMethod(d, "standard");
    const values = d.abilityMethod === "roll" ? (d.abilityRolls ?? STANDARD_ARRAY) : STANDARD_ARRAY;
    d.abilityBase = suggestedBase(order, values);
  });
}

/** Whether a choice already holds the option elsewhere (a language known, a skill from the class). */
function heldOf(choice: PendingChoice) {
  const s = sheet.value;
  return (option: string) => {
    if (!s) return false;
    if (choice.grants === "language") return s.proficiencies.language.includes(option);
    if (choice.grants === "proficiency") {
      const [category, target = ""] = option.split(":");
      return (s.proficiencies[category as keyof typeof s.proficiencies] ?? []).includes(target);
    }
    return false;
  };
}

/** The picks "Choose for me" would make now, by choice. */
function plannedPicks(only?: (choice: PendingChoice) => boolean): [PendingChoice, string[]][] {
  const s = sheet.value;
  const c = content.value;
  if (!s || !c) return [];
  const ruleset = character.value.ruleset;
  const modifier = Object.fromEntries(ABILITIES.map((a) => [a, s.abilities[a].modifier])) as Record<
    Ability,
    number
  >;
  const priority = classPriority();
  const skillAbility = (slug: string) => {
    const ability = c.index.get(`${ruleset}:skill/${slug}`)?.data.ability;
    return ABILITIES.includes(ability as Ability) ? (ability as Ability) : undefined;
  };
  return s.choices
    .filter((choice) => !only || only(choice))
    .map((choice): [PendingChoice, string[]] => [
      choice,
      suggestPicks(choice, { held: heldOf(choice), skillAbility, modifier, priority }),
    ])
    .filter(([, picks]) => picks.length > 0);
}

/** How many picks "Choose for me" can make among these choices: the button shows only when there are some. */
export const fillableCount = (only?: (choice: PendingChoice) => boolean) =>
  plannedPicks(only).reduce((sum, [, picks]) => sum + picks.length, 0);

/**
 * Fills the choices of skills, languages, expertise and ability bonuses that are still open. A pick can
 * open another choice, so it looks again a few times.
 */
export function fillChoicesForMe(only?: (choice: PendingChoice) => boolean) {
  for (let round = 0; round < 3; round++) {
    const planned = plannedPicks(only);
    if (planned.length === 0) return;
    updateCharacter((d) => {
      for (const [choice, picks] of planned)
        d.selections[choice.key] = [...(d.selections[choice.key] ?? []), ...picks];
    });
  }
}

/** Spells still to pick in the lists of the classes that cast. */
export function spellsLeft(): number {
  return (sheet.value?.spellcasters ?? []).reduce(
    (total, caster) =>
      total +
      [caster.lists.cantrips, caster.lists.known, caster.lists.prepared].reduce(
        (sum, pick) => sum + (pick ? Math.max(0, pick.allowed - pick.chosen.length) : 0),
        0,
      ),
    0,
  );
}

/**
 * Fills the spell lists that are not full with the class's usual spells: cantrips and the spellbook or
 * the spells known first, then the prepared ones, which are picked from what the first step gave.
 */
export function fillSpellsForMe() {
  const c = content.value;
  if (!c) return;
  const level = (id: string) => (c.index.get(id)?.data.level as number) ?? 0;
  const name = (id: string) => c.name(id);
  for (const lists of [["cantrips", "known"], ["prepared"]] as const) {
    const casters = sheet.value?.spellcasters ?? [];
    const adds: { classId: string; list: "cantrips" | "known" | "prepared"; ids: string[] }[] = [];
    for (const caster of casters)
      for (const list of lists) {
        const pick = caster.lists[list];
        if (!pick) continue;
        const limit = pick.restriction;
        const schoolOf = (id: string) => String(c.index.get(id)?.data.school ?? "");
        const barred = (id: string) => Boolean(limit && !limit.schools.includes(schoolOf(id)));
        const ids = suggestSpells(
          caster.classId,
          pick.pool,
          pick.chosen,
          pick.allowed,
          level,
          name,
          barred,
        );
        if (ids.length > 0) adds.push({ classId: caster.classId, list, ids });
      }
    if (adds.length === 0) continue;
    updateCharacter((d) => {
      for (const { classId, list, ids } of adds) {
        const entry = d.spells[classId] ?? { cantrips: [], known: [], prepared: [] };
        d.spells[classId] = entry;
        entry[list] = [...entry[list], ...ids];
      }
    });
  }
}
