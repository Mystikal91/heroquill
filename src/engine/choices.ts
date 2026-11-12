import type { Ability, CreatureSize, Effect, Entry, ProficiencyCategory } from "../data/schema";
import type { PackIndex } from "./derive";
import type { OptionNeed } from "./optionNeeds";
import { evaluateRequirements } from "./requirements";
import { inRuleset, localizeSpells } from "./rulesets";
import { type Warning, warn } from "./warnings";

type ChoiceEffect = Extract<Effect, { type: "choice" }>;

/** A choice offered by species, class, background or a trait, with the current picks applied. */
export interface PendingChoice {
  /** Key under which the picks are stored in `Character.selections`. */
  key: string;
  /** The entry that offers the choice. */
  source: string;
  id: string;
  grants: ChoiceGrant;
  choose: number;
  /** Ability bonus per pick, for `abilityBonus` choices. */
  value?: number;
  options: string[];
  /** For a choice of features: what each option asks for, when it asks for something. */
  needs?: Record<string, OptionNeed>;
  /** Picks that are valid options, at most `choose` of them. */
  selected: string[];
  remaining: number;
}

export type ChoiceGrant = ChoiceEffect["grants"];

/** An effect with the entry it comes from, so the sheet can say where a number comes from. */
export interface SourcedEffect {
  effect: Effect;
  source: string;
}

export interface Collected {
  /** Every effect in force: direct ones, those of expanded traits and those of chosen options. */
  effects: Effect[];
  /** The same effects, each with the entry that gave it. */
  sourced: SourcedEffect[];
  choices: PendingChoice[];
  /** Every entry the walk met and every flag that was set. */
  seen: ReadonlySet<string>;
}

interface Input {
  index: PackIndex;
  selections: Record<string, string[]>;
  warnings: Warning[];
  /** The level that counts for what an entry gives; without it a trait that comes at a level is given at once. */
  levelOf?: (source: string) => number;
  /** The character's edition: an open choice lists only the feats of that edition's SRD and of added packs. */
  ruleset?: string;
}

/** The id without the number that makes it unique within its pack. */
export const withoutNumber = (id: string) => id.replace(/-\d+$/, "");

/** An id without the pack that holds it: the same content imported twice has two packs. */
const withoutPack = (id: string) => withoutNumber(id.slice(id.indexOf(":") + 1));

/**
 * The only option that has the id of `picked` apart from the number and the pack, if there is
 * just one: a choice made on a pack that was imported again is found in the new one.
 */
function renumbered(picked: string, options: string[]): string | undefined {
  const same = options.filter((o) => withoutPack(o) === withoutPack(picked));
  return same.length === 1 ? same[0] : undefined;
}

/**
 * The options of a choice: what it lists, or every feat when a feat choice lists none, or every
 * spell of the level it names when a spell choice has a `spellLevel` and lists none (the cantrips
 * of the Pact of the Tome come from the list of any class).
 */
function optionsOf(index: PackIndex, choice: ChoiceEffect, ruleset?: string): string[] {
  if (choice.from.length > 0) return choice.from;
  if (choice.grants === "feat")
    return [...index.values()]
      .filter((e) => e.kind === "feat" && (!ruleset || inRuleset(e.id, ruleset)))
      .map((e) => e.id);
  if (
    choice.grants === "spell" &&
    (choice.spellLevel !== undefined || choice.spellUpTo !== undefined)
  )
    return [...index.values()]
      .filter((e) => {
        if (e.kind !== "spell" || (ruleset && !inRuleset(e.id, ruleset))) return false;
        const level = typeof e.data.level === "number" ? e.data.level : 0;
        if (choice.spellLevel !== undefined && level !== choice.spellLevel) return false;
        if (choice.spellUpTo !== undefined && level > choice.spellUpTo) return false;
        if (choice.ritual && e.data.ritual !== true) return false;
        if (choice.spellClass) {
          const classes = e.data.classes;
          if (!Array.isArray(classes) || !classes.includes(choice.spellClass)) return false;
        }
        return true;
      })
      .map((e) => e.id);
  return choice.from;
}

/** The effect that picking `option` of a choice results in. */
function grantEffect(choice: ChoiceEffect, option: string): Effect {
  switch (choice.grants) {
    case "proficiency": {
      const [category, target] = option.split(":") as [ProficiencyCategory, string];
      return { type: "proficiency", category, target };
    }
    case "language":
      return { type: "proficiency", category: "language", target: option };
    case "abilityBonus":
      return { type: "abilityBonus", ability: option as Ability, value: choice.value ?? 1 };
    case "spell":
      return {
        type: "grantSpell",
        spell: option,
        ...(choice.free && { free: true }),
        ...(choice.rest && { rest: choice.rest }),
        ...(choice.atWill && { atWill: true }),
      };
    case "trait":
    case "feat":
      return { type: "trait", id: option };
    case "expertise":
      return { type: "expertise", skill: option };
    case "mastery":
      return { type: "weaponMastery", item: option };
    case "size":
      return { type: "size", size: option as CreatureSize };
  }
}

/**
 * Walks the effects of the given entries. Traits are followed into their own effects (each
 * once), and choices are resolved against the character's selections, so a picked option
 * contributes its effect exactly like a fixed one.
 */
export function collectEffects(entries: Entry[], input: Input, alsoHeld: string[] = []): Collected {
  // Effects behind a requirement (`when`) depend on what is held, and what is held depends on
  // the effects that apply (a trait, a flag). Walk again with what the last walk found until it
  // stops changing; a walk that met no requirement is final at once.
  let held = new Set([...entries.map((e) => e.id), ...alsoHeld]);
  for (let pass = 1; ; pass++) {
    const warnings: Warning[] = [];
    const walk = walkEffects(entries, { ...input, warnings }, held);
    const next = new Set([...alsoHeld, ...walk.seen]);
    const settled =
      !walk.gated ||
      pass >= 4 ||
      (next.size === held.size && [...next].every((id) => held.has(id)));
    if (settled) {
      input.warnings.push(...warnings);
      return walk;
    }
    held = next;
  }
}

function walkEffects(
  entries: Entry[],
  { index, selections, warnings, levelOf, ruleset }: Input,
  held: ReadonlySet<string>,
): Collected & { seen: Set<string>; gated: boolean } {
  const effects: Effect[] = [];
  const sourced: SourcedEffect[] = [];
  const choices: PendingChoice[] = [];
  const expanded = new Set<string>();
  const seen = new Set<string>(entries.map((e) => e.id));
  let gated = false;

  const expandTrait = (id: string) => {
    if (expanded.has(id)) return;
    expanded.add(id);
    seen.add(id);
    const trait = index.get(id);
    if (!trait) {
      warn(warnings, "unknownEntry", { id });
      return;
    }
    for (const effect of trait.effects) apply(effect, trait.id);
  };

  // The abilities that the ability increases of an entry have taken: "+2 to one and +1 to
  // another" means another, so a later increase of the same entry cannot pick the same one.
  const taken = new Map<string, Set<string>>();

  const resolve = (choice: ChoiceEffect, source: string) => {
    const key = `${source}/${choice.id}`;
    const selected: string[] = [];
    const used = choice.grants === "abilityBonus" ? taken.get(source) : undefined;
    const options = optionsOf(index, choice, ruleset).filter((o) => !used?.has(o));
    for (const picked of selections[key] ?? []) {
      // An entry that was numbered differently when the pack was imported again (`charisma-2`
      // became `charisma-11`) is the one option of the choice with the same name.
      const option = options.includes(picked) ? picked : renumbered(picked, options);
      // An ability that an earlier increase took is left unpicked, without a warning: the
      // earlier one was changed to it after this one was made.
      if (!option && used?.has(picked)) continue;
      if (!option) warn(warnings, "invalidChoice", { source, option: picked });
      else if (selected.includes(option)) continue;
      else if (selected.length >= choice.choose) warn(warnings, "tooManyChoices", { source });
      else selected.push(option);
    }
    choices.push({
      key,
      source,
      id: choice.id,
      grants: choice.grants,
      choose: choice.choose,
      ...(choice.value !== undefined && { value: choice.value }),
      options,
      selected,
      remaining: choice.choose - selected.length,
    });
    if (choice.grants === "abilityBonus")
      taken.set(source, new Set([...(used ?? []), ...selected]));
    for (const option of selected) apply(grantEffect(choice, option), source);
  };

  const apply = (written: Effect, source: string) => {
    // A book wrote the spells of the 2014 SRD: a 2024 character takes the 2024 spell of the same name.
    const effect = ruleset === "srd52" ? localizeSpells(written, index) : written;
    if (effect.type === "choice") return resolve(effect, source);
    if (effect.type === "flag") {
      seen.add(effect.id);
      return;
    }
    if (effect.type === "when") {
      gated = true;
      if (evaluateRequirements(effect.requires, (word) => held.has(word)))
        for (const inner of effect.effects) apply(inner, source);
      return;
    }
    // A trait that comes at a level is not there before it (Fey Step of the season, at the 3rd).
    if (effect.type === "trait" && effect.minLevel !== undefined && levelOf)
      if (levelOf(source) < effect.minLevel) return;
    effects.push(effect);
    sourced.push({ effect, source });
    if (effect.type === "trait") expandTrait(effect.id);
  };

  for (const entry of entries) for (const effect of entry.effects) apply(effect, entry.id);
  return { effects, sourced, choices, seen, gated };
}
