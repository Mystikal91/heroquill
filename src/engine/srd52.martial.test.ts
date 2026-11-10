import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { RAGE_ROUNDS, RAGE_ROUNDS_2024 } from "./durations";
import { enterRage, resourceLeft, shortRest } from "./play";
import { type SpellRollData, spellRolls } from "./spellRolls";

type Character = ReturnType<typeof createCharacter>;

function make(classSlug: string, level: number, subclass?: string): Character {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/soldier";
  c.classes = [
    {
      classId: `srd52:class/${classSlug}`,
      level,
      ...(subclass && level >= 3 && { subclassId: `srd52:subclass/${subclass}` }),
    },
  ];
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  return c;
}

const sheetOf = (c: Character) => deriveSheet(c, bothIndex);
const resource = (c: Character, kind: string) => sheetOf(c).resources.find((r) => r.kind === kind);
const choice = (c: Character, feature: string, id: string) =>
  sheetOf(c).choices.find((p) => p.key === `srd52:feature/${feature}/${id}`);

describe("a 2024 Barbarian", () => {
  it("has the Unarmored Defense of Dexterity and Constitution, with a shield", () => {
    // 10 + Dex 2 + Con 1
    expect(sheetOf(make("barbarian", 1)).armorClass.value).toBe(13);
  });

  it("counts Rage and the Rage Damage from the class table", () => {
    expect(resource(make("barbarian", 1), "rage")?.max).toBe(2);
    expect(resource(make("barbarian", 3), "rage")?.max).toBe(3);
    expect(resource(make("barbarian", 6), "rage")?.max).toBe(4);
    expect(resource(make("barbarian", 20), "rage")?.max).toBe(6);
    const damage = (level: number) =>
      sheetOf(make("barbarian", level)).extraDamage.find((e) => e.kind === "rage");
    expect(damage(1)).toEqual({ kind: "rage", bonus: 2 });
    expect(damage(9)).toEqual({ kind: "rage", bonus: 3 });
    expect(damage(16)).toEqual({ kind: "rage", bonus: 4 });
  });

  it("makes two attacks from level 5 and moves 10 feet faster", () => {
    expect(sheetOf(make("barbarian", 4)).attacksPerAction).toBe(1);
    expect(sheetOf(make("barbarian", 5)).attacksPerAction).toBe(2);
    const fast = sheetOf(make("barbarian", 5)).speed ?? 0;
    expect(fast).toBe((sheetOf(make("barbarian", 4)).speed ?? 0) + 10);
  });

  it("picks the weapons it masters among Melee ones, two at first and more by level", () => {
    const at1 = choice(make("barbarian", 1), "barbarian-weapon-mastery", "masteries");
    expect(at1?.choose).toBe(2);
    expect(at1?.options.length).toBeGreaterThan(10);
    expect(at1?.options).toContain("srd52:item/greataxe");
    expect(at1?.options).not.toContain("srd52:item/longbow");
    expect(choice(make("barbarian", 4), "barbarian-weapon-mastery", "masteries")?.choose).toBe(3);
    expect(choice(make("barbarian", 10), "barbarian-weapon-mastery", "masteries")?.choose).toBe(4);
  });

  it("picks one more skill with Primal Knowledge at level 3", () => {
    expect(choice(make("barbarian", 2), "barbarian-primal-knowledge", "primal-knowledge")).toBe(
      undefined,
    );
    const pick = choice(make("barbarian", 3), "barbarian-primal-knowledge", "primal-knowledge");
    expect(pick?.choose).toBe(1);
    expect(pick?.options).toContain("skill:survival");
  });

  it("raises Strength and Constitution by 4, up to 25, with Primal Champion", () => {
    const c = make("barbarian", 20);
    c.abilityBase = { str: 20, dex: 14, con: 18, int: 12, wis: 10, cha: 8 };
    const sheet = sheetOf(c);
    expect(sheet.abilities.str.score).toBe(24);
    expect(sheet.abilities.con.score).toBe(22);
    c.abilityBase = { str: 20, dex: 14, con: 20, int: 12, wis: 10, cha: 8 };
    expect(sheetOf(c).abilities.str.score).toBe(24);
  });

  it("has the Berserker's feature that is used once a day and the Retaliation reaction", () => {
    const c = make("barbarian", 14, "path-of-the-berserker");
    const sheet = sheetOf(c);
    expect(sheet.features).toContain("srd52:feature/path-of-the-berserker-frenzy");
    expect(
      sheet.resources.find(
        (r) => r.entry === "srd52:feature/path-of-the-berserker-intimidating-presence",
      )?.max,
    ).toBe(1);
  });
});

describe("a 2024 Monk", () => {
  it("has the Unarmored Defense of Dexterity and Wisdom", () => {
    expect(sheetOf(make("monk", 1)).armorClass.value).toBe(12);
  });

  it("counts Focus Points and the Martial Arts die from the class table", () => {
    expect(resource(make("monk", 1), "focus")).toBeUndefined();
    expect(resource(make("monk", 2), "focus")?.max).toBe(2);
    expect(resource(make("monk", 10), "focus")?.max).toBe(10);
    const die = (level: number) =>
      sheetOf(make("monk", level)).extraDamage.find((e) => e.kind === "martialArts");
    expect(die(1)).toEqual({ kind: "martialArts", dice: "1d6" });
    expect(die(5)).toEqual({ kind: "martialArts", dice: "1d8" });
    expect(die(11)).toEqual({ kind: "martialArts", dice: "1d10" });
    expect(die(17)).toEqual({ kind: "martialArts", dice: "1d12" });
  });

  it("shows the Focus save DC", () => {
    const fact = sheetOf(make("monk", 2)).facts.find((f) => f.kind === "focusSaveDc");
    // 8 + proficiency 2 + Wisdom 0
    expect(fact?.params.dc).toBe(10);
  });

  it("spends a Focus Point on Flurry of Blows through Monk's Focus", () => {
    const sheet = sheetOf(make("monk", 2));
    expect(sheet.spends["srd52:feature/monk-monks-focus"]).toMatchObject({
      pool: "focus",
      cost: 1,
    });
  });

  it("walks faster without armor as it grows", () => {
    const base = (level: number) => sheetOf(make("monk", level)).speed ?? 0;
    expect(base(2) - base(1)).toBe(10);
    expect(base(6) - base(5)).toBe(5);
    expect(base(18) - base(17)).toBe(5);
  });

  it("uses the martial arts die with a Simple or Light martial melee weapon, and Dexterity", () => {
    const c = make("monk", 5);
    c.inventory = [
      { itemId: "srd52:item/scimitar", quantity: 1, equipped: true },
      { itemId: "srd52:item/greatsword", quantity: 1, equipped: false },
      { itemId: "srd52:item/quarterstaff", quantity: 1, equipped: false },
    ];
    const scimitar = sheetOf(c).attacks.find((a) => a.itemId === "srd52:item/scimitar");
    // d6 of the scimitar against the d8 of Martial Arts at level 5, and Dexterity 2 over Strength 2.
    expect(scimitar?.damage?.dice).toBe("1d8");
    const heavy = make("monk", 5);
    heavy.inventory = [{ itemId: "srd52:item/greatsword", quantity: 1, equipped: true }];
    expect(sheetOf(heavy).attacks[0]?.damage?.dice).toBe("2d6");
  });

  it("is proficient in every saving throw with Disciplined Survivor", () => {
    expect(sheetOf(make("monk", 13)).proficiencies.save).toHaveLength(2);
    expect(sheetOf(make("monk", 14)).proficiencies.save.length).toBe(6);
  });

  it("raises Dexterity and Wisdom by 4, up to 25, at level 20", () => {
    const c = make("monk", 20);
    c.abilityBase = { str: 10, dex: 20, con: 13, int: 12, wis: 20, cha: 8 };
    const sheet = sheetOf(c);
    expect(sheet.abilities.dex.score).toBe(24);
    expect(sheet.abilities.wis.score).toBe(24);
  });

  it("heals with Wholeness of Body as many times as the Wisdom modifier, at least once", () => {
    const sheet = sheetOf(make("monk", 6, "warrior-of-the-open-hand"));
    expect(
      sheet.resources.find(
        (r) => r.entry === "srd52:feature/warrior-of-the-open-hand-wholeness-of-body",
      )?.max,
    ).toBe(1);
  });

  it("starts with one artisan's tool or instrument, the one it is proficient with", () => {
    const start = bothIndex.get("srd52:class/monk")?.data.startingChoices as {
      options: { items: Record<string, unknown>[] }[];
    }[];
    expect(start[0]?.options[0]?.items).toContainEqual({
      category: "artisans-tools+musical-instruments",
      count: 1,
    });
  });
});

describe("a 2024 Rogue", () => {
  it("rolls Sneak Attack dice from the class table", () => {
    const dice = (level: number) =>
      sheetOf(make("rogue", level)).extraDamage.find((e) => e.kind === "sneakAttack");
    expect(dice(1)).toEqual({ kind: "sneakAttack", dice: "1d6" });
    expect(dice(3)).toEqual({ kind: "sneakAttack", dice: "2d6" });
    expect(dice(20)).toEqual({ kind: "sneakAttack", dice: "10d6" });
  });

  it("picks Expertise in two skills at level 1 and two more at level 6", () => {
    expect(choice(make("rogue", 1), "rogue-expertise", "expertise")?.choose).toBe(2);
    expect(choice(make("rogue", 5), "rogue-expertise", "expertise-2")).toBeUndefined();
    expect(choice(make("rogue", 6), "rogue-expertise", "expertise-2")?.choose).toBe(2);
  });

  it("picks two weapons to master among those it is proficient with", () => {
    const pick = choice(make("rogue", 1), "rogue-weapon-mastery", "masteries");
    expect(pick?.choose).toBe(2);
    expect(pick?.options).toContain("srd52:item/rapier");
    expect(pick?.options).toContain("srd52:item/dagger");
    expect(pick?.options).not.toContain("srd52:item/greatsword");
    expect(pick?.options).not.toContain("srd52:item/longbow");
  });

  it("treats a low die as 10 on skills (Reliable Talent) and is proficient in Wisdom and Charisma saves", () => {
    expect(sheetOf(make("rogue", 6)).proficientSkillFloor).toBe(0);
    expect(sheetOf(make("rogue", 7)).proficientSkillFloor).toBe(10);
    expect(sheetOf(make("rogue", 14)).proficiencies.save).not.toContain("wis");
    expect(sheetOf(make("rogue", 15)).proficiencies.save).toEqual(
      expect.arrayContaining(["wis", "cha"]),
    );
  });

  it("gives the Thief a climbing speed and a fourth attunement", () => {
    const sheet = sheetOf(make("rogue", 13, "thief"));
    // Everyone climbs at half the speed; the Thief at the whole speed.
    expect(sheet.movement.climb).toEqual({ feet: sheet.speed });
    expect(sheetOf(make("rogue", 13)).movement.climb?.half).toBe(true);
    expect(sheet.attunement.max).toBe(4);
    expect(sheetOf(make("rogue", 12, "thief")).attunement.max).toBe(3);
  });

  it("uses Stroke of Luck once between rests at level 20", () => {
    expect(
      sheetOf(make("rogue", 20)).resources.find(
        (r) => r.entry === "srd52:feature/rogue-stroke-of-luck",
      )?.max,
    ).toBe(1);
  });
});

describe("proficiency with named weapons", () => {
  it("makes a Monk proficient with a Scimitar and a Rogue with a Rapier, and not the other way round", () => {
    const monk = make("monk", 1);
    monk.inventory = [{ itemId: "srd52:item/scimitar", quantity: 1, equipped: true }];
    expect(sheetOf(monk).attacks[0]?.proficient).toBe(true);
    const rogue = make("rogue", 1);
    rogue.inventory = [{ itemId: "srd52:item/rapier", quantity: 1, equipped: true }];
    expect(sheetOf(rogue).attacks[0]?.proficient).toBe(true);
    // A Monk has no proficiency with a Rapier (a Finesse weapon without Light), nor a Rogue with a Greatsword.
    monk.inventory = [{ itemId: "srd52:item/rapier", quantity: 1, equipped: true }];
    expect(sheetOf(monk).attacks[0]?.proficient).toBe(false);
    rogue.inventory = [{ itemId: "srd52:item/greatsword", quantity: 1, equipped: true }];
    expect(sheetOf(rogue).attacks[0]?.proficient).toBe(false);
  });
});

describe("the 2024 Rage and Wholeness of Body", () => {
  it("gives back one use of Rage on a short rest, and all of them on a long one", () => {
    const c = make("barbarian", 5);
    const rage = resource(c, "rage");
    expect(rage?.shortRegain).toBe(1);
    if (!rage) throw new Error("no rage");
    let play = enterRage(c.play, rage);
    play = enterRage({ ...play, raging: false }, rage);
    expect(resourceLeft(play, rage.id, rage.max)).toBe(1);
    const rested = shortRest(play, "none", [], [{ id: rage.id, count: rage.shortRegain ?? 0 }]);
    expect(resourceLeft(rested, rage.id, rage.max)).toBe(2);
    // The 2014 rage has no such rule.
    const old = createCharacter("srd51");
    old.classes = [{ classId: "srd51:class/barbarian", level: 5 }];
    expect(
      deriveSheet(old, bothIndex).resources.find((r) => r.kind === "rage")?.shortRegain,
    ).toBeUndefined();
  });

  it("lasts a minute in 2014 and up to ten in 2024 (the person ends it)", () => {
    const rage = { id: "rage:barbarian", max: 3 };
    expect(enterRage(createCharacter("srd51").play, rage).rounds).toEqual({ rage: RAGE_ROUNDS });
    expect(enterRage(createCharacter("srd52").play, rage, RAGE_ROUNDS_2024).rounds).toEqual({
      rage: RAGE_ROUNDS_2024,
    });
    expect(RAGE_ROUNDS_2024).toBe(100);
  });

  it("heals the Martial Arts die plus the Wisdom modifier with Wholeness of Body, at least 1", () => {
    const c = make("monk", 6, "warrior-of-the-open-hand");
    c.abilityBase = { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 8 };
    const heal = sheetOf(c).selfHeals["srd52:feature/warrior-of-the-open-hand-wholeness-of-body"];
    expect(heal).toEqual({ dice: "1d8", bonus: 2, minimum: 1 });
  });
});

describe("a 2024 Paladin", () => {
  it("has spell slots, prepared spells and the Oath spells from the tables", () => {
    const c = make("paladin", 5, "oath-of-devotion");
    const sheet = sheetOf(c);
    expect(sheet.spellSlots.slice(0, 3)).toEqual([4, 2, 0]);
    const caster = sheet.spellcasters[0];
    expect(caster?.ability).toBe("cha");
    // The table says six prepared spells at level 5; the Oath spells do not count against them.
    expect(caster?.lists.prepared?.allowed).toBe(6);
    expect(caster?.lists.maxSpellLevel).toBe(2);
    expect(caster?.lists.alwaysPrepared).toEqual(
      expect.arrayContaining([
        "srd52:spell/protection-from-evil-and-good",
        "srd52:spell/shield-of-faith",
        "srd52:spell/aid",
        "srd52:spell/zone-of-truth",
      ]),
    );
    expect(caster?.lists.alwaysPrepared).not.toContain("srd52:spell/beacon-of-hope");
    const pool = caster?.lists.prepared?.pool ?? [];
    expect(pool).toContain("srd52:spell/cure-wounds");
    expect(pool).not.toContain("srd52:spell/fireball");
    expect(pool.every((id) => Number(bothIndex.get(id)?.data.level) <= 2)).toBe(true);
  });

  it("always has Divine Smite, and Find Steed from level 5, as spells", () => {
    expect(sheetOf(make("paladin", 1)).grantedSpells).not.toContain("srd52:spell/divine-smite");
    expect(sheetOf(make("paladin", 2)).grantedSpells).toContain("srd52:spell/divine-smite");
    expect(sheetOf(make("paladin", 4)).grantedSpells).not.toContain("srd52:spell/find-steed");
    expect(sheetOf(make("paladin", 5)).grantedSpells).toContain("srd52:spell/find-steed");
    // No separate smite button: the spell is the smite.
    expect(sheetOf(make("paladin", 5)).extraDamage.some((e) => e.kind === "divineSmite")).toBe(
      false,
    );
  });

  it("counts Lay On Hands and Channel Divinity, which gives one use back on a short rest", () => {
    expect(resource(make("paladin", 7), "layOnHands")?.max).toBe(35);
    expect(resource(make("paladin", 2), "channelDivinity")).toBeUndefined();
    const two = resource(make("paladin", 3), "channelDivinity");
    expect(two?.max).toBe(2);
    expect(two?.shortRegain).toBe(1);
    expect(resource(make("paladin", 11), "channelDivinity")?.max).toBe(3);
  });

  it("adds the Charisma modifier to saving throws, is immune to fear and strikes for 1d8 radiant", () => {
    const c = make("paladin", 11, "oath-of-devotion");
    c.abilityBase = { str: 15, dex: 10, con: 13, int: 8, wis: 10, cha: 16 };
    const sheet = sheetOf(c);
    expect(sheet.conditionImmunities).toEqual(
      expect.arrayContaining(["srd52:condition/frightened", "srd52:condition/charmed"]),
    );
    expect(bothIndex.has("srd52:condition/frightened")).toBe(true);
    expect(sheet.bonuses.some((b) => b.target === "save")).toBe(true);
    expect(
      sheet.extraDamage.find((e) => e.kind === "feature" && e.damageType === "radiant"),
    ).toMatchObject({ dice: "1d8" });
    expect(
      sheetOf(make("paladin", 10)).extraDamage.some(
        (e) => e.kind === "feature" && e.damageType === "radiant",
      ),
    ).toBe(false);
  });

  it("asks for Strength and Charisma 13 to multiclass into", () => {
    const multi = (bothIndex.get("srd52:class/paladin")?.data.multiclassing ?? {}) as {
      prerequisites?: { ability: string; minimum: number }[];
    };
    expect(multi.prerequisites).toEqual([
      { ability: "str", minimum: 13 },
      { ability: "cha", minimum: 13 },
    ]);
  });
});

describe("a 2024 Ranger", () => {
  it("prepares spells by the table and always has Hunter's Mark, cast free more often as it grows", () => {
    const one = sheetOf(make("ranger", 1));
    expect(one.spellcasters[0]?.lists.prepared?.allowed).toBe(2);
    expect(one.spellSlots[0]).toBe(2);
    expect(one.grantedSpells).toContain("srd52:spell/hunters-mark");
    const uses = (level: number) =>
      sheetOf(make("ranger", level)).resources.find(
        (r) => r.entry === "srd52:feature/ranger-favored-enemy",
      )?.max;
    expect(uses(1)).toBe(2);
    expect(uses(5)).toBe(3);
    expect(uses(17)).toBe(6);
  });

  it("moves 10 feet faster, climbs and swims at its Speed from level 6", () => {
    const five = sheetOf(make("ranger", 5));
    const six = sheetOf(make("ranger", 6));
    expect((six.speed ?? 0) - (five.speed ?? 0)).toBe(10);
    expect(six.movement.climb).toEqual({ feet: six.speed });
    expect(six.movement.swim).toEqual({ feet: six.speed });
  });

  it("gets Expertise at levels 2 and 9 and Blindsight at level 18", () => {
    expect(choice(make("ranger", 1), "ranger-deft-explorer", "expertise")).toBeUndefined();
    expect(choice(make("ranger", 2), "ranger-deft-explorer", "expertise")?.choose).toBe(1);
    expect(choice(make("ranger", 9), "ranger-expertise", "expertise")?.choose).toBe(2);
    expect(sheetOf(make("ranger", 17)).senses.blindsight).toBeUndefined();
    expect(sheetOf(make("ranger", 18)).senses.blindsight).toBe(30);
  });

  it("makes two attacks from level 5 and masters weapons it is proficient with", () => {
    expect(sheetOf(make("ranger", 5)).attacksPerAction).toBe(2);
    const pick = choice(make("ranger", 1), "ranger-weapon-mastery", "masteries");
    expect(pick?.choose).toBe(2);
    expect(pick?.options).toContain("srd52:item/longbow");
  });
});

describe("the 2024 spells", () => {
  const spells = [...bothIndex.values()].filter((e) => e.id.startsWith("srd52:spell/"));

  it("are all of the list, with the school, level and damage the data gives", () => {
    expect(spells).toHaveLength(339);
    const bolt = bothIndex.get("srd52:spell/fire-bolt");
    expect(bolt?.data.level).toBe(0);
    expect(bolt?.data.school).toBe("evocation");
    expect(bolt?.data.damage).toEqual([
      {
        damageType: { index: "fire" },
        damageAtCharacterLevel: { "1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10" },
      },
    ]);
    expect(bothIndex.get("srd52:school/evocation")?.kind).toBe("school");
  });

  it("roll like the 5.1 ones: the damage of the base level, with the attack or not", () => {
    const roll = (id: string) =>
      spellRolls(bothIndex.get(id)?.data as unknown as SpellRollData, {
        slotLevel: id.endsWith("fire-bolt") ? 0 : 3,
        characterLevel: 5,
        modifier: 3,
      });
    // A cantrip grows with the character level, a spell with the slot, and the save and the healing are there.
    expect(roll("srd52:spell/fire-bolt")).toMatchObject({
      attack: true,
      damage: [{ type: "fire", dice: "2d10" }],
    });
    expect(roll("srd52:spell/fireball")).toMatchObject({
      damage: [{ type: "fire", dice: "8d6" }],
      save: "dex",
      scalesBySlot: true,
    });
    const fireball = bothIndex.get("srd52:spell/fireball")?.data as unknown as SpellRollData;
    expect(spellRolls(fireball, { slotLevel: 5, characterLevel: 9, modifier: 3 }).damage).toEqual([
      { type: "fire", dice: "10d6" },
    ]);
    const cure = bothIndex.get("srd52:spell/cure-wounds")?.data as unknown as SpellRollData;
    expect(spellRolls(cure, { slotLevel: 2, characterLevel: 5, modifier: 3 }).heal).toBe("4d8+3");
    // Every spell that has damage in the data can be rolled (none breaks the roller).
    for (const spell of spells.filter((s) => s.data.damage !== undefined))
      expect(() =>
        spellRolls(spell.data as unknown as SpellRollData, {
          slotLevel: Number(spell.data.level),
          characterLevel: 5,
          modifier: 3,
        }),
      ).not.toThrow();
  });

  it("belong to the classes the pack has", () => {
    const cure = bothIndex.get("srd52:spell/cure-wounds")?.data.classes as string[];
    expect(cure).toEqual(expect.arrayContaining(["srd52:class/paladin", "srd52:class/ranger"]));
    expect(cure.every((id) => bothIndex.has(id))).toBe(true);
  });
});
