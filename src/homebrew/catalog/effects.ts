import { type Effect, PlainEffectSchema } from "../../data/schema";
import { type FieldLevel, type FieldSpec, field } from "./fields";
import { fieldsOf } from "./introspect";
import type { EntryKind } from "./kinds";

export type EffectType = Effect["type"];

/** The groups an editor sorts the effects into when it offers them. */
export type EffectGroup =
  | "scores"
  | "proficiency"
  | "body"
  | "combat"
  | "magic"
  | "resources"
  | "structure";

export interface EffectMeta {
  group: EffectGroup;
  /** `guided`: the effects a beginner is offered; `advanced`: the rest. */
  level: FieldLevel;
  /** One line for developers, and a start for the help of the editor. */
  doc: string;
}

const meta = (group: EffectGroup, level: FieldLevel, doc: string): EffectMeta => ({
  group,
  level,
  doc,
});

/**
 * What each effect is for. The fields of an effect come from the engine's own schema (see
 * `effectFields`); this only says where it goes and who it is for. A type added to the schema
 * fails to compile until it is described here.
 */
export const EFFECT_META: Record<EffectType, EffectMeta> = {
  abilityBonus: meta("scores", "guided", "Raises an ability score."),
  abilityFloor: meta("scores", "advanced", "Sets a score to at least a value."),
  proficiency: meta("proficiency", "guided", "A skill, save, weapon, armor, tool or language."),
  expertise: meta("proficiency", "guided", "Double proficiency on a skill."),
  halfProficiency: meta("proficiency", "advanced", "Half proficiency on checks that lack it."),
  weaponMastery: meta("proficiency", "advanced", "Can use the mastery of a weapon."),
  d20Floor: meta("proficiency", "advanced", "A low die counts as a higher one on checks."),
  modifier: meta("body", "guided", "A flat bonus to a number of the sheet."),
  defense: meta("body", "guided", "Resistance, immunity or vulnerability to a damage type."),
  conditionImmunity: meta("body", "guided", "Cannot be affected by a condition."),
  movement: meta("body", "guided", "Climb, swim, fly or burrow speed."),
  sense: meta("body", "guided", "A sense with a range."),
  size: meta("body", "advanced", "The size of the creature."),
  unarmoredDefense: meta("body", "advanced", "Armor class without armor."),
  unarmedStrike: meta("combat", "advanced", "A natural weapon."),
  extraDamage: meta("combat", "advanced", "Damage added to attacks, rolled by a card."),
  extraAttack: meta("combat", "advanced", "More attacks with the Attack action."),
  critRange: meta("combat", "advanced", "The lowest die that is a critical hit."),
  weaponAbility: meta("combat", "advanced", "Attack with another ability."),
  selfHeal: meta("combat", "advanced", "Using the feature heals the character."),
  checkBoost: meta("combat", "advanced", "Add dice to a failed check."),
  grantSpell: meta("magic", "guided", "Gives a spell."),
  spellDamage: meta("magic", "advanced", "An ability modifier added to spell damage."),
  spellHealing: meta("magic", "advanced", "Changes the healing of spells."),
  uses: meta("resources", "guided", "Uses between rests, ticked off in play."),
  spends: meta("resources", "advanced", "Takes points from a pool of the class."),
  resource: meta("resources", "advanced", "A resource with a maximum and a recharge."),
  featureValue: meta("resources", "advanced", "A number a feature shows on the sheet."),
  attunementMax: meta("resources", "advanced", "More than three attuned items."),
  trait: meta("structure", "guided", "Gives a trait: a named text, with its own effects."),
  choice: meta("structure", "guided", "The person picks among options."),
  flag: meta("structure", "advanced", "A name other rules can ask for."),
  when: meta("structure", "advanced", "Effects that hold only while a requirement does."),
};

/** Which kinds of entry the id of a field names, when only some do. */
const REFS: Record<string, readonly EntryKind[]> = {
  "trait.id": ["trait", "feature"],
  "grantSpell.spell": ["spell"],
  "spellDamage.spell": ["spell"],
  "checkBoost.spends": ["feature", "trait"],
  "weaponMastery.item": ["item"],
  "choice.spellClass": ["class"],
};

/** Fields that hold the slug of a word of the rules. */
const SLUGS: Record<string, EntryKind> = {
  "expertise.skill": "skill",
  "modifier.skill": "skill",
  "conditionImmunity.condition": "condition",
};

type Option = Parameters<typeof fieldsOf>[0];
const options = (PlainEffectSchema as unknown as { options: Option[] }).options;
const literalOf = (option: Option) =>
  (option.entries?.type as { literal?: string } | undefined)?.literal ?? "";

function refined(type: string, specs: FieldSpec[]): FieldSpec[] {
  return specs.map((spec) => {
    const refs = REFS[`${type}.${spec.key}`];
    const slug = SLUGS[`${type}.${spec.key}`];
    if (refs && spec.type.type === "ref") return { ...spec, type: { type: "ref", kinds: refs } };
    if (slug) return { ...spec, type: { type: "slug", kind: slug } };
    return spec;
  });
}

const FIELDS: Record<string, FieldSpec[]> = {};
for (const option of options) {
  const type = literalOf(option);
  FIELDS[type] = refined(
    type,
    fieldsOf(option).filter((spec) => spec.key !== "type"),
  );
}
FIELDS.when = [
  field("requires", { type: "text" }, { required: true }),
  field("effects", { type: "effects" }, { required: true }),
];

/** Every effect type of the engine, the plain ones first, then `when`. */
export const EFFECT_TYPES = Object.keys(FIELDS) as EffectType[];

/** The fields of an effect, read from the schema the engine validates it with. */
export const effectFields = (type: EffectType): FieldSpec[] => FIELDS[type] ?? [];
