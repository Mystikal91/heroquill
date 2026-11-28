import { describe, expect, it } from "vitest";
import { srd51Index as index } from "../test/srd51";
import { createCharacter, createPlayState } from "./character";
import { deriveSheet } from "./derive";
import { doubleDice } from "./dice";
import {
  concentrationDc,
  endConcentration,
  resourceLeft,
  setResourceUsed,
  shortRest,
  startConcentration,
} from "./play";
import { resourcesByEntry } from "./resources";
import { deriveFreeSpells } from "./uses";

function hero(classes: { id: string; level: number }[], scores = {}) {
  const c = createCharacter("srd51");
  c.classes = classes.map((x) => ({ classId: `srd51:class/${x.id}`, level: x.level }));
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 16, ...scores };
  return deriveSheet(c, index);
}

const kinds = (sheet: ReturnType<typeof hero>) =>
  Object.fromEntries(sheet.resources.map((r) => [r.entry?.split("/")[1] ?? r.kind, r.max]));

describe("class resources", () => {
  it("gives a fighter Second Wind and Action Surge, and Indomitable later", () => {
    expect(kinds(hero([{ id: "fighter", level: 1 }]))).toEqual({ "second-wind": 1 });
    expect(kinds(hero([{ id: "fighter", level: 2 }]))).toEqual({
      "second-wind": 1,
      actionSurge: 1,
    });
    expect(kinds(hero([{ id: "fighter", level: 9 }]))).toEqual({
      "second-wind": 1,
      actionSurge: 1,
      indomitable: 1,
    });
    expect(kinds(hero([{ id: "fighter", level: 17 }]))).toMatchObject({
      actionSurge: 2,
      indomitable: 3,
    });
  });

  it("makes no second counter for a feature the class table counts, whatever uses it says", () => {
    // A book's Lay on Hands with uses of its own (a pack adds them to the SRD's): the pool stays one.
    const id = "srd51:feature/lay-on-hands";
    const hands = index.get(id);
    if (!hands) throw new Error(id);
    const withUses = new Map(index);
    withUses.set(id, {
      ...hands,
      effects: [
        ...hands.effects,
        { type: "uses", term: { classLevel: "paladin" }, recharge: "long" },
      ],
    });
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/paladin", level: 3 }];
    const sheet = deriveSheet(c, withUses);
    expect(sheet.resources.filter((r) => r.kind === "layOnHands")).toHaveLength(1);
    expect(sheet.resources.some((r) => r.entry === id)).toBe(false);
  });

  it("counts a barbarian's rages and shows the rage damage", () => {
    const sheet = hero([{ id: "barbarian", level: 3 }]);
    expect(sheet.resources).toEqual([
      expect.objectContaining({ kind: "rage", max: 3, recovery: "long" }),
    ]);
    expect(sheet.facts).toContainEqual({ kind: "rageDamage", params: { n: 2 } });
    expect(hero([{ id: "barbarian", level: 20 }]).resources[0]?.unlimited).toBe(true);
  });

  it("makes ki a pool that comes back on a short rest", () => {
    const sheet = hero([{ id: "monk", level: 5 }]);
    expect(sheet.resources).toEqual([
      expect.objectContaining({ kind: "ki", max: 5, recovery: "short", pool: true }),
    ]);
    expect(sheet.facts).toContainEqual({ kind: "martialArts", params: { dice: "1d6" } });
  });

  it("ties Bardic Inspiration and Divine Sense to Charisma", () => {
    // Charisma 16 is +3.
    expect(kinds(hero([{ id: "bard", level: 4 }]))).toEqual({ bardicInspiration: 3 });
    expect(hero([{ id: "bard", level: 4 }]).resources[0]?.recovery).toBe("long");
    expect(hero([{ id: "bard", level: 5 }]).resources[0]?.recovery).toBe("short");
    expect(kinds(hero([{ id: "paladin", level: 3 }]))).toEqual({
      layOnHands: 15,
      "divine-sense": 4,
      channelDivinity: 1,
    });
  });

  it("lists sneak attack dice, Wild Shape and Arcane Recovery", () => {
    expect(hero([{ id: "rogue", level: 5 }]).facts).toContainEqual({
      kind: "sneakAttack",
      params: { dice: "3d6" },
    });
    expect(kinds(hero([{ id: "druid", level: 2 }]))).toEqual({ wildShape: 2 });
    expect(kinds(hero([{ id: "wizard", level: 1 }]))).toEqual({ "arcane-recovery": 1 });
    expect(kinds(hero([{ id: "sorcerer", level: 3 }]))).toEqual({ sorceryPoints: 3 });
  });

  it("tracks each Mystic Arcanum of a warlock", () => {
    const sheet = hero([{ id: "warlock", level: 13 }]);
    expect(sheet.resources.filter((r) => r.kind === "mysticArcanum").map((r) => r.level)).toEqual([
      6, 7,
    ]);
  });

  it("keeps the resources of every class of a multiclass character", () => {
    const sheet = hero([
      { id: "fighter", level: 2 },
      { id: "barbarian", level: 1 },
    ]);
    expect(sheet.resources.map((r) => r.id).sort()).toEqual([
      "actionSurge:fighter",
      "rage:barbarian",
      "uses:srd51:feature/second-wind",
    ]);
  });
});

describe("spending resources", () => {
  it("counts uses left and never goes out of range", () => {
    let play = createPlayState();
    expect(resourceLeft(play, "rage:barbarian", 3)).toBe(3);
    play = setResourceUsed(play, "rage:barbarian", 2, 3);
    expect(resourceLeft(play, "rage:barbarian", 3)).toBe(1);
    expect(resourceLeft(setResourceUsed(play, "rage:barbarian", 9, 3), "rage:barbarian", 3)).toBe(
      0,
    );
    expect(resourceLeft(setResourceUsed(play, "rage:barbarian", -4, 3), "rage:barbarian", 3)).toBe(
      3,
    );
  });

  it("gives back only what a short rest recovers", () => {
    let play = setResourceUsed(createPlayState(), "ki:monk", 3, 5);
    play = setResourceUsed(play, "rage:barbarian", 1, 3);
    const rested = shortRest(play, "none", ["ki:monk"]);
    expect(resourceLeft(rested, "ki:monk", 5)).toBe(5);
    expect(resourceLeft(rested, "rage:barbarian", 3)).toBe(2);
  });
});

describe("concentration", () => {
  it("starts on a spell, replaces it and ends", () => {
    let play = startConcentration(createPlayState(), "srd51:spell/bless");
    expect(play.concentration).toBe("srd51:spell/bless");
    play = startConcentration(play, "srd51:spell/haste");
    expect(play.concentration).toBe("srd51:spell/haste");
    expect(endConcentration(play).concentration).toBeUndefined();
  });

  it("asks for a save of 10 or half the damage, whichever is higher", () => {
    expect(concentrationDc(4)).toBe(10);
    expect(concentrationDc(22)).toBe(11);
    expect(concentrationDc(31)).toBe(15);
  });
});

describe("critical hits", () => {
  it("doubles the dice and keeps the bonus", () => {
    expect(doubleDice("1d8+3")).toBe("2d8+3");
    expect(doubleDice("2d6")).toBe("4d6");
    expect(doubleDice("1d6+1d4-1")).toBe("2d6+2d4-1");
    expect(doubleDice("sword")).toBeUndefined();
  });
});

describe("uses written as data", () => {
  it("adds up the terms and keeps the floor of a bonus that cannot go below one", () => {
    // Charisma 16 is +3, Charisma 6 is -2.
    expect(kinds(hero([{ id: "paladin", level: 14 }]))).toMatchObject({
      "divine-sense": 4,
      "cleansing-touch": 3,
    });
    const weak = kinds(hero([{ id: "paladin", level: 14 }], { cha: 6 }));
    expect(weak["cleansing-touch"]).toBe(1);
    expect(weak["divine-sense"]).toBeUndefined();
  });

  it("names the entry that gives them and lets them be ticked off", () => {
    const sheet = hero([{ id: "paladin", level: 1 }]);
    const sense = sheet.resources.find((r) => r.entry === "srd51:feature/divine-sense");
    expect(sense).toMatchObject({
      id: "uses:srd51:feature/divine-sense",
      max: 4,
      recovery: "long",
    });
  });

  it("gives species traits and invocations their uses", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/warlock", level: 1 }];
    c.choices.species = "srd51:species/half-orc";
    const sheet = deriveSheet(c, index);
    expect(sheet.resources.map((r) => r.entry)).toContain("srd51:trait/relentless-endurance");
  });
});

describe("what the person decides about a feature", () => {
  const paladin = (settings: Parameters<typeof withSettings>[0]) => withSettings(settings);
  function withSettings(
    settings: NonNullable<ReturnType<typeof createCharacter>["featureSettings"]>,
  ) {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/paladin", level: 1 }];
    c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 16 };
    c.featureSettings = settings;
    return deriveSheet(c, index);
  }
  const sense = "srd51:feature/divine-sense";
  const left = (sheet: ReturnType<typeof deriveSheet>) =>
    sheet.resources.find((r) => r.entry === sense);

  it("replaces the uses the data gives, or takes them away", () => {
    expect(left(paladin({ [sense]: { uses: 2 } }))).toMatchObject({ max: 2, recovery: "long" });
    expect(left(paladin({ [sense]: { uses: 0 } }))).toBeUndefined();
    expect(left(paladin({ [sense]: { recharge: "short" } }))).toMatchObject({
      max: 4,
      recovery: "short",
    });
  });

  it("gives uses to a feature the data says nothing about", () => {
    const smite = "srd51:feature/divine-smite";
    const sheet = paladin({ [smite]: { uses: 3 } });
    expect(sheet.resources.find((r) => r.entry === smite)).toBeUndefined();
  });

  it("changes the resource of the class table instead of making a second one", () => {
    const sheet = withSettings({ "srd51:feature/lay-on-hands": { uses: 3 } });
    const hands = sheet.resources.filter((r) => r.kind === "layOnHands");
    expect(hands).toHaveLength(1);
    // The id stays, so the points already spent are still counted.
    expect(hands[0]).toMatchObject({ id: "layOnHands:paladin", max: 3 });
    expect(sheet.resources.some((r) => r.id === "uses:srd51:feature/lay-on-hands")).toBe(false);
  });

  it("lists what is hidden, and ignores what the character does not have", () => {
    const sheet = paladin({
      [sense]: { hidden: true },
      "srd51:feature/rage": { hidden: true, uses: 5 },
    });
    expect(sheet.hiddenFeatures).toEqual([sense]);
    expect(sheet.resources.some((r) => r.entry === "srd51:feature/rage")).toBe(false);
    // Hiding it leaves its uses alone.
    expect(left(sheet)).toMatchObject({ max: 4 });
  });
});

describe("spells cast without a slot", () => {
  const free = (effects: { spell: string; minLevel?: number }[]) => {
    const pack = {
      manifest: { id: "t", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: [
        {
          id: "t:feat/gift",
          kind: "feat",
          effects: effects.map((e) => ({ type: "grantSpell", free: true, ...e })),
          data: {},
        },
      ],
    };
    return pack;
  };

  it("gives a resource for each spell a feat lets the character cast once", async () => {
    const { indexPacks } = await import("./derive");
    const { srd51Packs } = await import("../test/srd51");
    const idx = indexPacks(...srd51Packs, free([{ spell: "srd51:spell/misty-step" }]) as never);
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
    c.feats = ["t:feat/gift"];
    const sheet = deriveSheet(c, idx);
    const spell = sheet.resources.find((r) => r.spell === "srd51:spell/misty-step");
    expect(spell).toMatchObject({
      kind: "freeSpell",
      max: 1,
      recovery: "long",
      entry: "t:feat/gift",
    });

    // The person can change the uses of it or take it away, by the id of the resource.
    c.featureSettings = { [spell?.id ?? ""]: { uses: 2 } };
    expect(deriveSheet(c, idx).resources.find((r) => r.spell)?.max).toBe(2);
    c.featureSettings = { [spell?.id ?? ""]: { uses: 0 } };
    expect(deriveSheet(c, idx).resources.some((r) => r.spell)).toBe(false);
  });
});

describe("traits that come at a level", () => {
  it("gives a trait of a species only from its level, and one that depends on a choice with it", async () => {
    const { indexPacks } = await import("./derive");
    const { srd51Packs } = await import("../test/srd51");
    const pack = {
      manifest: { id: "t", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: [
        { id: "t:trait/glow", kind: "trait", effects: [], data: {} },
        { id: "t:trait/dusk", kind: "trait", effects: [], data: {} },
        { id: "t:trait/glow-dusk", kind: "trait", effects: [], data: {} },
        {
          id: "t:species/moonfolk",
          kind: "species",
          effects: [
            { type: "trait", id: "t:trait/glow", minLevel: 3 },
            { type: "choice", id: "season", choose: 1, grants: "trait", from: ["t:trait/dusk"] },
            {
              type: "when",
              requires: "t:trait/dusk",
              effects: [{ type: "trait", id: "t:trait/glow-dusk", minLevel: 3 }],
            },
          ],
          data: {},
        },
      ],
    };
    const idx = indexPacks(...srd51Packs, pack as never);
    const at = (level: number) => {
      const c = createCharacter("srd51");
      c.classes = [{ classId: "srd51:class/fighter", level }];
      c.choices.species = "t:species/moonfolk";
      c.selections = { "t:species/moonfolk/season": ["t:trait/dusk"] };
      return deriveSheet(c, idx).traits;
    };
    expect(at(2)).toEqual(expect.arrayContaining(["t:trait/dusk"]));
    expect(at(2)).not.toContain("t:trait/glow");
    expect(at(2)).not.toContain("t:trait/glow-dusk");
    expect(at(3)).toEqual(expect.arrayContaining(["t:trait/glow", "t:trait/glow-dusk"]));
  });
});

describe("the counters of one entry", () => {
  it("keeps every free spell a feat gives, not only the last", () => {
    const feat = "pack:feat/fey-touched";
    const free = (spell: string) => ({
      source: feat,
      effect: { type: "grantSpell" as const, spell, free: true },
    });
    const found = deriveFreeSpells(
      [free("srd51:spell/misty-step"), free("srd51:spell/bless")],
      () => 4,
    );
    expect(found.map((r) => r.id)).toEqual([
      `free:${feat}:srd51:spell/misty-step`,
      `free:${feat}:srd51:spell/bless`,
    ]);
    expect(resourcesByEntry(found).get(feat)).toHaveLength(2);
  });
});
