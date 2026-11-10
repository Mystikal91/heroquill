/**
 * Effects of the 2024 features, written by hand from the book (the database has text only), as the
 * 5.1 build does in `scripts/srd51/effects.ts`. Keyed by the feature slug (the 5e-database index;
 * a subclass feature is `<subclass>-<name>`). A feature that is not here is text only.
 *
 * Pilot set: Fighter and Champion. Weapon Mastery, Tactical Mind, Studied Attacks and the Fighting
 * Style / Epic Boon feat picks wait for the engine work listed in the 2024 gap list.
 */
import type { Effect } from "../../src/data/schema";

/** The skills of the 2024 book, for the choices that name any of them (Expertise). */
const SKILLS = [
  "acrobatics",
  "animal-handling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleight-of-hand",
  "stealth",
  "survival",
];

export const FEATURE_EFFECTS: Record<string, Effect[]> = {
  // Two uses at level 1, three at 4, four at 10 (the Fighter Features table).
  // Using it heals 1d10 plus the Fighter level.
  "fighter-second-wind": [
    { type: "uses", term: 2, recharge: "short", minLevel: 1 },
    { type: "uses", term: 3, recharge: "short", minLevel: 4 },
    { type: "uses", term: 4, recharge: "short", minLevel: 10 },
    { type: "selfHeal", dice: "1d10", perLevel: 1 },
  ],
  // After a failed ability check: add 1d10 by using up one use of Second Wind (not spent if the check still fails).
  "fighter-tactical-mind": [
    { type: "checkBoost", dice: "1d10", spends: "srd52:feature/fighter-second-wind" },
  ],
  // The Attack action makes two, three, then four attacks: three features, each replacing the one before.
  "fighter-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "fighter-two-extra-attacks": [{ type: "extraAttack", attacks: 3 }],
  "fighter-three-extra-attacks": [{ type: "extraAttack", attacks: 4 }],
  // One use, two from level 17.
  "fighter-action-surge": [
    { type: "uses", term: 1, recharge: "short", minLevel: 2 },
    { type: "uses", term: 2, recharge: "short", minLevel: 17 },
  ],
  // Three uses from level 17 is the table's; 1 at 9, 2 at 13, 3 at 17.
  "fighter-indomitable": [
    { type: "uses", term: 1, recharge: "long", minLevel: 9 },
    { type: "uses", term: 2, recharge: "long", minLevel: 13 },
    { type: "uses", term: 3, recharge: "long", minLevel: 17 },
  ],
  "champion-improved-critical": [{ type: "critRange", min: 19 }],
  "champion-superior-critical": [{ type: "critRange", min: 18 }],

  // ---- Barbarian. Rage and Weapon Mastery count from the class table (`rage_count`, `weapon_mastery`);
  // Danger Sense, Reckless Attack, Feral Instinct and the Brutal Strikes are text (they are about advantage).
  "barbarian-unarmored-defense": [
    { type: "unarmoredDefense", base: 10, add: ["con"], shield: true },
  ],
  "barbarian-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "barbarian-fast-movement": [
    { type: "modifier", target: "speed", value: 10, when: "noHeavyArmor" },
  ],
  "barbarian-primal-champion": [
    { type: "abilityBonus", ability: "str", value: 4, max: 25 },
    { type: "abilityBonus", ability: "con", value: 4, max: 25 },
  ],
  // Intimidating Presence: once per Long Rest (or by spending a use of Rage, which is for the person to do).
  "path-of-the-berserker-intimidating-presence": [{ type: "uses", term: 1, recharge: "long" }],

  // ---- Monk. The Martial Arts die and the Focus Points come from the class table.
  "monk-unarmored-defense": [{ type: "unarmoredDefense", base: 10, add: ["wis"], shield: false }],
  // Flurry of Blows, Patient Defense and Step of the Wind take 1 point each: the unarmed strike card has the button.
  "monk-monks-focus": [{ type: "spends", pool: "focus", cost: 1 }],
  "monk-unarmored-movement": [
    { type: "modifier", target: "speed", value: 10, when: "unarmoredNoShield", minLevel: 2 },
    { type: "modifier", target: "speed", value: 5, when: "unarmoredNoShield", minLevel: 6 },
    { type: "modifier", target: "speed", value: 5, when: "unarmoredNoShield", minLevel: 10 },
    { type: "modifier", target: "speed", value: 5, when: "unarmoredNoShield", minLevel: 14 },
    { type: "modifier", target: "speed", value: 5, when: "unarmoredNoShield", minLevel: 18 },
  ],
  "monk-uncanny-metabolism": [{ type: "uses", term: 1, recharge: "long" }],
  "monk-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "monk-disciplined-survivor": [
    ...(["str", "dex", "con", "int", "wis", "cha"] as const).map(
      (target): Effect => ({ type: "proficiency", category: "save", target }),
    ),
    { type: "spends", pool: "focus", cost: 1 },
  ],
  "monk-superior-defense": [{ type: "spends", pool: "focus", cost: 3 }],
  "monk-body-and-mind": [
    { type: "abilityBonus", ability: "dex", value: 4, max: 25 },
    { type: "abilityBonus", ability: "wis", value: 4, max: 25 },
  ],
  // Wholeness of Body: Wisdom modifier uses (at least one), then a Long Rest.
  // Heals the Martial Arts die plus the Wisdom modifier, at least 1 hit point.
  "warrior-of-the-open-hand-wholeness-of-body": [
    { type: "uses", term: { mod: "wis" }, recharge: "long", min: 1 },
    { type: "selfHeal", martialArts: true, plus: "wis", minimum: 1 },
  ],

  // ---- Rogue. Sneak Attack comes from the class table (`sneak_attack`); Weapon Mastery is a choice of two.
  "rogue-expertise": [
    { type: "choice", id: "expertise", choose: 2, grants: "expertise", from: SKILLS },
    {
      type: "when",
      requires: "[level:rogue:6]",
      effects: [
        { type: "choice", id: "expertise-2", choose: 2, grants: "expertise", from: SKILLS },
      ],
    },
  ],
  "rogue-reliable-talent": [{ type: "d20Floor", value: 10, on: "proficientSkills" }],
  "rogue-slippery-mind": [
    { type: "proficiency", category: "save", target: "wis" },
    { type: "proficiency", category: "save", target: "cha" },
  ],
  "rogue-stroke-of-luck": [{ type: "uses", term: 1, recharge: "short" }],
  "thief-second-story-work": [{ type: "movement", mode: "climb", feet: "walk" }],
  "thief-use-magic-device": [{ type: "attunementMax", value: 4 }],

  // ---- Paladin. Lay On Hands and Channel Divinity come from the class table; the spell slots and the number
  // of prepared spells too. A feature that gives a spell always prepared and one free cast a day is the spell
  // (`grantSpell`) and a counter of one use.
  "paladin-paladins-smite": [
    { type: "grantSpell", spell: "srd52:spell/divine-smite" },
    { type: "uses", term: 1, recharge: "long" },
  ],
  "paladin-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "paladin-faithful-steed": [
    { type: "grantSpell", spell: "srd52:spell/find-steed" },
    { type: "uses", term: 1, recharge: "long" },
  ],
  "paladin-aura-of-protection": [
    { type: "modifier", target: "save", value: 0, plus: "cha", min: 1 },
  ],
  "paladin-abjure-foes": [{ type: "spends", pool: "channelDivinity" }],
  "paladin-aura-of-courage": [{ type: "conditionImmunity", condition: "frightened" }],
  "paladin-radiant-strikes": [
    {
      type: "extraDamage",
      damageType: "radiant",
      steps: [{ minLevel: 11, dice: "1d8" }],
      note: "oncePerTurn",
    },
  ],
  "oath-of-devotion-sacred-weapon": [{ type: "spends", pool: "channelDivinity" }],
  "oath-of-devotion-aura-of-devotion": [{ type: "conditionImmunity", condition: "charmed" }],
  "oath-of-devotion-holy-nimbus": [{ type: "uses", term: 1, recharge: "long" }],

  // ---- Ranger. Favored Enemy: Hunter's Mark always prepared, cast free twice, up to six times.
  "ranger-favored-enemy": [
    { type: "grantSpell", spell: "srd52:spell/hunters-mark" },
    { type: "uses", term: 2, recharge: "long", minLevel: 1 },
    { type: "uses", term: 3, recharge: "long", minLevel: 5 },
    { type: "uses", term: 4, recharge: "long", minLevel: 9 },
    { type: "uses", term: 5, recharge: "long", minLevel: 13 },
    { type: "uses", term: 6, recharge: "long", minLevel: 17 },
  ],
  "ranger-deft-explorer": [
    { type: "choice", id: "expertise", choose: 1, grants: "expertise", from: SKILLS },
  ],
  "ranger-extra-attack": [{ type: "extraAttack", attacks: 2 }],
  "ranger-roving": [
    { type: "modifier", target: "speed", value: 10, when: "noHeavyArmor" },
    { type: "movement", mode: "climb", feet: "walk" },
    { type: "movement", mode: "swim", feet: "walk" },
  ],
  "ranger-expertise": [
    { type: "choice", id: "expertise", choose: 2, grants: "expertise", from: SKILLS },
  ],
  "ranger-tireless": [{ type: "uses", term: { mod: "wis" }, recharge: "long", min: 1 }],
  "ranger-natures-veil": [{ type: "uses", term: { mod: "wis" }, recharge: "long", min: 1 }],
  "ranger-feral-senses": [{ type: "sense", sense: "blindsight", range: 30 }],
};

/**
 * Effects of the 2024 feats, by feat slug. The Fighting Style feats are the 2014 styles, now feats
 * a class feature lets the person pick. A feat that is not here is text only (Savage Attacker, the
 * Epic Boons, Magic Initiate, which wait for the spells of the 2024 list).
 */
export const FEAT_EFFECTS: Record<string, Effect[]> = {
  archery: [{ type: "modifier", target: "attack", value: 2, when: "ranged" }],
  defense: [{ type: "modifier", target: "ac", value: 1, when: "wearingArmor" }],
  // The off-hand weapon adds its ability modifier to damage (the engine reads this flag by name).
  "two-weapon-fighting": [{ type: "flag", id: "two-weapon-fighting" }],
  // Initiative Proficiency: the proficiency bonus on the roll.
  alert: [{ type: "modifier", target: "initiative", value: 0, plus: "proficiency" }],
};

/**
 * Class features that are a pick of feats of one category, by feature slug: the Fighting Style of
 * the Fighter and the Champion's second one, and the Fighter's Epic Boon.
 */
export const FEAT_PICKS: Record<string, { category: string; id: string }> = {
  "fighter-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "champion-additional-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "fighter-epic-boon": { category: "epic-boon", id: "epic-boon" },
  "barbarian-epic-boon": { category: "epic-boon", id: "epic-boon" },
  "paladin-epic-boon": { category: "epic-boon", id: "epic-boon" },
  "ranger-epic-boon": { category: "epic-boon", id: "epic-boon" },
  "paladin-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "ranger-fighting-style": { category: "fighting-style", id: "fighting-style" },
  "monk-epic-boon": { category: "epic-boon", id: "epic-boon" },
  "rogue-epic-boon": { category: "epic-boon", id: "epic-boon" },
};

/**
 * Features that stand in for the step before them (the Fighter's Extra Attack grows by three features): feature slug
 * to the slug it replaces. The sheet hides the older step and the new one says what it replaces.
 */
export const REPLACES: Record<string, string> = {
  "fighter-two-extra-attacks": "fighter-extra-attack",
  "fighter-three-extra-attacks": "fighter-two-extra-attacks",
};

/** How a feature is used: `bonus` for a Bonus Action, `action` for an action, `reaction`. */
export const ACTIVATION: Record<string, "action" | "bonus" | "reaction"> = {
  "fighter-second-wind": "bonus",
  "barbarian-rage": "bonus",
  "path-of-the-berserker-retaliation": "reaction",
  "path-of-the-berserker-intimidating-presence": "bonus",
  "monk-deflect-attacks": "reaction",
  "monk-slow-fall": "reaction",
  "warrior-of-the-open-hand-wholeness-of-body": "bonus",
  "rogue-cunning-action": "bonus",
  "rogue-steady-aim": "bonus",
  "rogue-uncanny-dodge": "reaction",
  "thief-fast-hands": "bonus",
  "paladin-lay-on-hands": "bonus",
  "paladin-paladins-smite": "bonus",
  "paladin-abjure-foes": "action",
  "oath-of-devotion-holy-nimbus": "bonus",
  "ranger-tireless": "action",
  "ranger-natures-veil": "bonus",
};
