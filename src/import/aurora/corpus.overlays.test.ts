// @vitest-environment happy-dom
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { applyOverlays } from "../../content/overlays";
import { createCharacter } from "../../engine/character";
import { type DerivedSheet, type PackIndex, deriveSheet } from "../../engine/derive";
import { SRD51_FILES, loadSrd51Strings, srd51Index } from "../../test/srd51";
import { parseAurora } from "./index";

/**
 * What Aurora adds to the SRD must only add: the sheets of characters made of the SRD come out the
 * same with it, apart from the numbers the features show. Runs on the books of Aurora's core
 * (`AURORA_CORPUS`, see CLAUDE.md); one parse, since two in one worker run out of memory.
 */
const root = process.env.AURORA_CORPUS;

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".xml") ? [p] : [];
  });

/** The subclass the SRD has for each class. */
const SUBCLASS: Record<string, string> = {
  barbarian: "berserker",
  bard: "lore",
  cleric: "life",
  druid: "land",
  fighter: "champion",
  monk: "open-hand",
  paladin: "devotion",
  ranger: "hunter",
  rogue: "thief",
  sorcerer: "draconic",
  warlock: "fiend",
  wizard: "evocation",
};
const LEVELS = [1, 3, 5, 9, 11, 17, 20];

describe.skipIf(!root)("what Aurora adds to the SRD", () => {
  let plain: PackIndex;
  let added: PackIndex;
  let overlays = 0;

  beforeAll(() => {
    const names = new Map<string, string>();
    for (const file of SRD51_FILES) {
      for (const [key, value] of Object.entries(loadSrd51Strings(file))) {
        if (!key.endsWith(".name")) continue;
        const slug = key.slice(0, -5);
        for (const id of srd51Index.keys()) if (id.endsWith(`/${slug}`)) names.set(id, value);
      }
    }
    const texts = walk(join(root as string, "core"))
      .sort()
      .map((f) => readFileSync(f, "utf8"));
    const result = parseAurora(texts, {
      packId: "p",
      index: srd51Index,
      nameOf: (id) => names.get(id) ?? id,
    });
    plain = new Map(srd51Index);
    added = new Map(srd51Index);
    applyOverlays(added, result.overlays);
    overlays = Object.keys(result.overlays).length;
  });

  const sheet = (index: PackIndex, cls: string, level: number) => {
    const c = createCharacter("srd51");
    c.classes = [
      {
        classId: `srd51:class/${cls}`,
        level,
        ...(level >= 3 && { subclassId: `srd51:subclass/${SUBCLASS[cls]}` }),
      },
    ];
    c.abilityBase = { str: 15, dex: 14, con: 14, int: 12, wis: 13, cha: 10 };
    return deriveSheet(c, index);
  };

  it("gives something to add to", () => {
    expect(overlays).toBeGreaterThan(10);
  });

  it("changes nothing of a character but the numbers, the uses and the proficiencies the book adds", () => {
    const changed = new Set<string>();
    for (const cls of Object.keys(SUBCLASS))
      for (const level of LEVELS) {
        const a = sheet(plain, cls, level) as unknown as Record<string, unknown>;
        const b = sheet(added, cls, level) as unknown as Record<string, unknown>;
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
          if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) changed.add(key);
      }
    expect([...changed].sort()).toEqual(["featureValues", "proficiencies", "resources"]);
  });

  it("adds what the SRD entry lacks, and never takes away a use or a proficiency", () => {
    const lost: string[] = [];
    for (const cls of Object.keys(SUBCLASS))
      for (const level of LEVELS) {
        const a = sheet(plain, cls, level);
        const b = sheet(added, cls, level);
        for (const r of a.resources)
          if (!b.resources.some((s) => s.id === r.id && s.max === r.max))
            lost.push(`${cls} ${level} ${r.id}`);
        for (const [kind, list] of Object.entries(a.proficiencies))
          for (const p of list as string[])
            if (!(b.proficiencies as Record<string, string[]>)[kind]?.includes(p))
              lost.push(`${cls} ${level} ${kind}:${p}`);
      }
    expect(lost).toEqual([]);
    const uses = (cls: string, level: number, feature: string) =>
      sheet(added, cls, level).resources.filter(
        (r) => r.entry === `srd51:feature/${feature}` || r.id.includes(feature),
      );
    // The language a class feature teaches, which the SRD says in words only.
    expect(sheet(added, "druid", 1).proficiencies.language).toContain("druidic");
    expect(sheet(plain, "druid", 1).proficiencies.language).not.toContain("druidic");
    expect(sheet(added, "rogue", 1).proficiencies.language).toContain("thieves-cant");
    // Once between long rests, as the book has it.
    expect(uses("warlock", 20, "eldritch-master").map((r) => [r.max, r.recovery])).toEqual([
      [1, "long"],
    ]);
    expect(uses("paladin", 20, "holy-nimbus").map((r) => [r.max, r.recovery])).toEqual([
      [1, "long"],
    ]);
    // Lay on Hands keeps the one pool of the class table; Signature Spells keep their free casts.
    expect(uses("paladin", 5, "lay-on-hands")).toHaveLength(0);
    expect(
      sheet(added, "paladin", 5).resources.filter((r) => r.id.startsWith("layOnHands")),
    ).toHaveLength(1);
    expect(uses("wizard", 20, "signature-spell")).toHaveLength(0);
  });

  it("only adds numbers: the ones a feature already showed stay as they were", () => {
    const rewritten: string[] = [];
    for (const cls of Object.keys(SUBCLASS))
      for (const level of LEVELS) {
        const a: DerivedSheet["featureValues"] = sheet(plain, cls, level).featureValues;
        const b: DerivedSheet["featureValues"] = sheet(added, cls, level).featureValues;
        for (const [id, values] of Object.entries(a))
          for (const v of values)
            if (!b[id]?.some((w) => w.name === v.name && w.value === v.value))
              rewritten.push(`${cls} ${level} ${id} ${v.name}`);
      }
    expect(rewritten).toEqual([]);
  });

  it("works out the numbers at the level of the character", () => {
    const value = (cls: string, level: number, id: string, name: string) =>
      sheet(added, cls, level).featureValues[`srd51:feature/${id}`]?.find((v) => v.name === name)
        ?.value;
    // Steps that add up: 2 rages, then 1 more at the 3rd, 6th, 12th and 17th levels.
    expect(value("barbarian", 1, "rage", "barbarian rage:count")).toBe("2");
    expect(value("barbarian", 5, "rage", "barbarian rage:count")).toBe("3");
    expect(value("barbarian", 17, "rage", "barbarian rage:count")).toBe("6");
    // A DC: 8 + proficiency + Wisdom (13: +1).
    expect(value("monk", 11, "tranquility", "tranquility:dc")).toBe("13");
    // A kind of bonus that does not stack: the aura is 10 feet, then 30 at the 18th level.
    expect(value("paladin", 17, "aura-of-protection", "aura of protection:range")).toBe("10");
    expect(value("paladin", 20, "aura-of-protection", "aura of protection:range")).toBe("30");
    // The aura Aurora writes wrong is not taken.
    expect(value("paladin", 20, "aura-of-devotion", "aura of devotion:range")).toBeUndefined();
  });
});
