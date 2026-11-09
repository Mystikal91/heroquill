import { classData, subclassData } from "../data/progression";
import {
  ABILITIES,
  type Ability,
  type Effect,
  type Entry,
  PROFICIENCY_CATEGORIES,
  type Pack,
  type ProficiencyCategory,
  type Sense,
} from "../data/schema";
import { abilityModifier } from "./abilities";
import { inBeastShape, withBeastChecks } from "./beastForm";
import type { Character } from "./character";
import { type ChecksResult, deriveChecks, halfBonus } from "./checks";
import { type PendingChoice, collectEffects } from "./choices";
import { customResources } from "./custom";
import { type EquipmentResult, deriveEquipment, proficiencyKeys } from "./equipment";
import { type FeatureValue, deriveFeatureValues } from "./featureValues";
import { type AppliedModifier, appliedModifiers, total } from "./modifiers";
import { type Movement, deriveMovement, deriveSenses } from "./movement";
import { type CasterInput, casterKind, slotPools, unmetPrerequisites } from "./multiclass";
import { type OptionNeed, checkNeeds, needsOf } from "./optionNeeds";
import { OVERRIDE, numberOverride } from "./overrides";
import { type ClassFact, type ClassResource, type ExtraDamage, classResources } from "./resources";
import { type FeatureSource, featureSources } from "./sources";
import type { SpellBonus, SpellHealing } from "./spellRolls";
import { type SpellLists, deriveSpellLists } from "./spells";
import { type Spend, deriveSpends } from "./spends";
import { withSubclassCasting } from "./subclassCasting";
import { deriveFreeSpells, deriveUses, withFeatureSettings } from "./uses";
import { type Warning, warn } from "./warnings";

export type PackIndex = Map<string, Entry>;

export function indexPacks(...packs: Pack[]): PackIndex {
  const index: PackIndex = new Map();
  for (const pack of packs) for (const entry of pack.entries) index.set(entry.id, entry);
  return index;
}

export interface AbilityResult {
  base: number;
  bonus: number;
  score: number;
  modifier: number;
  overridden: boolean;
}

export interface SpellcastingResult {
  classId: string;
  /** Pact Magic: slots come back on a short rest. */
  pact: boolean;
  ability: Ability;
  saveDc: number;
  attackBonus: number;
  cantripsKnown?: number;
  spellsKnown?: number;
  /** Slots for spell levels 1..9. */
  spellSlots: number[];
  /** What the class may pick and what is picked. */
  lists: SpellLists;
}

export interface DerivedSheet extends EquipmentResult, ChecksResult {
  /** Total character level (0 while no class is chosen). */
  level: number;
  proficiencyBonus: number;
  initiative: number;
  /** The save DC of martial features (maneuvers): 8 + proficiency + Strength or Dexterity, the better. */
  martialSaveDc: number;
  /**
   * The bonuses that features and choices give right now, with where each comes from: armor
   * class, speed, initiative, hit points per level, and attack and damage rolls.
   */
  bonuses: AppliedModifier[];
  /** Walking speed in feet; undefined while no species is chosen. */
  speed?: number;
  /** The creature size (`medium`, `small`): the one the person chose, else the species' own; undefined while there is none. */
  size?: string;
  /** Climbing, swimming, flying and burrowing speeds; none while no species is chosen. */
  movement: Movement;
  /** Senses with their range in feet (darkvision, blindsight...). */
  senses: Partial<Record<Sense, number>>;
  abilities: Record<Ability, AbilityResult>;
  hitPoints: { max: number; overridden: boolean; hitDice: Record<string, number> };
  proficiencies: Record<ProficiencyCategory, string[]>;
  traits: string[];
  /** Damage types the character resists, is immune to or is vulnerable to. */
  defenses: Record<"resistance" | "immunity" | "vulnerability", string[]>;
  /** Class and subclass features unlocked at the current levels. */
  features: string[];
  /** Where each feature and trait comes from, to name it next to the text. */
  featureSources: Record<string, FeatureSource>;
  /** The numbers features show (a save DC, dice, a range), by the entry that gives them. */
  featureValues: Record<string, FeatureValue[]>;
  /** What the features that use a pool of the class take from it, by the entry that is used. */
  spends: Record<string, Spend>;
  /** The items the character is attuned to (the equipped ones that ask for it) and how many it may be. */
  attunement: { used: number; max: number };
  /** Conditions the character cannot suffer (ids of the condition entries). */
  conditionImmunities: string[];
  /** The lowest die that is a critical hit with weapon attacks (20, or less with Improved Critical). */
  critRange: number;
  /** A die lower than this counts as this on checks with a skill the character is proficient in (0: none). */
  proficientSkillFloor: number;
  /** The first spellcasting class: the one whose numbers the sheet headlines. */
  spellcasting?: SpellcastingResult;
  /** Every spellcasting class, in the order the character took them. */
  spellcasters: SpellcastingResult[];
  /** Spell slots of levels 1..9 shared by all spellcasting classes. */
  spellSlots: number[];
  /** Limited-use class features (rages, ki, channel divinity...) and their recovery. */
  resources: ClassResource[];
  /** Features, traits and feats the person hid from the sheet (their effects still apply). */
  hiddenFeatures: string[];
  /** Entries a better step of the same feature replaces, as `replaced id -> id that replaces it`. */
  superseded: Record<string, string>;
  /** Class numbers worth showing during play: sneak attack dice, rage damage and the like. */
  facts: ClassFact[];
  /** Damage the classes add to attacks: sneak attack, rage, smite... */
  extraDamage: ExtraDamage[];
  /** Pact Magic slots kept apart when a warlock multiclasses; they return on a short rest. */
  pactSlots?: { level: number; count: number };
  /** Choices offered by the current picks (species, class, background, traits), with their state. */
  choices: PendingChoice[];
  /** Spells granted outright or by a choice (e.g. a High Elf cantrip). */
  grantedSpells: string[];
  /** The granted spells that can be cast as often as wanted without a slot (an invocation): cantrips in all but their level. */
  atWillSpells: string[];
  /** The weapons (items) whose mastery property the character can use. */
  weaponMasteries: string[];
  /** Ids of what the character has (features, traits, spells, class, subclass, flags): what a requirement checks. */
  held: string[];
  /** What features add to the damage that spells roll (Agonizing Blast: the Charisma modifier), see `spellRolls`. */
  spellDamage: SpellBonus[];
  /** What features do to the healing of spells (Disciple of Life, Supreme Healing, Blessed Healer). */
  spellHealing: SpellHealing;
  /** Feats the character took. */
  feats: string[];
  /** Ability Score Improvements available from class levels and how many are taken. */
  asi: { available: number; used: number };
  /** Problems found while deriving. Never blocking: the sheet is still produced. */
  warnings: Warning[];
}

const MAX_LEVEL = 20;

export const proficiencyBonusForLevel = (level: number) => Math.ceil(Math.max(level, 1) / 4) + 1;

function lookup(index: PackIndex, id: string, warnings: Warning[]): Entry | undefined {
  const entry = index.get(id);
  if (!entry) warn(warnings, "unknownEntry", { id });
  return entry;
}

/** A feature that offers more picks as the class grows takes the number from the class table. */
function sizeChoices(feature: Entry, table: Record<string, unknown> | undefined): Entry {
  if (!feature.effects.some((e) => e.type === "choice" && e.chooseBy)) return feature;
  const effects = feature.effects.flatMap((e) => {
    if (e.type !== "choice" || !e.chooseBy) return [e];
    const size = table?.[e.chooseBy];
    return typeof size === "number" && size > 0 ? [{ ...e, choose: size }] : [];
  });
  return { ...feature, effects };
}

function defensesOf(effects: Effect[]): DerivedSheet["defenses"] {
  const found: DerivedSheet["defenses"] = { resistance: [], immunity: [], vulnerability: [] };
  for (const e of effects) {
    if (e.type === "defense" && !found[e.kind].includes(e.damage)) found[e.kind].push(e.damage);
  }
  return found;
}

function overrideNumber(character: Character, key: string): number | undefined {
  const value = character.overrides[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * The sheet of a character. In the shape of a beast (Wild Shape), once the beast is known, the
 * game statistics are the beast's and its skills and saves count where they are better.
 */
export function deriveSheet(character: Character, index: PackIndex): DerivedSheet {
  const shape = character.play.wildShape;
  const beast = shape ? index.get(shape.monster) : undefined;
  const sheet = beast
    ? withBeastChecks(deriveForm(inBeastShape(character, beast), index), beast)
    : deriveForm(character, index);
  return withFeatureSettings(sheet, character.featureSettings, index);
}

function deriveForm(character: Character, index: PackIndex): DerivedSheet {
  const warnings: Warning[] = [];

  // Species, subspecies, background and the starting class contribute their effects;
  // other classes only contribute their multiclass proficiencies.
  const featIds = character.feats ?? [];
  // An option whose pack is gone is left out quietly: it is a switch, not something chosen.
  const options = (character.options ?? []).filter((id) => index.has(id));
  const chosen = [...Object.values(character.choices), ...featIds, ...options]
    .filter((id): id is string => Boolean(id))
    .flatMap((id) => lookup(index, id, warnings) ?? []);
  const classEntries = character.classes.map((cl) => ({
    cl,
    entry: lookup(index, cl.classId, warnings),
  }));
  const [starting, ...others] = classEntries;

  // The features a class has reached, and its subclass's, add their effects and offer their
  // choices (a fighting style) like species and background do. A choice whose size grows with
  // the class (invocations, metamagic) takes its size from the class table.
  const reached: Entry[] = [];
  for (const { cl, entry } of classEntries) {
    if (!entry) continue;
    const ids: string[] = [];
    for (const l of classData(entry).levels) if (l.level <= cl.level) ids.push(...l.features);
    const sub = cl.subclassId ? index.get(cl.subclassId) : undefined;
    if (sub?.parent === cl.classId)
      for (const l of subclassData(sub).levels) if (l.level <= cl.level) ids.push(...l.features);
    const row = classData(entry).levels.find((l) => l.level === cl.level);
    for (const id of ids) {
      const feature = index.get(id);
      if (feature) reached.push(sizeChoices(feature, row?.classSpecific));
    }
  }
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  const levelOf = (source: string) => {
    const owner = index.get(source)?.data.class;
    return owner
      ? (character.classes.find((cl) => cl.classId === owner)?.level ?? 0)
      : character.classes.reduce((sum, cl) => sum + cl.level, 0);
  };
  // What the character has equipped adds its effects, like a ring that grants a resistance.
  const wornWithEffects = character.inventory
    .filter((i) => i.equipped)
    .flatMap((i) =>
      [i.itemId, i.enchantment].flatMap((id) => {
        const entry = id ? index.get(id) : undefined;
        return entry && entry.effects.length > 0 ? [entry] : [];
      }),
    );
  // A variant of a species (a half-elf of another descent) carries the species' effects itself.
  const standsIn = chosen.some((e) => e.kind === "subspecies" && e.data.replacesSpecies === true);
  const contributing = standsIn ? chosen.filter((e) => e.kind !== "species") : chosen;
  const {
    effects,
    sourced,
    choices,
    seen: heldIds,
  } = collectEffects(
    [...contributing, ...wornWithEffects, ...(starting?.entry ? [starting.entry] : []), ...reached],
    { index, selections: character.selections, warnings, levelOf, ruleset: character.ruleset },
    [
      ...character.classes.flatMap((cl) => [cl.classId, cl.subclassId ?? ""]),
      ...Object.values(character.choices),
      // Aurora's `[level:ranger:6]`: the level reached in a class, by the class's name.
      ...character.classes.flatMap((cl) =>
        Array.from(
          { length: Math.min(cl.level, MAX_LEVEL) },
          (_, n) => `[level:${cl.classId.split("/")[1] ?? ""}:${n + 1}]`,
        ),
      ),
    ].filter((id): id is string => Boolean(id)),
  );
  for (const { entry } of others) {
    if (!entry) continue;
    for (const key of classData(entry).multiclassing.proficiencies) {
      const [category, target] = key.split(":") as [ProficiencyCategory, string];
      effects.push({ type: "proficiency", category, target });
    }
  }

  // Levels
  const level = character.classes.reduce((sum, cl) => sum + cl.level, 0);
  if (level > MAX_LEVEL) warn(warnings, "levelTooHigh", { level, max: MAX_LEVEL });
  const proficiencyBonus =
    overrideNumber(character, "proficiencyBonus") ?? proficiencyBonusForLevel(level);

  // Ability Score Improvements: +2 to one ability or +1 to two different ones, per slot.
  const asiAvailable = classEntries.reduce((sum, { cl, entry }) => {
    const row = entry && classData(entry).levels.find((l) => l.level === cl.level);
    return sum + (row?.abilityScoreImprovements ?? 0);
  }, 0);
  // Feats take their improvements first; the rest of the slots are ability increases.
  if (character.asi.length + featIds.length > asiAvailable)
    warn(warnings, "asiTooMany", { available: asiAvailable });
  let asiUsed = Math.min(featIds.length, asiAvailable);
  character.asi.slice(0, Math.max(0, asiAvailable - featIds.length)).forEach((slot, i) => {
    if (new Set(slot).size !== slot.length) {
      warn(warnings, "asiInvalid", { slot: i + 1 });
      return;
    }
    asiUsed += 1;
    for (const ability of slot) {
      effects.push({ type: "abilityBonus", ability, value: slot.length === 1 ? 2 : 1 });
    }
  });

  // Abilities
  const abilities = {} as Record<Ability, AbilityResult>;
  /** The highest an ability may go: 20, or what a feature raises it to (a barbarian's 24). */
  const limits = {} as Record<Ability, number>;
  for (const ability of ABILITIES) {
    const base = character.abilityBase[ability];
    const bonus = effects.reduce(
      (sum, e) => (e.type === "abilityBonus" && e.ability === ability ? sum + e.value : sum),
      0,
    );
    const override = overrideNumber(character, `ability.${ability}`);
    const overridden = override !== undefined;
    const floor = effects.reduce(
      (most, e) =>
        e.type === "abilityFloor" && e.ability === ability ? Math.max(most, e.value) : most,
      0,
    );
    const score = override ?? Math.max(base + bonus, floor);
    limits[ability] = effects.reduce(
      (most, e) =>
        e.type === "abilityBonus" && e.ability === ability ? Math.max(most, e.max ?? 20) : most,
      20,
    );
    if (!overridden && score > limits[ability])
      warn(warnings, "abilityTooHigh", { ability, score });
    abilities[ability] = {
      base,
      bonus: overridden ? bonus : score - base,
      score,
      modifier: abilityModifier(score),
      overridden,
    };
  }

  // A feat may ask for minimum ability scores.
  for (const entry of chosen) {
    if (entry.kind !== "feat") continue;
    const needs =
      (entry.data.prerequisites as { ability: Ability; minimum: number }[] | undefined) ?? [];
    for (const need of needs) {
      if (abilities[need.ability].score < need.minimum)
        warn(warnings, "featPrerequisite", {
          feat: entry.id,
          ability: need.ability,
          minimum: need.minimum,
        });
    }
  }

  // A character can attune to three items at once, more with some features.
  const attunementMax = Math.max(
    3,
    ...effects.flatMap((e) => (e.type === "attunementMax" ? [e.value] : [])),
  );
  const attuned = character.inventory.filter(
    (i) =>
      i.equipped &&
      (index.get(i.itemId)?.data.attunement === true ||
        (i.enchantment !== undefined && index.get(i.enchantment)?.data.attunement === true)),
  ).length;
  if (attuned > attunementMax)
    warn(warnings, "attunementTooMany", { count: attuned, max: attunementMax });

  // Hit points, features, spellcasting
  const conMod = abilities.con.modifier;
  let hp = 0;
  const hitDice: Record<string, number> = {};
  const features: string[] = [];
  const casters: SpellcastingResult[] = [];
  const casterInputs: CasterInput[] = [];
  const resources: ClassResource[] = customResources(character.custom ?? []);
  const facts: ClassFact[] = [];
  const extraDamage: ExtraDamage[] = [];
  classEntries.forEach(({ cl, entry }, position) => {
    if (!entry) return;
    const data = classData(entry);
    hitDice[`d${data.hitDie}`] = (hitDice[`d${data.hitDie}`] ?? 0) + cl.level;
    for (let lvl = 1; lvl <= cl.level; lvl++) {
      const first = position === 0 && lvl === 1;
      const roll = first ? data.hitDie : (cl.hpRolls?.[lvl - 1] ?? Math.floor(data.hitDie / 2) + 1);
      hp += Math.max(1, roll + conMod);
    }

    for (const l of data.levels) if (l.level <= cl.level) features.push(...l.features);
    const classBits = classResources({
      classId: cl.classId,
      level: cl.level,
      data,
      modifier: (a) => abilities[a].modifier,
      proficiencyBonus,
    });
    resources.push(...classBits.resources);
    facts.push(...classBits.facts);
    extraDamage.push(...classBits.extras);

    let subEntry: Entry | undefined;
    if (cl.subclassId) {
      const sub = lookup(index, cl.subclassId, warnings);
      subEntry = sub;
      if (sub) {
        if (sub.parent !== cl.classId)
          warn(warnings, "subclassMismatch", { subclass: cl.subclassId, class: cl.classId });
        for (const l of subclassData(sub).levels)
          if (l.level <= cl.level) features.push(...l.features);
      }
    }

    // A class without spellcasting may get it from its subclass (Eldritch Knight).
    const subCasting = subEntry ? subclassData(subEntry).spellcasting : undefined;
    const cast = (subEntry && withSubclassCasting(data, subclassData(subEntry))) || data;
    const castRow = cast.levels.find((l) => l.level === cl.level);
    if (cast.spellcasting && cl.level >= cast.spellcasting.startsAtLevel && castRow?.spellSlots) {
      const kind = subCasting && cast !== data ? subCasting.kind : casterKind(cl.classId, data);
      if (kind) casterInputs.push({ kind, level: cl.level, ownSlots: castRow.spellSlots });
      const ability = cast.spellcasting.ability;
      const modifier = abilities[ability].modifier;
      casters.push({
        classId: cl.classId,
        pact: kind === "pact",
        ability,
        saveDc:
          numberOverride(character.overrides, OVERRIDE.spellSaveDc) ??
          8 + proficiencyBonus + modifier,
        attackBonus:
          numberOverride(character.overrides, OVERRIDE.spellAttack) ?? proficiencyBonus + modifier,
        ...(castRow.cantripsKnown !== undefined && { cantripsKnown: castRow.cantripsKnown }),
        ...(castRow.spellsKnown !== undefined && { spellsKnown: castRow.spellsKnown }),
        spellSlots: castRow.spellSlots,
        lists: deriveSpellLists({
          classId: subCasting && cast !== data ? subCasting.list : cl.classId,
          data: cast,
          level: cl.level,
          abilityModifier: modifier,
          picks: character.spells[cl.classId],
          index,
          subclass: subEntry,
          ...(subCasting && cast !== data && subCasting.schools && { schools: subCasting.schools }),
          warnings,
        }),
      });
    }
  });
  const hpOverride = overrideNumber(character, "hp.max");
  // Several casting classes share their slots; each class keeps its own spell lists.
  const pools = slotPools(casterInputs);
  // The slots a sorcerer made from sorcery points count with the others until a long rest.
  const created = character.play.createdSlots;
  const slots = created ? pools.slots.map((n, i) => n + (created[i] ?? 0)) : pools.slots;
  for (const caster of casters) caster.spellSlots = slots;
  const spellcasting = casters[0];

  // Multiclassing asks for a minimum in the key abilities of every class involved.
  if (classEntries.length > 1) {
    for (const { cl, entry } of classEntries) {
      if (!entry) continue;
      for (const need of unmetPrerequisites(classData(entry), (a) => abilities[a].score))
        warn(warnings, "multiclassPrerequisite", {
          class: cl.classId,
          ability: need.ability,
          minimum: need.minimum,
        });
    }
  }

  // Proficiencies and traits
  const proficiencies = Object.fromEntries(
    PROFICIENCY_CATEGORIES.map((c) => [c, [] as string[]]),
  ) as Record<ProficiencyCategory, string[]>;
  const traits: string[] = [];
  // A feat that a species, background or class gives (or lets you pick) is listed as a feat.
  const givenFeats: string[] = [];
  for (const effect of effects) {
    if (effect.type === "proficiency") {
      const list = proficiencies[effect.category];
      if (!list.includes(effect.target)) list.push(effect.target);
    } else if (effect.type === "trait") {
      if (index.get(effect.id)?.kind === "feat") {
        if (!givenFeats.includes(effect.id)) givenFeats.push(effect.id);
      } else if (!traits.includes(effect.id)) traits.push(effect.id);
    }
  }

  const held = proficiencyKeys(proficiencies);
  // The size: the one picked where the species lets you pick, else the species' own.
  const speciesSize = chosen.find((e) => e.kind === "species")?.data.size;
  const size =
    effects.flatMap((e) => (e.type === "size" ? [e.size] : []))[0] ??
    (typeof speciesSize === "string" ? speciesSize : undefined);
  const equipment = deriveEquipment({
    character,
    index,
    abilities,
    size,
    held,
    seen: heldIds,
    proficiencyBonus,
    sourced,
    levelOf,
    warnings,
    spellAbilities: casters.map((c) => c.ability),
    martialArts: extraDamage.find((e) => e.kind === "martialArts")?.dice,
    featIds: [
      ...new Set([...chosen.filter((e) => e.kind === "feat").map((e) => e.id), ...givenFeats]),
    ],
  });

  // Expertise doubles the proficiency bonus of skills the character is proficient in.
  const expertise = new Set<string>();
  for (const effect of effects) {
    if (effect.type !== "expertise") continue;
    const isSkill = index.has(`${character.ruleset}:skill/${effect.skill}`);
    if (isSkill && !held.has(`skill:${effect.skill}`))
      warn(warnings, "expertiseNeedsProficiency", {
        skill: `${character.ruleset}:skill/${effect.skill}`,
      });
    else if (isSkill) expertise.add(effect.skill);
  }
  const halves = effects.flatMap((e) =>
    e.type === "halfProficiency"
      ? [{ round: e.round, ...(e.abilities && { abilities: e.abilities }) }]
      : [],
  );

  // What an option asks of the character (an invocation: a level, a pact, a cantrip): each option
  // of a choice says whether it is met, and one that is picked without it is warned about.
  const heldNow = new Set<string>([
    ...heldIds,
    ...reached.map((e) => e.id),
    ...traits,
    ...character.classes.flatMap((cl) => [cl.classId, cl.subclassId ?? ""]),
    ...Object.values(character.choices),
    ...Object.values(character.spells).flatMap((l) => [...l.cantrips, ...l.known, ...l.prepared]),
    ...sourced.flatMap(({ effect }) => (effect.type === "grantSpell" ? [effect.spell] : [])),
  ]);
  const scores = Object.fromEntries(Object.entries(abilities).map(([id, a]) => [id, a.score]));
  for (const choice of choices) {
    if (choice.grants !== "trait" && choice.grants !== "feat") continue;
    // A feat is asked for the level of the character, a feature of a class for the level in it.
    const state = {
      level: choice.grants === "feat" ? level : levelOf(choice.source),
      held: heldNow,
      scores,
    };
    const needs: Record<string, OptionNeed> = {};
    for (const option of choice.options) {
      const expression = needsOf(index.get(option));
      if (expression)
        needs[option] = { expression, met: checkNeeds(expression, state, (w) => index.has(w)).met };
    }
    if (Object.keys(needs).length > 0) choice.needs = needs;
    for (const id of choice.selected) {
      const need = needs[id];
      if (!need || need.met) continue;
      for (const word of checkNeeds(need.expression, state, (w) => index.has(w)).missing) {
        if ("level" in word) {
          warn(warnings, "optionLevel", { option: id, level: word.level });
        } else if ("ability" in word) {
          // A score a feat asks for is warned about as `featPrerequisite`.
        } else {
          const isSpell = index.get(word.id)?.kind === "spell";
          warn(warnings, isSpell ? "optionSpell" : "optionFeature", {
            option: id,
            ...(isSpell ? { spell: word.id } : { feature: word.id }),
          });
        }
      }
    }
  }
  // What a bonus to saving throws can read: the modifiers and the proficiency bonus (an aura adds Charisma).
  const saveState = {
    armor: equipment.armor,
    levelOf,
    proficiencyBonus,
    abilityModifier: (a: Ability) => abilities[a].modifier,
  };
  const checks = deriveChecks({
    index,
    ruleset: character.ruleset,
    abilities,
    held,
    proficiencyBonus,
    expertise,
    halves,
    overrides: character.overrides,
    saveBonus: total(appliedModifiers(sourced, "save", saveState)),
    skillBonus: (slug) =>
      total(
        appliedModifiers(sourced, "skill", { armor: equipment.armor, levelOf }).filter(
          (m) => !m.skill || m.skill === slug,
        ),
      ),
  });
  const baseSpeed = chosen.find((e) => e.kind === "species")?.data.speed;
  const state = {
    armor: equipment.armor,
    levelOf,
    abilityModifier: (a: Ability) => abilities[a].modifier,
    proficiencyBonus,
  };
  const speedMods = appliedModifiers(sourced, "speed", state);
  const initiativeMods = appliedModifiers(sourced, "initiative", state);
  const hpMods = appliedModifiers(sourced, "hpPerLevel", state);
  const hpFlat = appliedModifiers(sourced, "hp", state);
  // A bonus to the spell attack and the save DC of items and features, unless forced in Free edit.
  const spellAttackMods = appliedModifiers(sourced, "spellAttack", state);
  const spellDcMods = appliedModifiers(sourced, "spellDc", state);
  // A bonus to every skill is told on the sheet; one for a single skill is only in its number.
  const skillMods = appliedModifiers(sourced, "skill", state).filter((m) => !m.skill);
  const saveMods = appliedModifiers(sourced, "save", saveState);
  for (const caster of casters) {
    if (numberOverride(character.overrides, OVERRIDE.spellAttack) === undefined)
      caster.attackBonus += total(spellAttackMods);
    if (numberOverride(character.overrides, OVERRIDE.spellSaveDc) === undefined)
      caster.saveDc += total(spellDcMods);
  }
  const speed =
    overrideNumber(character, "speed") ??
    (typeof baseSpeed === "number" ? baseSpeed + total(speedMods) : undefined);
  const movement =
    speed === undefined ? {} : deriveMovement(sourced, state, speed, total(speedMods));
  const senses = deriveSenses(sourced, state);
  // A feature of a class counts that class's levels; a trait of the species counts all of them.
  const hpBonus = hpMods.reduce((sum, m) => {
    const owner = index.get(m.source)?.data.class;
    const levels = owner
      ? (character.classes.find((cl) => cl.classId === owner)?.level ?? 0)
      : level;
    return sum + m.value * levels;
  }, 0);

  // Where each bonus comes from, once, for the sheet to show.
  const bonuses: AppliedModifier[] = [];
  const seen = new Set<string>();
  const note = (m: AppliedModifier) => {
    const key = `${m.target}|${m.source}|${m.value}`;
    if (seen.has(key)) return;
    seen.add(key);
    bonuses.push(m);
  };
  for (const part of equipment.armorClass.parts)
    if (part.source === "feature" && part.feature)
      note({ target: "ac", value: part.value, source: part.feature });
  for (const m of [
    ...speedMods,
    ...initiativeMods,
    ...hpMods,
    ...hpFlat,
    ...spellAttackMods,
    ...spellDcMods,
    ...skillMods,
    ...saveMods,
  ])
    note(m);
  for (const attack of [...equipment.attacks, ...(equipment.unarmed ? [equipment.unarmed] : [])])
    for (const m of attack.modifiers ?? []) note(m);

  const valueState = {
    levelOf,
    level: character.classes.reduce((sum, cl) => sum + cl.level, 0),
    proficiencyBonus,
    ability: (a: Ability) => abilities[a],
    classLevel: (slug: string) =>
      character.classes
        .filter((cl) => cl.classId.split("/")[1] === slug)
        .reduce((sum, cl) => sum + cl.level, 0),
  };
  // What features and traits say about how often they can be used.
  resources.push(...deriveUses(sourced, valueState), ...deriveFreeSpells(sourced, levelOf));

  return {
    ...equipment,
    ...checks,
    martialSaveDc:
      overrideNumber(character, OVERRIDE.martialSaveDc) ??
      8 + proficiencyBonus + Math.max(abilities.str.modifier, abilities.dex.modifier),
    initiative:
      overrideNumber(character, "initiative") ??
      abilities.dex.modifier + halfBonus(halves, "dex", proficiencyBonus) + total(initiativeMods),
    bonuses,
    ...(speed !== undefined && { speed }),
    ...(size !== undefined && { size }),
    movement,
    senses,
    level,
    proficiencyBonus,
    abilities,
    hitPoints: {
      max: hpOverride ?? hp + hpBonus + total(hpFlat),
      overridden: hpOverride !== undefined,
      hitDice,
    },
    proficiencies,
    traits,
    defenses: defensesOf(effects),
    features: [...new Set(features)],
    featureSources: featureSources(index, character, sourced),
    conditionImmunities: [
      ...new Set(
        effects.flatMap((e) =>
          e.type === "conditionImmunity" ? [`${character.ruleset}:condition/${e.condition}`] : [],
        ),
      ),
    ],
    critRange: Math.min(20, ...effects.flatMap((e) => (e.type === "critRange" ? [e.min] : []))),
    proficientSkillFloor: Math.max(
      0,
      ...effects.flatMap((e) => (e.type === "d20Floor" ? [e.value] : [])),
    ),
    featureValues: deriveFeatureValues(sourced, valueState),
    attunement: { used: attuned, max: attunementMax },
    spends: deriveSpends(sourced, resources, (entry) => {
      const owner = (index.get(entry)?.data as { class?: string } | undefined)?.class;
      return owner;
    }),
    ...(spellcasting && { spellcasting }),
    spellcasters: casters,
    resources,
    hiddenFeatures: [],
    superseded: {},
    facts,
    extraDamage: [
      ...extraDamage,
      ...sourced.flatMap(({ effect, source }) => {
        if (effect.type !== "extraDamage") return [];
        const step = effect.steps
          .filter((x) => levelOf(source) >= x.minLevel)
          .sort((a, b) => b.minLevel - a.minLevel)[0];
        return step
          ? [
              {
                kind: "feature" as const,
                entry: source,
                dice: step.dice,
                damageType: effect.damageType,
                note: effect.note,
              },
            ]
          : [];
      }),
    ],
    spellSlots: slots,
    ...(pools.pact && { pactSlots: pools.pact }),
    choices,
    grantedSpells: [
      ...new Set(
        sourced.flatMap(({ effect, source }) =>
          effect.type === "grantSpell" &&
          (effect.minLevel === undefined || levelOf(source) >= effect.minLevel)
            ? [effect.spell]
            : [],
        ),
      ),
    ],
    held: [...heldNow],
    weaponMasteries: [
      ...new Set(
        sourced.flatMap(({ effect }) => (effect.type === "weaponMastery" ? [effect.item] : [])),
      ),
    ],
    atWillSpells: [
      ...new Set(
        sourced.flatMap(({ effect, source }) =>
          effect.type === "grantSpell" &&
          effect.atWill &&
          (effect.minLevel === undefined || levelOf(source) >= effect.minLevel)
            ? [effect.spell]
            : [],
        ),
      ),
    ],
    spellHealing: sourced.reduce<SpellHealing>(
      (sum, { effect }) =>
        effect.type === "spellHealing"
          ? {
              plusSlotLevel: sum.plusSlotLevel + (effect.plusSlotLevel ?? 0),
              maxDice: sum.maxDice || effect.maxDice === true,
              selfPlusSlotLevel: sum.selfPlusSlotLevel + (effect.selfPlusSlotLevel ?? 0),
            }
          : sum,
      { plusSlotLevel: 0, maxDice: false, selfPlusSlotLevel: 0 },
    ),
    spellDamage: sourced.flatMap(({ effect }) =>
      effect.type === "spellDamage"
        ? [
            {
              value: abilities[effect.plus].modifier,
              once: effect.once === true,
              ...(effect.spell && { spell: effect.spell }),
              ...(effect.school && { school: effect.school }),
              ...(effect.damageType && { damageType: effect.damageType }),
            },
          ]
        : [],
    ),
    feats: [
      ...new Set([...chosen.filter((e) => e.kind === "feat").map((e) => e.id), ...givenFeats]),
    ],
    asi: { available: asiAvailable, used: asiUsed },
    warnings,
  };
}
