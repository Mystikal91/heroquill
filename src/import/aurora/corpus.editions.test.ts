// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { subclassData } from "../../data/progression";
import { brokenReferences, parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { SRD52_FILES, bothIndex, srd52Packs } from "../../test/srd52";
import { nameOf } from "./corpusSuite";
import { DIR, available, readElements } from "./corpusSuite";
import { type AuroraResult, parseAurora } from "./index";

/**
 * The 2024 SRD next to Aurora's content: the app loads both rulesets, and the importer looks up what the app
 * already has by name. A 2014 book read with both loaded must not end up with an entry that points to the 2024
 * SRD (a 2014 character cannot see it). One parse only: two in a worker run out of memory.
 */
const names52 = () => {
  const names = new Map<string, string>();
  for (const file of [...SRD52_FILES, "alignments"]) {
    const entries = (
      JSON.parse(readFileSync(`data/srd52/${file}.json`, "utf8")) as { entries: { id: string }[] }
    ).entries;
    const strings = JSON.parse(readFileSync(`locales/en/srd52/${file}.json`, "utf8")) as Record<
      string,
      string
    >;
    for (const e of entries) names.set(e.id, strings[`${e.id.split("/")[1]}.name`] ?? e.id);
  }
  return names;
};

describe.skipIf(!available)("Aurora's content with both SRD rulesets loaded", () => {
  let both = undefined as unknown as AuroraResult;
  beforeAll(() => {
    const only51 = nameOf();
    const extra = names52();
    // What the app does (`importAuroraPack`): the importer sees the 2014 SRD, never the 2024 one.
    const index = new Map([...bothIndex].filter(([id]) => !id.startsWith("srd52:")));
    both = parseAurora(readElements(DIR), {
      packId: "imp1",
      index,
      nameOf: (id) => extra.get(id) ?? only51(id),
    });
  }, 240_000);

  it("finds what the app already has among the 2014 SRD's entries, not the 2024 ones", () => {
    const to52 = Object.entries(both.existing).filter(([, id]) => id.startsWith("srd52:"));
    expect(to52.slice(0, 20)).toEqual([]);
  });

  it("lets a 2024 character use the pack: nothing throws, and what does not resolve is counted", () => {
    const pack = parsePack({
      manifest: { id: "imp1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: both.entries,
    });
    const idx = indexPacks(...srd52Packs, pack);
    const broken = brokenReferences([...srd52Packs, pack]);
    const byPrefix: Record<string, number> = {};
    const kindOf = new Map(both.entries.map((e) => [e.id, e.kind]));
    const fromKind: Record<string, number> = {};
    const refKind: Record<string, number> = {};
    for (const b of broken) {
      const key = b.ref.split(":")[0] ?? "?";
      byPrefix[key] = (byPrefix[key] ?? 0) + 1;
      const k = kindOf.get(b.from) ?? "?";
      fromKind[k] = (fromKind[k] ?? 0) + 1;
      const r = b.ref.split("/")[0] ?? "?";
      refKind[r] = (refKind[r] ?? 0) + 1;
    }
    // entries whose parent is a 2014 SRD entry: a subclass of the Fighter or a trait of the Elf has no owner in 2024
    const orphanKinds: Record<string, number> = {};
    for (const e of both.entries)
      if (e.parent?.startsWith("srd51:")) orphanKinds[e.kind] = (orphanKinds[e.kind] ?? 0) + 1;
    console.log("EDITION2024-DETAIL", JSON.stringify({ fromKind, refKind, orphanKinds }));
    const thrown: string[] = [];
    let sheets = 0;
    let warned = 0;
    for (const cls of both.entries.filter((e) => e.kind === "class")) {
      const c = createCharacter("srd52");
      c.choices.species = "srd52:species/human";
      c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
      c.classes = [{ classId: cls.id, level: 5 }];
      sheets++;
      try {
        if (deriveSheet(c, idx).warnings.length > 0) warned++;
      } catch (error) {
        thrown.push(`${cls.id}: ${(error as Error).message}`);
      }
    }
    // Every pack entry that refers to the 2014 SRD ("srd51:") cannot resolve in a 2024 character: how many.
    console.log(
      "EDITION2024",
      JSON.stringify({
        entries: both.entries.length,
        broken: broken.length,
        byPrefix,
        sheets,
        warned,
        thrown: thrown.slice(0, 5),
      }),
    );
    expect(thrown).toEqual([]);
  });

  it("measures a 2014 subclass of a book on the 2024 class of the same name", () => {
    const pack = parsePack({
      manifest: { id: "imp1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
      entries: both.entries,
    });
    const idx = indexPacks(...srd52Packs, pack);
    const subs = both.entries.filter(
      (e) => e.kind === "subclass" && e.parent?.startsWith("srd51:class/"),
    );
    const out = {
      subclasses: subs.length,
      tested: 0,
      noClass: 0,
      thrown: [] as string[],
      warned: [] as string[],
      missing: [] as string[],
    };
    for (const sub of subs) {
      const cls = `srd52:class/${sub.parent?.split("/")[1]}`;
      if (!idx.has(cls)) {
        out.noClass++;
        continue;
      }
      out.tested++;
      for (const level of [3, 5, 11, 20]) {
        const make = (subclassId?: string) => {
          const c = createCharacter("srd52");
          c.choices.species = "srd52:species/human";
          c.abilityBase = { str: 14, dex: 14, con: 14, int: 14, wis: 14, cha: 14 };
          c.classes = [{ classId: cls, level, ...(subclassId && { subclassId }) }];
          return deriveSheet(c, idx);
        };
        try {
          const base = make();
          const sheet = make(sub.id);
          if (sheet.warnings.length > base.warnings.length)
            out.warned.push(
              `${sub.id} L${level}: ${JSON.stringify(sheet.warnings.slice(base.warnings.length)).slice(0, 120)}`,
            );
          for (const l of subclassData(sub).levels)
            for (const f of l.features)
              if (l.level <= level && idx.has(f) && !sheet.features.includes(f))
                out.missing.push(`${sub.id} L${level}: ${f}`);
        } catch (error) {
          out.thrown.push(`${sub.id} L${level}: ${(error as Error).message}`);
        }
      }
    }
    // Every subclass of a book has a 2024 class of the same name, derives on it, gives its features and warns of nothing.
    expect(out.noClass).toBe(0);
    expect(out.tested).toBeGreaterThan(100);
    expect(out.thrown).toEqual([]);
    expect(out.warned.slice(0, 5)).toEqual([]);
    expect(out.missing.slice(0, 5)).toEqual([]);
  });

  it("writes no reference to the 2024 SRD into a pack of 2014 books", () => {
    const hits = both.entries.filter((e) => JSON.stringify(e).includes("srd52:"));
    expect(hits).toEqual([]);
  });
});
