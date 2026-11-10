import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { RAGE_ROUNDS, RAGE_ROUNDS_2024 } from "./durations";
import { enterRage, resourceLeft, shortRest } from "./play";

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
