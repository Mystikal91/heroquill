import { itemData } from "../data/items";
import type { Ability, ProficiencyCategory } from "../data/schema";
import type { Character } from "./character";
import type { SourcedEffect } from "./choices";
import { coinWeight } from "./coins";
import type { AbilityResult, PackIndex } from "./derive";
import { type AppliedModifier, type ArmorState, appliedModifiers, total } from "./modifiers";
import { placeEquipment } from "./slots";
import { type Warning, warn } from "./warnings";

export interface DamageResult {
  dice: string;
  bonus: number;
  type: string;
}

export interface AttackResult {
  itemId: string;
  ability: Ability;
  /** The entry that lets the weapon use an ability other than Strength or Dexterity. */
  abilityFrom?: string;
  /** The cantrip Shillelagh is on the weapon. */
  shillelagh?: boolean;
  /** The weapon can take the cantrip (a club or quarterstaff, or a copy of one) and the character casts spells. */
  canShillelagh?: boolean;
  /** The bonus the Channel Divinity: Sacred Weapon gives the weapon's attack rolls now (the Charisma modifier, at least 1). */
  sacredWeapon?: number;
  /** The character has the Channel Divinity: Sacred Weapon, so the weapon can take it. */
  canSacredWeapon?: boolean;
  /** The unarmed strike: not a weapon of the inventory, every character has it. */
  unarmed?: boolean;
  /** A natural weapon of the species (claws, a bite): there even when a weapon is held. */
  natural?: boolean;
  /** The attack can also be made as a bonus action (a monk's martial arts). */
  bonusAction?: boolean;
  /** The bonus the spell Magic Weapon gives the weapon now (0 when it is not on it). */
  magicWeapon?: number;
  /** The character has the spell Magic Weapon, so the weapon can take it. */
  canMagicWeapon?: boolean;
  /** The weapon's mastery property (a `property` entry) once the character has mastered this kind of weapon. */
  mastery?: string;
  /**
   * Why the attack rolls with this Heavy weapon have disadvantage for this character: a Small creature
   * (the 2014 rule) or a Strength or Dexterity score under 13 (the 2024 rule, by the kind of weapon). Only a
   * warning: nothing is rolled differently.
   */
  heavy?: "small" | "str" | "dex";
  /** The attack is made at range. */
  ranged: boolean;
  /** The weapon counts as magic. */
  magical: boolean;
  /** The weapon is in the off hand: its damage has no ability modifier unless it is negative or the style Two-Weapon Fighting is known. */
  offHand?: boolean;
  /** The bonus to attack and damage rolls from a spell or an enchantment. */
  enhancement: number;
  /** The enchantment the weapon carries, when it has one. */
  enchantment?: string;
  attackBonus: number;
  proficient: boolean;
  damage?: DamageResult;
  twoHandedDamage?: DamageResult;
  properties: string[];
  range: { normal: number; long?: number };
  /** The bonuses of features and choices that apply to this attack, when there are any. */
  modifiers?: AppliedModifier[];
}

export interface ArmorClassResult {
  value: number;
  overridden: boolean;
  stealthDisadvantage: boolean;
  /** What the value is made of, for display. Sources are keys, not text. */
  parts: {
    source: "base" | "armor" | "dex" | "shield" | "feature";
    value: number;
    /** The entry that gives a `feature` part. */
    feature?: string;
  }[];
}

export interface LoadResult {
  /** Carried weight in pounds. */
  carried: number;
  /** Carrying capacity in pounds: Strength score x 15. */
  capacity: number;
}

export interface EquipmentResult {
  /** What is worn, as the conditions of features read it. */
  armor: ArmorState;
  armorClass: ArmorClassResult;
  attacks: AttackResult[];
  /**
   * What the character does with bare hands. It is there for a monk, for a natural weapon, and for
   * whoever holds no weapon: with a weapon in hand the other classes have no free hand to hit with.
   */
  unarmed: AttackResult | undefined;
  load: LoadResult;
}

interface Context {
  character: Character;
  index: PackIndex;
  abilities: Record<Ability, AbilityResult>;
  /** Held proficiencies as `category:target` keys. */
  held: Set<string>;
  /** Every entry the character has and every flag set (a fighting style that has no number is only this). */
  seen: ReadonlySet<string>;
  proficiencyBonus: number;
  /** Every effect in force with its source: features and choices add to armor class and attacks. */
  sourced: SourcedEffect[];
  /** The level that counts for what an entry gives: its class's, or the whole character's. */
  levelOf: (source: string) => number;
  warnings: Warning[];
  /** The ability of each class that casts spells. */
  spellAbilities: Ability[];
  /** The die of the monk's martial arts (`1d6`), which replaces the 1 of an unarmed strike. */
  martialArts?: string | undefined;
  /** The feats the character has, by id. */
  featIds: string[];
  /** The creature size, for the rule of the 2014 Heavy property (Small creatures). */
  size?: string | undefined;
}

const isProficient = (held: Set<string>, keys: string[]) => keys.some((k) => held.has(k));

/** The fighting style Two-Weapon Fighting (the fighter's, the ranger's or an imported one: each sets this flag). */
export const TWO_WEAPON_FIGHTING = "two-weapon-fighting";
const knowsTwoWeaponFighting = (seen: ReadonlySet<string>) => seen.has(TWO_WEAPON_FIGHTING);

export function proficiencyKeys(proficiencies: Record<ProficiencyCategory, string[]>): Set<string> {
  return new Set(
    Object.entries(proficiencies).flatMap(([category, targets]) =>
      targets.map((target) => `${category}:${target}`),
    ),
  );
}

function armorStateOf(ctx: Context): ArmorState {
  const items = ctx.character.inventory
    .filter((i) => i.equipped)
    .flatMap((item) => {
      const entry = ctx.index.get(item.itemId);
      const armor = entry && itemData(entry).armor;
      return armor ? [armor] : [];
    });
  const body = items.find((a) => a.category !== "shield");
  return {
    wearing: body !== undefined,
    heavy: body?.category === "heavy",
    shield: items.some((a) => a.category === "shield"),
  };
}

function deriveArmorClass(ctx: Context, state: ArmorState): ArmorClassResult {
  const { character, index, abilities, held, warnings } = ctx;
  const equipped = character.inventory.filter((i) => i.equipped);
  const armors = equipped.flatMap((item) => {
    const entry = index.get(item.itemId);
    const armor = entry && itemData(entry).armor;
    return armor ? [{ itemId: item.itemId, armor }] : [];
  });
  const bodies = armors.filter((a) => a.armor.category !== "shield");
  const shields = armors.filter((a) => a.armor.category === "shield");
  if (bodies.length > 1) warn(warnings, "multipleArmor");
  if (shields.length > 1) warn(warnings, "multipleShields");

  const dex = abilities.dex.modifier;
  const parts: ArmorClassResult["parts"] = [];
  const body = bodies[0];
  if (body) {
    const { armor } = body;
    parts.push({ source: "armor", value: armor.base });
    if (armor.dexBonus) {
      parts.push({
        source: "dex",
        value: Math.min(dex, armor.maxDexBonus ?? Number.POSITIVE_INFINITY),
      });
    }
  } else {
    // Without armor: 10 + Dexterity, or the better of the formulas that features give (a
    // barbarian's Constitution, a monk's Wisdom, a draconic sorcerer's scales).
    type Formula = { base: number; bonus: number; feature: string; noDex: boolean };
    const total = (f: Formula) => f.base + f.bonus + (f.noDex ? 0 : dex);
    let formula: Formula | undefined;
    for (const { effect, source } of ctx.sourced) {
      if (effect.type !== "unarmoredDefense" || (shields.length > 0 && !effect.shield)) continue;
      const bonus = effect.add.reduce((sum, a) => sum + abilities[a].modifier, 0);
      const candidate = { base: effect.base, bonus, feature: source, noDex: effect.noDex === true };
      if (!formula || total(candidate) > total(formula)) formula = candidate;
    }
    if (formula && total(formula) > 10 + dex) {
      parts.push({ source: "base", value: formula.base });
      if (!formula.noDex) parts.push({ source: "dex", value: dex });
      if (formula.bonus !== 0)
        parts.push({ source: "feature", value: formula.bonus, feature: formula.feature });
    } else {
      parts.push({ source: "base", value: 10 }, { source: "dex", value: dex });
    }
  }
  const shield = shields[0];
  if (shield) parts.push({ source: "shield", value: shield.armor.base });
  for (const m of appliedModifiers(ctx.sourced, "ac", {
    armor: state,
    levelOf: ctx.levelOf,
    abilityModifier: (a) => abilities[a].modifier,
    proficiencyBonus: ctx.proficiencyBonus,
  }))
    parts.push({ source: "feature", value: m.value, feature: m.source });

  for (const { itemId, armor } of armors) {
    if (abilities.str.score < armor.strengthMinimum)
      warn(warnings, "strengthMinimum", { item: itemId, minimum: armor.strengthMinimum });
    if (!isProficient(held, armor.proficiency)) warn(warnings, "notProficient", { item: itemId });
  }

  const computed = parts.reduce((sum, p) => sum + p.value, 0);
  const override = ctx.character.overrides.ac;
  const overridden = typeof override === "number";
  return {
    value: overridden ? override : computed,
    overridden,
    stealthDisadvantage: armors.some((a) => a.armor.stealthDisadvantage),
    parts,
  };
}

/**
 * Shillelagh works on a club or a quarterstaff, and on a copy of one a person made (`data.copyOf`
 * says which item it was made from).
 */
export const takesShillelagh = (
  itemId: string,
  index?: ReadonlyMap<string, { data: Record<string, unknown> }>,
) => {
  const base = index?.get(itemId)?.data.copyOf;
  return /\/(club|quarterstaff)$/.test(typeof base === "string" ? base : itemId);
};

/** A d4 or d6 becomes a d8; anything bigger stays. */
function shillelaghDice(dice: string): string {
  const m = dice.match(/^1d(\d+)$/);
  return m && Number(m[1]) < 8 ? "1d8" : dice;
}

/** The spell that gives a weapon a bonus for an hour, which the character casts on a weapon in Play. */
export const MAGIC_WEAPON_SPELL = "srd51:spell/magic-weapon";

/** Whether the character has the spell: picked, prepared or granted. */
function knowsSpell(ctx: Context, spell: string): boolean {
  return (
    Object.values(ctx.character.spells).some((l) =>
      [...l.cantrips, ...l.known, ...l.prepared].includes(spell),
    ) || ctx.sourced.some(({ effect }) => effect.type === "grantSpell" && effect.spell === spell)
  );
}

/**
 * Whether the Heavy property gives this character disadvantage on attack rolls with the weapon, and why. The
 * 2014 rule is about size (Small creatures); the 2024 rule is about the score that fits the weapon: Strength
 * for a Melee weapon, Dexterity for a Ranged one, at least 13.
 */
function heavyPenalty(
  ctx: Context,
  weapon: { kind: string; properties: string[] },
): "small" | "str" | "dex" | undefined {
  if (!weapon.properties.some((p) => p.endsWith("/heavy"))) return undefined;
  if (ctx.character.ruleset === "srd52") {
    const ability = weapon.kind === "ranged" ? "dex" : "str";
    return ctx.abilities[ability].score < 13 ? ability : undefined;
  }
  return ctx.size === "small" || ctx.size === "tiny" ? "small" : undefined;
}

function deriveAttacks(ctx: Context, armor: ArmorState): AttackResult[] {
  const { character, index, abilities, held, proficiencyBonus } = ctx;
  const attacks: AttackResult[] = [];
  const knowsMagicWeapon = knowsSpell(ctx, MAGIC_WEAPON_SPELL);
  // The kinds of weapon (items) whose mastery property the character can use (2024).
  const masteries = new Set(
    ctx.sourced.flatMap(({ effect }) => (effect.type === "weaponMastery" ? [effect.item] : [])),
  );
  // The paladin's Sacred Weapon: found by the slug of its feature, as the SRD and Aurora each have their own entry.
  const knowsSacredWeapon = ctx.sourced.some(({ source }) =>
    /\/channel-divinity-sacred-weapon$/.test(source),
  );
  // A weapon in the off hand: it does not add the ability modifier to damage, unless the style
  // Two-Weapon Fighting is known; a negative modifier is still taken off.
  const offHandId = placeEquipment(character.inventory, index).slots.offHand?.itemId;
  const keepsModifier = knowsTwoWeaponFighting(ctx.seen);
  const heldWeapons = character.inventory.filter((i) => {
    const entry = i.equipped ? index.get(i.itemId) : undefined;
    return Boolean(entry && itemData(entry).weapon);
  }).length;
  for (const item of character.inventory) {
    if (!item.equipped) continue;
    const entry = index.get(item.itemId);
    const weapon = entry && itemData(entry).weapon;
    if (!weapon) continue;

    const finesse = weapon.properties.some((p) => p.endsWith("/finesse"));
    let ability: Ability =
      weapon.kind === "ranged"
        ? "dex"
        : finesse && abilities.dex.modifier > abilities.str.modifier
          ? "dex"
          : "str";
    // A monk's weapons (the shortsword and the simple melee weapons without two hands or heavy)
    // use the better of Strength and Dexterity, and the die of martial arts when it is bigger.
    const monkWeapon =
      ctx.martialArts !== undefined &&
      weapon.kind === "melee" &&
      (weapon.properties.some((p) => p.endsWith("/monk")) ||
        // 2024: Simple melee weapons and the Martial melee weapons that have the Light property.
        (character.ruleset === "srd52" &&
          (weapon.category === "simple" || weapon.properties.some((p) => p.endsWith("/light")))));
    if (monkWeapon && abilities.dex.modifier > abilities[ability].modifier) ability = "dex";
    const baseDamage =
      weapon.damage && monkWeapon && ctx.martialArts
        ? withMartialArts(weapon.damage, ctx.martialArts)
        : weapon.damage;
    const baseTwoHanded =
      weapon.twoHandedDamage && monkWeapon && ctx.martialArts
        ? withMartialArts(weapon.twoHandedDamage, ctx.martialArts)
        : weapon.twoHandedDamage;
    const proficient = isProficient(held, weapon.proficiency);
    const enchanted = item.enchantment ? index.get(item.enchantment) : undefined;
    // The bonus can come from the weapon itself (a homebrew +1 sword), the person's ticks or an enchantment.
    const spellBonus =
      character.play.magicWeapon?.itemId === item.itemId ? character.play.magicWeapon.bonus : 0;
    const enhancement = Math.max(
      item.bonus ?? 0,
      spellBonus,
      itemData(entry).enhancement ?? 0,
      enchanted ? (itemData(enchanted).enhancement ?? 0) : 0,
    );
    const sacred = knowsSacredWeapon && character.play.sacredWeapon === item.itemId;
    const sacredBonus = sacred ? Math.max(1, abilities.cha.modifier) : 0;
    const canShillelagh = takesShillelagh(item.itemId, index);
    const shillelagh = canShillelagh && character.play.shillelagh === item.itemId;
    const magical =
      shillelagh ||
      sacred ||
      item.magical === true ||
      itemData(entry).magical === true ||
      enchanted !== undefined ||
      spellBonus > 0 ||
      enhancement > 0 ||
      Boolean(itemData(entry).rarity);
    // Features that let the weapon use another ability: the best one that applies wins.
    let abilityFrom: string | undefined;
    for (const { effect, source } of ctx.sourced) {
      if (effect.type !== "weaponAbility") continue;
      if (effect.proficient && !proficient) continue;
      if (effect.when === "oneHanded" && weapon.properties.some((p) => p.endsWith("/two-handed")))
        continue;
      if (effect.when === "magic" && !magical) continue;
      if (abilities[effect.ability].modifier > abilities[ability].modifier) {
        ability = effect.ability;
        abilityFrom = source;
      }
    }
    if (shillelagh) {
      for (const a of ctx.spellAbilities) {
        if (abilities[a].modifier > abilities[ability].modifier) {
          ability = a;
          abilityFrom = "srd51:spell/shillelagh";
        }
      }
    }
    const modifier = abilities[ability].modifier;
    // A copy a person made of a weapon (Customize) keeps the mastery of the weapon it copies.
    const copied = entry.data.copyOf;
    const mastered =
      masteries.has(item.itemId) || (typeof copied === "string" && masteries.has(copied));
    const mastery = mastered ? weapon.mastery : undefined;
    const heavy = heavyPenalty(ctx, weapon);
    if (heavy)
      warn(ctx.warnings, heavy === "small" ? "heavySmall" : "heavyScore", {
        item: item.itemId,
        ...(heavy !== "small" && { ability: heavy }),
      });
    const grip = (twoHanded: boolean) => ({
      armor,
      levelOf: ctx.levelOf,
      weapon: { kind: weapon.kind, twoHanded, held: heldWeapons },
    });
    const alwaysTwoHanded = weapon.properties.some((p) => p.endsWith("/two-handed"));
    const toHit = appliedModifiers(ctx.sourced, "attack", grip(alwaysTwoHanded));
    const oneHand = appliedModifiers(ctx.sourced, "damage", grip(alwaysTwoHanded));
    const twoHands = appliedModifiers(ctx.sourced, "damage", grip(true));
    const offHand = item.itemId === offHandId && !keepsModifier;
    const damageModifier = offHand ? Math.min(modifier, 0) : modifier;
    const withBonus = (
      d: { dice: string; type: string },
      extra: AppliedModifier[],
    ): DamageResult => ({
      dice: d.dice,
      bonus: damageModifier + enhancement + total(extra),
      type: d.type,
    });
    const applied = [...toHit, ...oneHand];
    attacks.push({
      itemId: item.itemId,
      ability,
      ...(abilityFrom && { abilityFrom }),
      ...(shillelagh && { shillelagh }),
      ...(canShillelagh && ctx.spellAbilities.length > 0 && { canShillelagh }),
      ...(spellBonus > 0 && { magicWeapon: spellBonus }),
      ...(knowsMagicWeapon && { canMagicWeapon: true }),
      ...(sacred && { sacredWeapon: sacredBonus }),
      ...(knowsSacredWeapon && { canSacredWeapon: true }),
      ranged: weapon.kind === "ranged",
      ...(mastery && { mastery }),
      ...(heavy && { heavy }),
      ...(offHand && { offHand }),
      magical,
      enhancement,
      ...(item.enchantment && enchanted && { enchantment: item.enchantment }),
      attackBonus:
        modifier + enhancement + sacredBonus + (proficient ? proficiencyBonus : 0) + total(toHit),
      proficient,
      ...(baseDamage && {
        damage: withBonus(
          shillelagh ? { ...baseDamage, dice: shillelaghDice(baseDamage.dice) } : baseDamage,
          oneHand,
        ),
      }),
      ...(baseTwoHanded && {
        twoHandedDamage: withBonus(baseTwoHanded, twoHands),
      }),
      properties: weapon.properties,
      range: weapon.range,
      ...(applied.length > 0 && { modifiers: applied }),
    });
  }
  return attacks;
}

function deriveLoad(ctx: Context): LoadResult {
  let carried = 0;
  for (const item of ctx.character.inventory) {
    const entry = ctx.index.get(item.itemId);
    if (!entry) {
      // An item of the player's own weighs what they said; any other unknown one is a problem.
      if (item.custom) carried += (item.custom.weight ?? 0) * item.quantity;
      else warn(ctx.warnings, "unknownEntry", { id: item.itemId });
      continue;
    }
    carried += (itemData(entry).weight ?? 0) * item.quantity;
  }
  carried += coinWeight(ctx.character.coins);
  return { carried, capacity: ctx.abilities.str.score * 15 };
}

/** The average of a die written `2d6`, to tell the bigger of two. */
function averageOf(dice: string): number {
  const m = /^(\d+)d(\d+)$/.exec(dice);
  return m ? (Number(m[1]) * (Number(m[2]) + 1)) / 2 : Number(dice) || 0;
}

/** The damage with the die of martial arts in place of its own when that is bigger (a monk weapon). */
function withMartialArts(damage: DamageResultLike, die: string): DamageResultLike {
  return averageOf(die) > averageOf(damage.dice) ? { ...damage, dice: die } : damage;
}
type DamageResultLike = { dice: string; type: string };

/** The feat Tavern Brawler, by the name of its id (it is not in the SRD: an imported or homebrew pack has it). */
const TAVERN_BRAWLER = /\/tavern-brawler(-\d+)?$/;
/** The monk feature that makes unarmed strikes count as magic. */
const KI_EMPOWERED = /\/ki-empowered-strikes$/;

/**
 * The unarmed strike: Strength (a monk takes Dexterity when it is better), the proficiency bonus,
 * and 1 + the modifier of bludgeoning damage. The monk's martial arts die takes the place of the 1,
 * and a d4 does for the feat Tavern Brawler. A monk can make it as a bonus action as well.
 */
function deriveUnarmed(ctx: Context, armor: ArmorState): AttackResult {
  const { abilities, proficiencyBonus } = ctx;
  const monk = ctx.martialArts !== undefined;
  const ability: Ability = monk && abilities.dex.modifier > abilities.str.modifier ? "dex" : "str";
  const modifier = abilities[ability].modifier;
  const brawler = ctx.featIds.some((id) => TAVERN_BRAWLER.test(id));
  // Dice that can stand in for the 1, the biggest wins: martial arts, a natural weapon, Tavern Brawler.
  const dice = [
    ...(ctx.martialArts ? [{ dice: ctx.martialArts, type: "bludgeoning" }] : []),
    ...ctx.sourced.flatMap(({ effect }) =>
      effect.type === "unarmedStrike" ? [{ dice: effect.dice, type: effect.damageType }] : [],
    ),
    ...(brawler ? [{ dice: "1d4", type: "bludgeoning" }] : []),
  ];
  const best = dice.reduce<DamageResultLike | undefined>(
    (top, d) => (!top || averageOf(d.dice) > averageOf(top.dice) ? d : top),
    undefined,
  );
  const grip = {
    armor,
    levelOf: ctx.levelOf,
    weapon: { kind: "melee" as const, twoHanded: false, held: 0 },
  };
  const toHit = appliedModifiers(ctx.sourced, "attack", grip);
  const extra = appliedModifiers(ctx.sourced, "damage", grip);
  const applied = [...toHit, ...extra];
  return {
    itemId: "unarmed",
    unarmed: true,
    ability,
    ranged: false,
    magical: [...ctx.seen].some((id) => KI_EMPOWERED.test(id)),
    enhancement: 0,
    attackBonus: modifier + proficiencyBonus + total(toHit),
    proficient: true,
    damage: {
      dice: best?.dice ?? "1",
      bonus: modifier + total(extra),
      type: best?.type ?? "bludgeoning",
    },
    ...(ctx.sourced.some(({ effect }) => effect.type === "unarmedStrike") && { natural: true }),
    properties: [],
    range: { normal: 5 },
    ...(monk && { bonusAction: true }),
    ...(applied.length > 0 && { modifiers: applied }),
  };
}

export function deriveEquipment(ctx: Context): EquipmentResult {
  const armor = armorStateOf(ctx);
  const attacks = deriveAttacks(ctx, armor);
  const unarmed = deriveUnarmed(ctx, armor);
  const free = ctx.martialArts !== undefined || unarmed.natural === true || attacks.length === 0;
  return {
    armor,
    armorClass: deriveArmorClass(ctx, armor),
    attacks,
    unarmed: free ? unarmed : undefined,
    load: deriveLoad(ctx),
  };
}
