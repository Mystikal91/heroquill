import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

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
  c.abilityBase = { str: 10, dex: 14, con: 14, int: 12, wis: 12, cha: 16 };
  return c;
}

const sheetOf = (c: Character) => deriveSheet(c, bothIndex);
const resource = (c: Character, kind: string) => sheetOf(c).resources.find((r) => r.kind === kind);
const choice = (c: Character, feature: string, id: string) =>
  sheetOf(c).choices.find((p) => p.key === `srd52:feature/${feature}/${id}`);
const caster = (c: Character) => sheetOf(c).spellcasters[0];
const CASTERS = ["bard", "cleric", "druid", "sorcerer", "warlock", "wizard"] as const;

describe("the six 2024 casters, level by level", () => {
  it("derive a sheet at every level with the cantrips, slots and prepared spells of their table", () => {
    for (const slug of CASTERS) {
      const data = bothIndex.get(`srd52:class/${slug}`)?.data as {
        levels: {
          level: number;
          cantripsKnown?: number;
          spellsKnown?: number;
          spellSlots?: number[];
        }[];
      };
      for (const row of data.levels) {
        const sheet = sheetOf(make(slug, row.level));
        const c = sheet.spellcasters[0];
        expect(c, `${slug} ${row.level}`).toBeDefined();
        expect(c?.lists.prepared?.allowed, `${slug} ${row.level} prepared`).toBe(row.spellsKnown);
        expect(c?.lists.cantrips?.allowed, `${slug} ${row.level} cantrips`).toBe(row.cantripsKnown);
        expect(sheet.warnings.filter((w) => w.code === "unknownEntry")).toEqual([]);
      }
    }
  });

  it("have the spellcasting ability of the class and the spells of their own list", () => {
    expect(caster(make("bard", 1))?.ability).toBe("cha");
    expect(caster(make("cleric", 1))?.ability).toBe("wis");
    expect(caster(make("druid", 1))?.ability).toBe("wis");
    expect(caster(make("sorcerer", 1))?.ability).toBe("cha");
    expect(caster(make("warlock", 1))?.ability).toBe("cha");
    expect(caster(make("wizard", 1))?.ability).toBe("int");
    const pool = caster(make("wizard", 1))?.lists.known?.pool ?? [];
    expect(pool).toContain("srd52:spell/magic-missile");
    expect(pool).not.toContain("srd52:spell/cure-wounds");
  });
});

describe("a 2024 Bard", () => {
  it("has Bardic Inspiration as many times as the Charisma modifier, with the die of the table", () => {
    expect(resource(make("bard", 1), "bardicInspiration")?.max).toBe(3);
    expect(resource(make("bard", 1), "bardicInspiration")?.recovery).toBe("long");
    // Font of Inspiration: a short rest from level 5.
    expect(resource(make("bard", 5), "bardicInspiration")?.recovery).toBe("short");
    const die = (level: number) =>
      sheetOf(make("bard", level)).facts.find((f) => f.kind === "bardicDie")?.params.die;
    expect([die(1), die(5), die(10), die(15)]).toEqual([6, 8, 10, 12]);
  });

  it("picks Expertise at levels 2 and 9 and three more skills in the College of Lore", () => {
    expect(choice(make("bard", 1), "bard-expertise", "expertise")).toBeUndefined();
    expect(choice(make("bard", 2), "bard-expertise", "expertise")?.choose).toBe(2);
    expect(choice(make("bard", 8), "bard-expertise", "expertise-2")).toBeUndefined();
    expect(choice(make("bard", 9), "bard-expertise", "expertise-2")?.choose).toBe(2);
    const lore = choice(
      make("bard", 3, "college-of-lore"),
      "college-of-lore-bonus-proficiencies",
      "skills",
    );
    expect(lore?.choose).toBe(3);
    expect(lore?.options.length).toBe(18);
  });

  it("always has Power Word Heal and Power Word Kill at level 20", () => {
    expect(sheetOf(make("bard", 19)).grantedSpells).not.toContain("srd52:spell/power-word-heal");
    expect(sheetOf(make("bard", 20)).grantedSpells).toEqual(
      expect.arrayContaining(["srd52:spell/power-word-heal", "srd52:spell/power-word-kill"]),
    );
  });
});

describe("a 2024 Cleric", () => {
  it("has Channel Divinity twice from level 2, which gives one use back on a short rest", () => {
    expect(resource(make("cleric", 1), "channelDivinity")).toBeUndefined();
    const cd = resource(make("cleric", 2), "channelDivinity");
    expect(cd?.max).toBe(2);
    expect(cd?.shortRegain).toBe(1);
    expect(resource(make("cleric", 6), "channelDivinity")?.max).toBe(3);
    expect(resource(make("cleric", 18), "channelDivinity")?.max).toBe(4);
  });

  it("always has the Life Domain spells by level and heals for more", () => {
    const sheet = sheetOf(make("cleric", 5, "life-domain"));
    const always = sheet.spellcasters[0]?.lists.alwaysPrepared ?? [];
    expect(always).toEqual(
      expect.arrayContaining([
        "srd52:spell/aid",
        "srd52:spell/bless",
        "srd52:spell/cure-wounds",
        "srd52:spell/lesser-restoration",
        "srd52:spell/mass-healing-word",
        "srd52:spell/revivify",
      ]),
    );
    expect(always).not.toContain("srd52:spell/death-ward");
    expect(sheet.spellHealing.plusSlotLevel).toBe(2);
    expect(sheetOf(make("cleric", 6, "life-domain")).spellHealing.selfPlusSlotLevel).toBe(2);
    expect(sheetOf(make("cleric", 17, "life-domain")).spellHealing.maxDice).toBe(true);
  });
});

describe("a 2024 Druid", () => {
  it("has Wild Shape from the table, with the Challenge Rating of its Beast Shapes table", () => {
    expect(resource(make("druid", 1), "wildShape")).toBeUndefined();
    const ws = resource(make("druid", 2), "wildShape");
    expect(ws?.max).toBe(2);
    expect(ws?.shortRegain).toBe(1);
    expect(resource(make("druid", 6), "wildShape")?.max).toBe(3);
    expect(resource(make("druid", 17), "wildShape")?.max).toBe(4);
    const cr = (level: number) =>
      sheetOf(make("druid", level)).facts.find((f) => f.kind === "wildShape")?.params.cr;
    expect([cr(2), cr(4), cr(8)]).toEqual(["1/4", "1/2", "1"]);
  });

  it("always has Speak with Animals", () => {
    expect(sheetOf(make("druid", 1)).grantedSpells).toContain("srd52:spell/speak-with-animals");
  });

  it("picks a kind of land with Circle Spells and has its spells, and its Resistance from level 10", () => {
    const land = choice(
      make("druid", 3, "circle-of-the-land"),
      "circle-of-the-land-circle-of-the-land-spells",
      "land",
    );
    expect(land?.options.sort()).toEqual([
      "srd52:trait/land-arid",
      "srd52:trait/land-polar",
      "srd52:trait/land-temperate",
      "srd52:trait/land-tropical",
    ]);
    const c = make("druid", 5, "circle-of-the-land");
    c.selections["srd52:feature/circle-of-the-land-circle-of-the-land-spells/land"] = [
      "srd52:trait/land-arid",
    ];
    expect(sheetOf(c).grantedSpells).toEqual(
      expect.arrayContaining([
        "srd52:spell/blur",
        "srd52:spell/burning-hands",
        "srd52:spell/fireball",
      ]),
    );
    expect(sheetOf(c).grantedSpells).not.toContain("srd52:spell/blight");
    expect(sheetOf(c).defenses.resistance).not.toContain("fire");
    const high = make("druid", 10, "circle-of-the-land");
    high.selections["srd52:feature/circle-of-the-land-circle-of-the-land-spells/land"] = [
      "srd52:trait/land-arid",
    ];
    expect(sheetOf(high).defenses.resistance).toContain("fire");
    expect(sheetOf(high).conditionImmunities).toContain("srd52:condition/poisoned");
  });
});

describe("a 2024 Sorcerer", () => {
  it("has Sorcery Points from the table", () => {
    expect(resource(make("sorcerer", 1), "sorceryPoints")).toBeUndefined();
    const sp = resource(make("sorcerer", 2), "sorceryPoints");
    expect(sp?.max).toBe(2);
    expect(sp?.pool).toBe(true);
    expect(resource(make("sorcerer", 20), "sorceryPoints")?.max).toBe(20);
  });

  it("has the Draconic armor class and Hit Points, and spells by level", () => {
    const sheet = sheetOf(make("sorcerer", 3, "draconic-sorcery"));
    // 10 + Dexterity 2 + Charisma 3 without armor.
    expect(sheet.armorClass.value).toBe(15);
    expect(sheet.spellcasters[0]?.lists.alwaysPrepared).toEqual(
      expect.arrayContaining([
        "srd52:spell/alter-self",
        "srd52:spell/chromatic-orb",
        "srd52:spell/command",
      ]),
    );
    const plain = sheetOf(make("sorcerer", 3)).hitPoints.max;
    expect(sheet.hitPoints.max - plain).toBe(3);
    expect(
      sheetOf(make("sorcerer", 5, "draconic-sorcery")).spellcasters[0]?.lists.alwaysPrepared,
    ).toContain("srd52:spell/fly");
  });

  it("picks the damage type of Elemental Affinity and gets its Resistance", () => {
    const pick = choice(
      make("sorcerer", 6, "draconic-sorcery"),
      "draconic-sorcery-elemental-affinity",
      "damage-type",
    );
    expect(pick?.options.length).toBe(5);
    const c = make("sorcerer", 6, "draconic-sorcery");
    c.selections["srd52:feature/draconic-sorcery-elemental-affinity/damage-type"] = [
      "srd52:trait/elemental-affinity-fire",
    ];
    expect(sheetOf(c).defenses.resistance).toContain("fire");
    expect(sheetOf(c).spellDamage).toContainEqual(
      expect.objectContaining({ damageType: "fire", once: true }),
    );
  });
});

describe("a 2024 Warlock", () => {
  it("has Pact Magic slots of one level, and prepared spells up to that level", () => {
    // A lone Warlock has its Pact Magic slots as its only ones; beside another caster they are kept apart.
    expect(sheetOf(make("warlock", 1)).spellSlots).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(sheetOf(make("warlock", 5)).spellSlots).toEqual([0, 0, 2, 0, 0, 0, 0, 0, 0]);
    expect(sheetOf(make("warlock", 11)).spellSlots).toEqual([0, 0, 0, 0, 3, 0, 0, 0, 0]);
    expect(sheetOf(make("warlock", 17)).spellSlots).toEqual([0, 0, 0, 0, 4, 0, 0, 0, 0]);
    const mixed = make("warlock", 5);
    mixed.classes = [...mixed.classes, { classId: "srd52:class/wizard", level: 3 }];
    expect(sheetOf(mixed).pactSlots).toEqual({ level: 3, count: 2 });
    const at6 = caster(make("warlock", 6));
    expect(at6?.lists.prepared?.allowed).toBe(7);
    expect(at6?.lists.maxSpellLevel).toBe(3);
    const pool = at6?.lists.prepared?.pool ?? [];
    expect(pool).toContain("srd52:spell/hex");
    expect(pool.every((id) => Number(bothIndex.get(id)?.data.level) <= 3)).toBe(true);
  });

  it("gets a Mystic Arcanum of level 6 at 11, and one more at 13, 15 and 17", () => {
    const arcana = (level: number) =>
      sheetOf(make("warlock", level))
        .resources.filter((r) => r.kind === "mysticArcanum")
        .map((r) => r.level);
    expect(arcana(10)).toEqual([]);
    expect(arcana(11)).toEqual([6]);
    expect(arcana(13)).toEqual([6, 7]);
    expect(arcana(17)).toEqual([6, 7, 8, 9]);
  });

  it("has the Fiend spells by level and Dark One's Own Luck as many times as the Charisma modifier", () => {
    const sheet = sheetOf(make("warlock", 5, "fiend-patron"));
    expect(sheet.spellcasters[0]?.lists.alwaysPrepared).toEqual(
      expect.arrayContaining(["srd52:spell/burning-hands", "srd52:spell/fireball"]),
    );
    const luck = (level: number) =>
      sheetOf(make("warlock", level, "fiend-patron")).resources.find(
        (r) => r.entry === "srd52:feature/fiend-patron-dark-ones-own-luck",
      );
    expect(luck(5)).toBeUndefined();
    expect(luck(6)?.max).toBe(3);
  });
});

describe("a 2024 Wizard", () => {
  it("keeps a spellbook of six spells and two more for each level, and prepares by the table", () => {
    const at1 = caster(make("wizard", 1));
    expect(at1?.lists.known?.allowed).toBe(6);
    expect(at1?.lists.prepared?.allowed).toBe(4);
    expect(caster(make("wizard", 5))?.lists.known?.allowed).toBe(14);
    expect(caster(make("wizard", 20))?.lists.prepared?.allowed).toBe(25);
  });

  it("recovers slots of a combined level up to half the Wizard level, rounded up", () => {
    const levels = (level: number) =>
      sheetOf(make("wizard", level)).facts.find((f) => f.kind === "arcaneRecovery")?.params.levels;
    expect([levels(1), levels(4), levels(5), levels(20)]).toEqual([1, 2, 3, 10]);
  });

  it("picks one skill to be an expert in with Scholar, and the Evoker adds its Intelligence to a damage roll", () => {
    expect(choice(make("wizard", 2), "wizard-scholar", "expertise")?.options.length).toBe(6);
    expect(sheetOf(make("wizard", 10, "evoker")).spellDamage).toContainEqual(
      expect.objectContaining({ school: "evocation", once: true }),
    );
  });

  it("has Nature among the skills it picks at the start", () => {
    const wizard = bothIndex.get("srd52:class/wizard");
    const options = (wizard?.effects ?? []).flatMap((e) =>
      e.type === "choice" && e.grants === "proficiency" ? e.from : [],
    );
    expect(options).toContain("skill:nature");
  });
});
