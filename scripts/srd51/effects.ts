/**
 * The numbers that features and traits change, written by hand: the source database has the
 * text of these features but not their effects. Keys are `<kind>/<slug>`.
 *
 * Add a line here (and regenerate with `npm run data:srd51`) to make a feature work on the
 * sheet. What cannot be expressed stays text.
 */
import type {
  Effect,
  FeatureTerm,
  ModifierCondition,
  ModifierTarget,
  SpendPool,
} from "../../src/data/schema";

/** A limited number of uses between rests (`n` fixed, or the terms given), ticked off in play. */
const uses = (recharge: "short" | "long", ...terms: FeatureTerm[]): Effect[] =>
  terms.map((term) => ({ type: "uses", term, recharge }));
const usesAtLeast = (min: number, recharge: "short" | "long", term: FeatureTerm): Effect => ({
  type: "uses",
  term,
  recharge,
  min,
});

const resists = (damage: string): Effect => ({ type: "defense", kind: "resistance", damage });

const modifier = (
  target: ModifierTarget,
  value: number,
  when?: ModifierCondition,
  minLevel?: number,
): Effect => ({
  type: "modifier",
  target,
  value,
  ...(when && { when }),
  ...(minLevel !== undefined && { minLevel }),
});

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

/** Pick two skills to double the proficiency bonus of (a rogue may pick thieves' tools). */
const expertise = (id: string, extra: string[] = []): Effect => ({
  type: "choice",
  id,
  choose: 2,
  grants: "expertise",
  from: [...SKILLS, ...extra],
});

const spell = (slug: string): Effect => ({ type: "grantSpell", spell: `srd51:spell/${slug}` });
/** A spell an invocation lets the warlock cast as often as wanted, without a slot: listed as a cantrip. */
const atWill = (slug: string): Effect => ({
  type: "grantSpell",
  spell: `srd51:spell/${slug}`,
  atWill: true,
});
const skill = (target: string): Effect => ({ type: "proficiency", category: "skill", target });

/**
 * A spell the character picks from the lists of the game, given as a choice with no options listed:
 * `where` says which spells (a level, up to a level, a class, rituals only) and how it is cast.
 */
const pickSpells = (
  id: string,
  choose: number,
  where: {
    spellLevel?: number;
    spellUpTo?: number;
    spellClass?: string;
    ritual?: boolean;
    free?: boolean;
    atWill?: boolean;
    rest?: "short" | "long";
  },
): Effect => ({ type: "choice", id, choose, grants: "spell", from: [], ...where });

const WIZARD = "srd51:class/wizard";
const WARLOCK = "srd51:class/warlock";

/** Elemental Affinity: the Charisma modifier on the damage of the type of the dragon ancestor. */
const affinity = (damageType: string, ancestors: string[]): Effect => ({
  type: "when",
  requires: ancestors
    .map((a) => `srd51:feature/dragon-ancestor-${a}---${damageType}-damage`)
    .join("||"),
  effects: [{ type: "spellDamage", plus: "cha", damageType, once: true }],
});

const archery = [modifier("attack", 2, "ranged")];
const defense = [modifier("ac", 1, "wearingArmor")];
const dueling = [modifier("damage", 2, "dueling")];

const AFFINITY: Record<string, string[]> = {
  acid: ["black", "copper"],
  lightning: ["blue", "bronze"],
  fire: ["brass", "gold", "red"],
  poison: ["green"],
  cold: ["silver", "white"],
};

export const FEATURE_EFFECTS: Record<string, Effect[]> = {
  // Limited uses, ticked off in play. Bardic Inspiration, Channel Divinity, Action Surge and the
  // like depend on the class table and are worked out in `engine/resources.ts`.
  "feature/divine-sense": uses("long", 1, { mod: "cha" }),
  "feature/cleansing-touch": [usesAtLeast(1, "long", { mod: "cha" })],
  "feature/second-wind": uses("short", 1),
  "feature/arcane-recovery": uses("long", 1),
  "feature/natural-recovery": uses("long", 1),
  "feature/wholeness-of-body": uses("long", 1),
  "feature/stroke-of-luck": uses("short", 1),
  "feature/sorcerous-restoration": uses("long", 1),
  "feature/divine-intervention": uses("long", 1),
  "feature/dark-ones-own-luck": [usesAtLeast(1, "short", { mod: "cha" })],
  "feature/hurl-through-hell": uses("long", 1),
  "trait/breath-weapon": uses("short", 1),
  "trait/relentless-endurance": uses("long", 1),
  // A tiefling casts each of these once between long rests, without a slot.
  "trait/infernal-legacy": [
    spell("thaumaturgy"),
    { type: "grantSpell", spell: "srd51:spell/hellish-rebuke", minLevel: 3, free: true },
    { type: "grantSpell", spell: "srd51:spell/darkness", minLevel: 5, free: true },
  ],
  // Armor class without armor.
  "feature/barbarian-unarmored-defense": [
    { type: "unarmoredDefense", base: 10, add: ["con"], shield: true },
  ],
  "feature/monk-unarmored-defense": [
    { type: "unarmoredDefense", base: 10, add: ["wis"], shield: false },
  ],
  "feature/draconic-resilience": [
    { type: "unarmoredDefense", base: 13, add: [], shield: true },
    modifier("hpPerLevel", 1),
  ],
  "trait/dwarven-toughness": [modifier("hpPerLevel", 1)],

  // Resistance to damage.
  "trait/dwarven-resilience": [resists("poison")],
  "trait/hellish-resistance": [resists("fire")],
  "trait/draconic-ancestry-black": [resists("acid")],
  "trait/draconic-ancestry-blue": [resists("lightning")],
  "trait/draconic-ancestry-brass": [resists("fire")],
  "trait/draconic-ancestry-bronze": [resists("lightning")],
  "trait/draconic-ancestry-copper": [resists("acid")],
  "trait/draconic-ancestry-gold": [resists("fire")],
  "trait/draconic-ancestry-green": [resists("poison")],
  "trait/draconic-ancestry-red": [resists("fire")],
  "trait/draconic-ancestry-silver": [resists("cold")],
  "trait/draconic-ancestry-white": [resists("cold")],

  // Speed.
  "feature/fast-movement": [modifier("speed", 10, "noHeavyArmor")],
  // +10 feet at level 2, and 5 more at levels 6, 10, 14 and 18, without armor or a shield.
  "feature/unarmored-movement-1": [
    modifier("speed", 10, "unarmoredNoShield", 2),
    modifier("speed", 5, "unarmoredNoShield", 6),
    modifier("speed", 5, "unarmoredNoShield", 10),
    modifier("speed", 5, "unarmoredNoShield", 14),
    modifier("speed", 5, "unarmoredNoShield", 18),
  ],

  // Immunities that hold all the time. Disease is not tracked, and what holds only against some
  // creatures (the charm and fear of Nature's Ward) or while raging stays text.
  "feature/purity-of-body": [
    { type: "defense", kind: "immunity", damage: "poison" },
    { type: "conditionImmunity", condition: "poisoned" },
  ],
  "feature/natures-ward": [
    { type: "defense", kind: "immunity", damage: "poison" },
    { type: "conditionImmunity", condition: "poisoned" },
  ],
  "feature/aura-of-courage": [{ type: "conditionImmunity", condition: "frightened" }],

  // Rolls.
  "feature/improved-critical": [{ type: "critRange", min: 19 }],
  "feature/superior-critical": [{ type: "critRange", min: 18 }],
  "feature/reliable-talent": [{ type: "d20Floor", value: 10, on: "proficientSkills" }],

  // Skills.
  "feature/jack-of-all-trades": [{ type: "halfProficiency", round: "down" }],
  "feature/remarkable-athlete": [
    { type: "halfProficiency", round: "up", abilities: ["str", "dex", "con"] },
  ],
  "feature/bard-expertise-1": [expertise("expertise")],
  "feature/bard-expertise-2": [expertise("expertise")],
  "feature/rogue-expertise-1": [expertise("expertise", ["thieves-tools"])],
  "feature/rogue-expertise-2": [expertise("expertise", ["thieves-tools"])],

  // Eldritch invocations and the pact of the chain that give a spell or a proficiency.
  "feature/eldritch-invocation-armor-of-shadows": [atWill("mage-armor")],
  "feature/eldritch-invocation-beast-speech": [atWill("speak-with-animals")],
  "feature/eldritch-invocation-eldritch-sight": [atWill("detect-magic")],
  "feature/eldritch-invocation-fiendish-vigor": [atWill("false-life")],
  "feature/eldritch-invocation-mask-of-many-faces": [atWill("disguise-self")],
  "feature/eldritch-invocation-misty-visions": [atWill("silent-image")],
  "feature/eldritch-invocation-whispers-of-the-grave": [atWill("speak-with-dead")],
  "feature/eldritch-invocation-ascendant-step": [atWill("levitate")],
  "feature/eldritch-invocation-otherworldly-leap": [atWill("jump")],
  "feature/eldritch-invocation-master-of-myriad-forms": [atWill("alter-self")],
  "feature/eldritch-invocation-visions-of-distant-realms": [atWill("arcane-eye")],
  // At will; the rule that it is not used twice on the same creature before a long rest is left to the player.
  "feature/eldritch-invocation-chains-of-carceri": [atWill("hold-monster")],
  "feature/eldritch-invocation-thief-of-five-fates": [spell("bane"), ...uses("long", 1)],
  "feature/eldritch-invocation-sign-of-ill-omen": [spell("bestow-curse"), ...uses("long", 1)],
  "feature/eldritch-invocation-bewitching-whispers": [spell("compulsion"), ...uses("long", 1)],
  "feature/eldritch-invocation-dreadful-word": [spell("confusion"), ...uses("long", 1)],
  "feature/eldritch-invocation-minions-of-chaos": [spell("conjure-elemental"), ...uses("long", 1)],
  "feature/eldritch-invocation-sculptor-of-flesh": [spell("polymorph"), ...uses("long", 1)],
  "feature/eldritch-invocation-mire-the-mind": [spell("slow"), ...uses("long", 1)],
  "feature/eldritch-invocation-beguiling-influence": [skill("deception"), skill("persuasion")],
  "feature/pact-of-the-chain": [spell("find-familiar")],
  // The spells these features let the person pick, from the lists of the game.
  "feature/eldritch-invocation-book-of-ancient-secrets": [
    pickSpells("rituals", 2, { spellLevel: 1, ritual: true }),
  ],
  "feature/mystic-arcanum-6th-level": [
    pickSpells("arcanum", 1, { spellLevel: 6, spellClass: WARLOCK, free: true }),
  ],
  "feature/mystic-arcanum-7th-level": [
    pickSpells("arcanum", 1, { spellLevel: 7, spellClass: WARLOCK, free: true }),
  ],
  "feature/mystic-arcanum-8th-level": [
    pickSpells("arcanum", 1, { spellLevel: 8, spellClass: WARLOCK, free: true }),
  ],
  "feature/mystic-arcanum-9th-level": [
    pickSpells("arcanum", 1, { spellLevel: 9, spellClass: WARLOCK, free: true }),
  ],
  "feature/spell-mastery": [
    pickSpells("first", 1, { spellLevel: 1, spellClass: WIZARD, atWill: true }),
    pickSpells("second", 1, { spellLevel: 2, spellClass: WIZARD, atWill: true }),
  ],
  "feature/signature-spell": [
    pickSpells("signature", 2, { spellLevel: 3, spellClass: WIZARD, free: true, rest: "short" }),
  ],
  "feature/additional-magical-secrets": [pickSpells("secrets", 2, { spellUpTo: 3 })],
  "feature/magical-secrets-1": [pickSpells("secrets", 2, { spellUpTo: 5 })],
  "feature/magical-secrets-2": [pickSpells("secrets", 2, { spellUpTo: 7 })],
  "feature/magical-secrets-3": [pickSpells("secrets", 2, { spellUpTo: 9 })],
  // Damage bonuses of spells.
  "feature/empowered-evocation": [
    { type: "spellDamage", plus: "int", school: "evocation", once: true },
  ],
  "feature/elemental-affinity": Object.entries(AFFINITY).map(([type, ancestors]) =>
    affinity(type, ancestors),
  ),
  // Three cantrips from the list of any class (the spells of the other lists the book names are all cantrips).
  "feature/pact-of-the-tome": [
    { type: "choice", id: "cantrip", choose: 3, grants: "spell", from: [], spellLevel: 0 },
  ],
  // Eldritch Blast adds the Charisma modifier to its damage with this invocation.
  "feature/eldritch-invocation-agonizing-blast": [
    { type: "spellDamage", spell: "srd51:spell/eldritch-blast", plus: "cha" },
  ],

  // What the subclasses give that the vocabulary already holds: a proficiency, three skills, a
  // cantrip, a climbing speed and wings (shown in the speed's explanation; the wings are a bonus
  // action in the game and the sheet shows them as always there).
  "feature/bonus-proficiency": [{ type: "proficiency", category: "armor", target: "heavy-armor" }],
  "feature/bonus-proficiencies": [
    {
      type: "choice",
      id: "skills",
      choose: 3,
      grants: "proficiency",
      from: SKILLS.map((s) => `skill:${s}`),
    },
  ],
  "feature/bonus-cantrip": [
    pickSpells("cantrip", 1, { spellLevel: 0, spellClass: "srd51:class/druid" }),
  ],
  "feature/second-story-work": [{ type: "movement", mode: "climb", feet: "walk" }],
  "feature/dragon-wings": [{ type: "movement", mode: "fly", feet: "walk" }],

  // What the classes give that changes a number and was only text: the barbarian's capstone (the scores go
  // to 24), the rogue's proficiency in Wisdom saves and its blindsense, the monk's proficiency in every
  // save, and the paladin's aura of protection (his own Charisma modifier on every save, at least +1).
  "feature/primal-champion": [
    { type: "abilityBonus", ability: "str", value: 4, max: 24 },
    { type: "abilityBonus", ability: "con", value: 4, max: 24 },
  ],
  "feature/slippery-mind": [{ type: "proficiency", category: "save", target: "wis" }],
  "feature/blindsense": [{ type: "sense", sense: "blindsight", range: 10 }],
  "feature/diamond-soul": (["str", "dex", "con", "int", "wis", "cha"] as const).map(
    (target): Effect => ({ type: "proficiency", category: "save", target }),
  ),
  "feature/aura-of-protection": [
    { type: "modifier", target: "save", value: 0, plus: "cha", min: 1 },
  ],

  // The Life domain: its healing is stronger, heals the cleric too, and at the end takes the best of each die;
  // its Divine Strike is a die of radiant damage once per turn.
  "feature/disciple-of-life": [{ type: "spellHealing", plusSlotLevel: 2 }],
  "feature/blessed-healer": [{ type: "spellHealing", selfPlusSlotLevel: 2 }],
  "feature/supreme-healing": [{ type: "spellHealing", maxDice: true }],
  "feature/divine-strike": [
    {
      type: "extraDamage",
      damageType: "radiant",
      steps: [
        { minLevel: 8, dice: "1d8" },
        { minLevel: 14, dice: "2d8" },
      ],
      note: "oncePerTurn",
    },
  ],

  // Fighting styles that change a number. Great Weapon Fighting, Two-Weapon Fighting and
  // Protection depend on dice rerolls, the off hand and reactions, so they stay text.
  "feature/fighter-fighting-style-archery": archery,
  "feature/ranger-fighting-style-archery": archery,
  "feature/fighter-fighting-style-defense": defense,
  "feature/fighting-style-defense": defense,
  "feature/ranger-fighting-style-defense": defense,
  "feature/fighter-fighting-style-dueling": dueling,
  "feature/fighting-style-dueling": dueling,
  // The off-hand weapon adds the ability modifier to its damage (see `deriveAttacks`).
  "feature/fighter-fighting-style-two-weapon-fighting": [
    { type: "flag", id: "two-weapon-fighting" },
  ],
  "feature/ranger-fighting-style-two-weapon-fighting": [
    { type: "flag", id: "two-weapon-fighting" },
  ],
  "feature/ranger-fighting-style-dueling": dueling,
};

/**
 * What a feature takes from a pool of the class each time it is used, with how many (1 when not
 * written). The text of each feature says it; the pools are the resources of `engine/resources.ts`.
 */
const SPENDS: Record<string, { pool: SpendPool; cost?: number }> = {
  "feature/flurry-of-blows": { pool: "ki" },
  "feature/patient-defense": { pool: "ki" },
  "feature/step-of-the-wind": { pool: "ki" },
  "feature/stunning-strike": { pool: "ki" },
  "feature/diamond-soul": { pool: "ki" },
  "feature/quivering-palm": { pool: "ki", cost: 3 },
  // Empty Body also casts astral projection for 8 points: the text says it, 4 is the first use.
  "feature/empty-body": { pool: "ki", cost: 4 },
  "feature/channel-divinity-turn-undead": { pool: "channelDivinity" },
  "feature/channel-divinity-preserve-life": { pool: "channelDivinity" },
  "feature/channel-divinity-sacred-weapon": { pool: "channelDivinity" },
  "feature/channel-divinity-turn-the-unholy": { pool: "channelDivinity" },
  "feature/bardic-inspiration-d6": { pool: "bardicInspiration" },
  "feature/bardic-inspiration-d8": { pool: "bardicInspiration" },
  "feature/bardic-inspiration-d10": { pool: "bardicInspiration" },
  "feature/bardic-inspiration-d12": { pool: "bardicInspiration" },
  "feature/cutting-words": { pool: "bardicInspiration" },
  "feature/peerless-skill": { pool: "bardicInspiration" },
  "feature/wild-shape-cr-1-4-or-below-no-flying-or-swim-speed": { pool: "wildShape" },
  "feature/wild-shape-cr-1-2-or-below-no-flying-speed": { pool: "wildShape" },
  "feature/wild-shape-cr-1-or-below": { pool: "wildShape" },
  "feature/draconic-presence": { pool: "sorceryPoints", cost: 5 },
  // Twinned Spell costs as many points as the level of the spell: 1 is the least.
  "feature/metamagic-careful-spell": { pool: "sorceryPoints" },
  "feature/metamagic-distant-spell": { pool: "sorceryPoints" },
  "feature/metamagic-empowered-spell": { pool: "sorceryPoints" },
  "feature/metamagic-extended-spell": { pool: "sorceryPoints" },
  "feature/metamagic-heightened-spell": { pool: "sorceryPoints", cost: 3 },
  "feature/metamagic-quickened-spell": { pool: "sorceryPoints", cost: 2 },
  "feature/metamagic-subtle-spell": { pool: "sorceryPoints" },
  "feature/metamagic-twinned-spell": { pool: "sorceryPoints" },
};
for (const [key, spend] of Object.entries(SPENDS))
  FEATURE_EFFECTS[key] = [
    ...(FEATURE_EFFECTS[key] ?? []),
    { type: "spends", pool: spend.pool, ...(spend.cost !== undefined && { cost: spend.cost }) },
  ];

/**
 * Prices that the SRD 5.1 prints and the database lacks or has wrong, by the database's index.
 * Checked against the English PDF (SRD_CC_v5.1.pdf, "Adventuring Gear", page 69) with every priced
 * row of pages 62 to 74 (191 prices agree; these two do not):
 * - the Potion of healing is 50 gp in the book's table; the database has it only as the magic item
 *   (the common one) and gives magic items no price. The other potions of healing have no price in the SRD.
 * - Caltrops are 1 gp for the bag of 20; the database has 5 cp, the price of one piece.
 */
export const PRICES: Record<string, { amount: number; unit: "cp" | "sp" | "gp" }> = {
  "potion-of-healing-common": { amount: 50, unit: "gp" },
  caltrops: { amount: 1, unit: "gp" },
};

/**
 * The hit points a potion gives back when it is drunk (`data.use.heal`, which the Use button of the
 * inventory rolls), by the database's index. From the "Potions of Healing" table of the SRD 5.1 (p. 234):
 * healing (common) 2d4 + 2, greater (uncommon) 4d4 + 4, superior (rare) 8d4 + 8, supreme (very rare)
 * 10d4 + 20. The database only has the numbers inside each potion's text; a test compares the two.
 * Left out on purpose: the restorative ointment (2d8 + 2, but a jar has several doses).
 */
export const ITEM_HEALING: Record<string, string> = {
  "potion-of-healing-common": "2d4+2",
  "potion-of-healing-greater": "4d4+4",
  "potion-of-healing-superior": "8d4+8",
  "potion-of-healing-supreme": "10d4+20",
};

/**
 * What a feature or trait takes to use, written by hand from its text: an action, a bonus action
 * or a reaction (the same `data.activation` that Aurora's `<sheet action>` gives). A feature that
 * is used by another action (Action Surge, Extra Attack) or that is always on is not here.
 */
export const ACTIVATION: Record<string, "action" | "bonus" | "reaction"> = {
  "feature/intimidating-presence": "action",
  "feature/countercharm": "action",
  "feature/channel-divinity-turn-undead": "action",
  "feature/channel-divinity-preserve-life": "action",
  "feature/channel-divinity-sacred-weapon": "action",
  "feature/channel-divinity-turn-the-unholy": "action",
  "feature/divine-intervention": "action",
  "feature/wild-shape-cr-1-4-or-below-no-flying-or-swim-speed": "action",
  "feature/wild-shape-cr-1-2-or-below-no-flying-speed": "action",
  "feature/wild-shape-cr-1-or-below": "action",
  "feature/wholeness-of-body": "action",
  "feature/stillness-of-mind": "action",
  "feature/empty-body": "action",
  "feature/divine-sense": "action",
  "feature/lay-on-hands": "action",
  "feature/cleansing-touch": "action",
  "feature/holy-nimbus": "action",
  "feature/primeval-awareness": "action",
  "feature/multiattack-volley": "action",
  "feature/multiattack-whirlwind-attack": "action",
  "feature/draconic-presence": "action",
  "feature/eldritch-invocation-gaze-of-two-minds": "action",
  "feature/eldritch-invocation-one-with-shadows": "action",
  "feature/pact-of-the-blade": "action",
  "trait/breath-weapon": "action",
  "feature/rage": "bonus",
  "feature/frenzy": "bonus",
  "feature/bardic-inspiration-d6": "bonus",
  "feature/bardic-inspiration-d8": "bonus",
  "feature/bardic-inspiration-d10": "bonus",
  "feature/bardic-inspiration-d12": "bonus",
  "feature/second-wind": "bonus",
  "feature/martial-arts": "bonus",
  "feature/flurry-of-blows": "bonus",
  "feature/patient-defense": "bonus",
  "feature/step-of-the-wind": "bonus",
  "feature/cunning-action": "bonus",
  "feature/fast-hands": "bonus",
  "feature/vanish": "bonus",
  "feature/flexible-casting-creating-spell-slots": "bonus",
  "feature/flexible-casting-converting-spell-slot": "bonus",
  "feature/dragon-wings": "bonus",
  "feature/retaliation": "reaction",
  "feature/cutting-words": "reaction",
  "feature/fighter-fighting-style-protection": "reaction",
  "feature/fighting-style-protection": "reaction",
  "feature/deflect-missiles": "reaction",
  "feature/slow-fall": "reaction",
  "feature/hunters-prey-giant-killer": "reaction",
  "feature/superior-hunters-defense-stand-against-the-tide": "reaction",
  "feature/superior-hunters-defense-uncanny-dodge": "reaction",
  "feature/uncanny-dodge": "reaction",
};

/**
 * What the source database leaves out of a subclass: a feature missing from its levels (the
 * Circle of the Land's terrain choice) and a domain spell (the Life domain's Guardian of Faith).
 */
export const SUBCLASS_FIXES: Record<
  string,
  {
    features?: { level: number; feature: string }[];
    spells?: { spell: string; classLevel: number }[];
  }
> = {
  land: { features: [{ level: 2, feature: "circle-of-the-land" }] },
  life: { spells: [{ spell: "guardian-of-faith", classLevel: 7 }] },
};

export interface OptionFeature {
  /** How many options the character picks. */
  choose: number;
  /** A key of the class table that sets the number instead (invocations, metamagic). */
  chooseBy?: string;
  /** Take the options of another feature (an extra fighting style picks among the same). */
  optionsOf?: string;
  /** Options the source does not link to the feature (Twinned Spell has no parent). */
  also?: string[];
}

/**
 * Features whose child features are options to pick from (`parent` in the source).
 */
export const OPTION_FEATURES: Record<string, OptionFeature> = {
  "feature/fighter-fighting-style": { choose: 1 },
  "feature/paladin-fighting-style": { choose: 1 },
  "feature/ranger-fighting-style": { choose: 1 },
  "feature/additional-fighting-style": { choose: 1, optionsOf: "feature/fighter-fighting-style" },
  "feature/eldritch-invocations": { choose: 1, chooseBy: "invocationsKnown" },
  "feature/pact-boon": { choose: 1 },
  // The draconic sorcerer picks the dragon of their ancestry, which sets the damage type of Elemental Affinity.
  "feature/dragon-ancestor": { choose: 1 },
  "feature/metamagic-1": {
    choose: 2,
    chooseBy: "metamagicKnown",
    also: ["feature/metamagic-twinned-spell"],
  },
  "feature/hunters-prey": { choose: 1 },
  "feature/defensive-tactics": { choose: 1 },
  "feature/multiattack": { choose: 1 },
  "feature/superior-hunters-defense": { choose: 1 },
  "feature/circle-of-the-land": { choose: 1 },
};

/**
 * Where a magic item of the SRD is worn or held (`data.slot`, see `ITEM_SLOTS` in `engine/slots.ts`),
 * written by hand: the source database has only a category, and "wondrous item" says nothing of
 * where. Rings, wands, rods, staves, weapons and armor come from the category (`MAGIC_SLOT_OF_CATEGORY`);
 * an item that is only carried (a bag, a deck, a potion) has none.
 */
const WONDROUS_SLOT: Record<string, ItemSlotName> = {
  // Head
  "circlet-of-blasting": "head",
  "eyes-of-charming": "head",
  "eyes-of-minute-seeing": "head",
  "eyes-of-the-eagle": "head",
  "goggles-of-night": "head",
  "hat-of-disguise": "head",
  "headband-of-intellect": "head",
  "helm-of-brilliance": "head",
  "helm-of-comprehending-languages": "head",
  "helm-of-telepathy": "head",
  "helm-of-teleportation": "head",
  // Neck
  "amulet-of-health": "neck",
  "amulet-of-proof-against-detection-and-location": "neck",
  "amulet-of-the-planes": "neck",
  "brooch-of-shielding": "neck",
  "medallion-of-thoughts": "neck",
  "necklace-of-adaptation": "neck",
  "necklace-of-fireballs": "neck",
  "necklace-of-prayer-beads": "neck",
  "periapt-of-health": "neck",
  "periapt-of-proof-against-poison": "neck",
  "periapt-of-wound-closure": "neck",
  "scarab-of-protection": "neck",
  "talisman-of-pure-good": "neck",
  "talisman-of-the-sphere": "neck",
  "talisman-of-ultimate-evil": "neck",
  // Shoulders
  "cape-of-the-mountebank": "shoulders",
  "cloak-of-arachnida": "shoulders",
  "cloak-of-displacement": "shoulders",
  "cloak-of-elvenkind": "shoulders",
  "cloak-of-protection": "shoulders",
  "cloak-of-the-bat": "shoulders",
  "cloak-of-the-manta-ray": "shoulders",
  "mantle-of-spell-resistance": "shoulders",
  "wings-of-flying": "shoulders",
  // Body
  "robe-of-eyes": "body",
  "robe-of-scintillating-colors": "body",
  "robe-of-stars": "body",
  "robe-of-the-archmagi": "body",
  "robe-of-useful-items": "body",
  // Arms, hands, waist, feet
  "bracers-of-archery": "arms",
  "bracers-of-defense": "arms",
  "gauntlets-of-ogre-power": "hands",
  "gloves-of-missile-snaring": "hands",
  "gloves-of-swimming-and-climbing": "hands",
  "belt-of-dwarvenkind": "waist",
  "belt-of-giant-strength": "waist",
  "boots-of-elvenkind": "feet",
  "boots-of-levitation": "feet",
  "boots-of-speed": "feet",
  "boots-of-striding-and-springing": "feet",
  "boots-of-the-winterlands": "feet",
  "slippers-of-spider-climbing": "feet",
  "winged-boots": "feet",
};

/** The slot of a magic item that its category settles; armor splits into shields and the rest by name. */
const MAGIC_SLOT_OF_CATEGORY: Record<string, ItemSlotName> = {
  ring: "ring",
  wand: "oneHand",
  rod: "oneHand",
  staff: "oneHand",
  weapon: "oneHand",
  armor: "body",
};

/** Magic weapons that take two hands, and magic armor that is a shield. */
const TWO_HANDED_MAGIC = new Set(["hammer-of-thunderbolts", "oathbow"]);
const SHIELDS = new Set([
  "animated-shield",
  "arrow-catching-shield",
  "shield-of-missile-attraction",
  "spellguard-shield",
]);

export type ItemSlotName =
  | "head"
  | "neck"
  | "shoulders"
  | "body"
  | "arms"
  | "hands"
  | "waist"
  | "feet"
  | "ring"
  | "oneHand"
  | "twoHands"
  | "shield";

/** The slot of a magic item of the SRD by its index and category, or nothing when it is only carried. */
export function magicItemSlot(index: string, category: string): ItemSlotName | undefined {
  // The variants (a belt of giant strength by the kind of giant) carry the name of the item.
  if (category === "wondrous-items")
    return Object.entries(WONDROUS_SLOT).find(
      ([key]) => index === key || index.startsWith(`${key}-`),
    )?.[1];
  if (category === "armor" && SHIELDS.has(index)) return "shield";
  if (category === "weapon" && TWO_HANDED_MAGIC.has(index)) return "twoHands";
  return MAGIC_SLOT_OF_CATEGORY[category];
}
