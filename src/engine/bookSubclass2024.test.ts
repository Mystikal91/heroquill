import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { ownedBy } from "./rulesets";
import { subclassDataOn, subclassLevel } from "./subclass";

/** A 2014 subclass of a book (`srd51:class/...` is its class) with one feature, gained at the 3rd level. */
function book(slug: string, effects: Effect[], gainedAt = 3) {
  const cls = `srd51:class/${slug}`;
  const feature: Entry = {
    id: `book:feature/${slug}`,
    kind: "feature",
    effects,
    data: { class: cls },
  };
  const sub: Entry = {
    id: `book:subclass/${slug}`,
    kind: "subclass",
    parent: cls,
    effects: [],
    data: {
      levels: [{ level: gainedAt, features: [feature.id] }],
      spells: [{ spell: "srd51:spell/bless", classLevel: gainedAt }],
    },
  };
  return [feature, sub];
}

function sheet(
  edition: "srd51" | "srd52",
  classes: [slug: string, level: number, subclass?: boolean][],
  entries: Entry[],
) {
  const c = createCharacter(edition);
  c.choices.species = `${edition}:species/human`;
  c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
  c.classes = classes.map(([slug, level, subclass]) => ({
    classId: `${edition}:class/${slug}`,
    level,
    ...(subclass && { subclassId: `book:subclass/${slug}` }),
  }));
  return deriveSheet(c, new Map([...bothIndex, ...entries.map((e) => [e.id, e] as const)]));
}

describe("a 2014 subclass of a book on the 2024 class", () => {
  it("gives the effects of its features, from their level", () => {
    const entries = book("cleric", [
      { type: "grantSpell", spell: "srd51:spell/guidance" },
      { type: "grantSpell", spell: "srd51:spell/fireball", minLevel: 5 },
    ]);
    const granted = (level: number) =>
      sheet("srd52", [["cleric", level, true]], entries).grantedSpells;
    expect(granted(2)).toEqual([]);
    expect(granted(3)).toEqual(["srd52:spell/guidance"]);
    // The levels that count are the cleric's, not the character's.
    expect(granted(5)).toContain("srd52:spell/fireball");
    expect(
      sheet(
        "srd52",
        [
          ["cleric", 4, true],
          ["wizard", 5],
        ],
        entries,
      ).grantedSpells,
    ).not.toContain("srd52:spell/fireball");
  });

  it("gives at the 3rd level what the 2014 class had before it, as the 2024 rules do", () => {
    const entries = book("cleric", [{ type: "grantSpell", spell: "srd51:spell/guidance" }], 1);
    const at = (edition: "srd51" | "srd52", level: number) => {
      const s = sheet(edition, [["cleric", level, true]], entries);
      return [
        s.features.includes("book:feature/cleric"),
        s.grantedSpells.includes(`${edition}:spell/guidance`),
        s.spellcasters[0]?.lists.alwaysPrepared.includes(`${edition}:spell/bless`),
      ];
    };
    expect(at("srd51", 1)).toEqual([true, true, true]);
    expect(at("srd52", 1)).toEqual([false, false, false]);
    expect(at("srd52", 2)).toEqual([false, false, false]);
    expect(at("srd52", 3)).toEqual([true, true, true]);
    const index = new Map([...bothIndex, ...entries.map((e) => [e.id, e] as const)]);
    expect(subclassLevel("srd51:class/cleric", index)).toBe(1);
    expect(subclassLevel("srd52:class/cleric", index)).toBe(3);
  });

  it("keeps the order of the early levels, and the list of a patron waits with them", () => {
    const entries = book("warlock", [], 1);
    const sub = entries[1] as Entry;
    const rows = [1, 2, 3, 3, 6].map((level, i) => ({ level, features: [`book:feature/f${i}`] }));
    sub.data = { ...sub.data, levels: rows, expanded: ["srd51:spell/shield"] };
    expect(subclassDataOn(sub, "srd51:class/warlock").levels).toEqual(rows);
    expect(subclassDataOn(sub, "srd52:class/warlock").levels).toEqual([
      { level: 3, features: rows.slice(0, 4).flatMap((r) => r.features) },
      { level: 6, features: ["book:feature/f4"] },
    ]);
    const pool = (level: number) =>
      JSON.stringify(sheet("srd52", [["warlock", level, true]], entries).spellcasters[0]?.lists);
    expect(pool(2)).not.toContain("srd52:spell/shield");
    expect(pool(3)).toContain("srd52:spell/shield");
  });

  it("counts the levels of the class for hit points, and its table", () => {
    const entries = book("barbarian", [
      { type: "modifier", target: "hpPerLevel", value: 1 },
      { type: "featureValue", name: "rages", term: { table: "rageCount" } },
    ]);
    const made = (subclass: boolean) =>
      sheet(
        "srd52",
        [
          ["barbarian", 4, subclass],
          ["wizard", 2],
        ],
        entries,
      );
    expect(made(true).hitPoints.max - made(false).hitPoints.max).toBe(4);
    expect(JSON.stringify(made(true).featureValues["book:feature/barbarian"])).toContain("3");
  });

  it("spends the Focus Points of a 2024 monk where the book says ki", () => {
    const entries = book("monk", [{ type: "spends", pool: "ki", cost: 2 }]);
    expect(sheet("srd52", [["monk", 5, true]], entries).spends["book:feature/monk"]).toMatchObject({
      pool: "focus",
      cost: 2,
      resource: "focus:monk",
    });
    expect(sheet("srd51", [["monk", 5, true]], entries).spends["book:feature/monk"]).toMatchObject({
      pool: "ki",
      resource: "ki:monk",
    });
  });

  it("spends the Channel Divinity of its own class, with two of them", () => {
    const entries = book("paladin", [{ type: "spends", pool: "channelDivinity" }]);
    const spends = sheet(
      "srd52",
      [
        ["cleric", 5],
        ["paladin", 5, true],
      ],
      entries,
    ).spends;
    expect(spends["book:feature/paladin"]?.resource).toBe("channelDivinity:paladin");
  });

  it("knows the class of an entry by the name, from 2014 to 2024 only", () => {
    expect(ownedBy("srd51:class/monk", "srd52:class/monk")).toBe(true);
    expect(ownedBy("srd52:class/monk", "srd51:class/monk")).toBe(false);
    expect(ownedBy("srd51:class/monk", "srd52:class/rogue")).toBe(false);
    expect(ownedBy(undefined, "srd52:class/monk")).toBe(false);
  });
});
