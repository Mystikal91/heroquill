import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Entry, type Pack, findBrokenReferences, parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { SRD51_FILES, loadSrd51Strings, srd51Index, srd51Packs } from "../../test/srd51";
import { type AuroraResult, parseAurora } from "./index";
import { NATURAL_WEAPONS } from "./naturalWeapons";
import { type Outcomes, measure, ruleReport, toFile, worse } from "./ratchet";

/**
 * The importer against the whole of Aurora's content, kept at a fixed commit (see the workflow).
 * Without `AURORA_CORPUS` (a folder with a copy of the elements) the tests are skipped, so the
 * ordinary `npm test` stays offline; `npm run test:corpus` runs them.
 */
export const DIR = process.env.AURORA_CORPUS ?? "";

function collect(dir: string, found: string[] = []): string[] {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name.startsWith(".")) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) collect(path, found);
    else if (/\.xml$|_xml$/.test(item.name)) found.push(path);
  }
  return found;
}

/** Core and supplements are what the app offers to import; the other folders are left out. */
export function readElements(dir: string, folders = ["core", "supplements"]): string[] {
  const parts = folders.map((n) => join(dir, n)).filter((p) => existsSync(p));
  return (parts.length > 0 ? parts : [dir])
    .flatMap((p) => collect(p))
    .map((path) => readFileSync(path, "utf8").replace(/^﻿/, ""))
    .filter((text) => {
      const doc = new DOMParser().parseFromString(text, "text/xml");
      return (
        doc.getElementsByTagName("parsererror").length === 0 &&
        doc.documentElement?.tagName === "elements"
      );
    });
}

export function nameOf() {
  const names = new Map<string, string>();
  const loaded = SRD51_FILES.map(loadSrd51Strings);
  for (const [id, entry] of srd51Index) {
    const key = `${id.split("/")[1]}.name`;
    names.set(id, loaded.find((s) => s[key])?.[key] ?? entry.id);
  }
  return (id: string) => names.get(id) ?? id;
}

export const available = Boolean(DIR) && existsSync(DIR);

/**
 * The content is read in the order it is listed or in reverse (a file of its own for each, so
 * that only one reading is in memory): which of two races that are the same one of the app
 * comes first must not matter.
 */
export function corpusSuite(reverse: boolean) {
  describe.skipIf(!available)(
    `the whole of Aurora's content, ${reverse ? "in reverse order" : "as listed"}`,
    () => {
      const listed = available ? readElements(DIR) : [];
      const files = reverse ? [...listed].reverse() : listed;
      let result = undefined as unknown as AuroraResult;
      let pack = undefined as unknown as Pack;
      let index = new Map<string, Entry>();
      let subs: Entry[] = [];
      beforeAll(() => {
        result = parseAurora(files, { packId: "imp1", index: srd51Index, nameOf: nameOf() });
        pack = parsePack({
          manifest: { id: "imp1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
          entries: result.entries,
        });
        index = indexPacks(...srd51Packs, pack);
        subs = result.entries.filter((e) => e.kind === "subspecies");
      }, 120_000);
      afterAll(() => {
        result = undefined as unknown as AuroraResult;
        pack = undefined as unknown as Pack;
        index = new Map();
        subs = [];
      });

      /** The ability bonuses a sub-species gives with its species, as `{ str: 0, ... }`. */
      const bonuses = (sub: Entry) => {
        const c = createCharacter("srd51");
        c.choices.species = sub.parent ?? "";
        c.choices.subspecies = sub.id;
        const sheet = deriveSheet(c, index);
        return Object.fromEntries(Object.entries(sheet.abilities).map(([k, a]) => [k, a.bonus]));
      };
      const one = (id: string) => {
        const sub = subs.find((e) => e.id === id);
        if (!sub) throw new Error(`missing ${id}`);
        return bonuses(sub);
      };
      it("reads every file into a pack that passes the schema", () => {
        expect(files.length).toBeGreaterThan(500);
        expect(result.entries.length).toBeGreaterThan(4500);
        // Rules that depend on other rules stay in the pack and are checked with the sheet.
        const whens = JSON.stringify(result.entries).match(/"type":"when"/g) ?? [];
        expect(whens.length).toBeGreaterThan(300);
      });

      it("reads the companions of the books as creatures with their traits and actions", () => {
        const monsters = result.entries.filter((e) => e.kind === "monster");
        // 164 companions in the files: the app has many of them already (the SRD beasts), and the
        // 2024 books repeat 2014 ones, which stay.
        expect(monsters.length).toBeGreaterThan(30);
        for (const m of monsters) {
          expect(result.strings[`${m.id}.name`], m.id).toBeTruthy();
          expect(m.data.abilities, m.id).toBeDefined();
        }
        // Every action that a companion lists is read: a companion with actions has their texts.
        const withActions = monsters.filter((m) => Array.isArray(m.data.actions));
        expect(withActions.length).toBeGreaterThan(20);
        for (const m of withActions)
          expect(result.strings[`${m.id}.actions.1.name`], m.id).toBeTruthy();
        // A companion that scales with the proficiency bonus keeps its formula as written.
        const scaling = monsters.filter((m) => result.strings[`${m.id}.armorClass`]);
        expect(scaling.length).toBeGreaterThan(5);
        // ...and the numbers of its formulas are kept, for the one who has it.
        const worked = monsters.filter(
          (m) => (m.data.scaling as { hitPoints?: unknown })?.hitPoints,
        );
        expect(worked.length).toBeGreaterThan(5);
        const rangersBeast = monsters.find(
          (m) => result.strings[`${m.id}.name`] === "Beast of the Land",
        );
        expect(rangersBeast?.data.scaling).toMatchObject({
          hitPoints: { class: "ranger", perLevel: 5 },
        });
        expect(result.skipped.Companion).toBeUndefined();
      });

      it("turns no element into less than it did when the baseline was taken", () => {
        // AURORA_REPORT=<file> also writes what became of the rules, by kind (see `ruleReport`).
        if (process.env.AURORA_REPORT && !reverse)
          writeFileSync(process.env.AURORA_REPORT, ruleReport(result.ruleKinds));
        const baselinePath = join(import.meta.dirname, "corpus.baseline.json");
        const current = measure(result.entries, result.aids, result.unsupportedBy);
        // AURORA_ACCEPT=1 takes the present result as the baseline (after a change that was meant).
        if (process.env.AURORA_ACCEPT && !reverse) writeFileSync(baselinePath, toFile(current));
        const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Outcomes;
        expect(Object.keys(baseline).length).toBeGreaterThan(3000);
        expect(worse(baseline, current).slice(0, 40)).toEqual([]);
      });

      it("lets a species of Monsters of the Multiverse take its free increase as +2 and +1, or +1 three times", () => {
        const species = result.aids.ID_WOTC_MOTM_RACE_FIRBOLG ?? "";
        const plusTwo = result.aids.ID_WOTC_ASI_ABILITY_SCORE_IMPROVEMENT_OPTION_1 ?? "";
        const plusOnes = result.aids.ID_WOTC_ASI_ABILITY_SCORE_IMPROVEMENT_OPTION_2 ?? "";
        expect(index.has(species), `species ${species}`).toBe(true);
        expect(index.has(plusTwo), `option 1 ${plusTwo}`).toBe(true);
        expect(index.has(plusOnes), `option 2 ${plusOnes}`).toBe(true);
        const sheetOf = (selections: Record<string, string[]>) => {
          const c = createCharacter("srd51");
          c.choices.species = species;
          c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
          c.selections = selections;
          return deriveSheet(c, index);
        };
        const bonuses = (s: ReturnType<typeof sheetOf>) =>
          Object.fromEntries(Object.entries(s.abilities).map(([k, a]) => [k, a.bonus]));

        const open = sheetOf({});
        const offer = open.choices.find((p) => p.options.includes(plusTwo));
        expect(offer?.options.sort()).toEqual([plusTwo, plusOnes].sort());
        expect(Object.values(bonuses(open)).every((n) => n === 0)).toBe(true);

        const split = sheetOf({
          [`${species}/species-offer-1`]: [plusTwo],
          [`${plusTwo}/trait-1`]: ["str"],
          [`${plusTwo}/trait-2`]: ["dex"],
        });
        expect(bonuses(split)).toMatchObject({ str: 2, dex: 1, con: 0 });

        const spread = sheetOf({
          [`${species}/species-offer-1`]: [plusOnes],
          [`${plusOnes}/trait-1`]: ["str", "dex", "con"],
        });
        expect(bonuses(spread)).toMatchObject({ str: 1, dex: 1, con: 1, wis: 0 });
      });

      it("works out the armor class of the natural armor of Monsters of the Multiverse", () => {
        const armorClass = (aid: string) => {
          const c = createCharacter("srd51");
          c.choices.species = result.aids[aid] ?? "";
          c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
          c.abilityBase = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
          return deriveSheet(c, index).armorClass.value;
        };
        // 13 and Dexterity (+2), and 17 whatever the Dexterity is.
        expect(armorClass("ID_WOTC_MOTM_RACE_LIZARDFOLK")).toBe(15);
        expect(armorClass("ID_WOTC_MOTM_RACE_TORTLE")).toBe(17);
        expect(armorClass("ID_WOTC_MOTM_RACE_FIRBOLG")).toBe(12);
      });

      it("finds every natural weapon of the table in the books, with its unarmed strike", () => {
        const missing = Object.keys(NATURAL_WEAPONS).filter((aid) => {
          const entry = result.entries.find((e) => e.id === result.aids[aid]);
          return !entry?.effects.some((e) => e.type === "unarmedStrike");
        });
        expect(missing).toEqual([]);
      });

      it("points only at entries that exist", () => {
        expect(findBrokenReferences([pack, ...srd51Packs])).toEqual([]);
      });

      it("gives no sub-species more fixed ability increases than the books do", () => {
        const heavy = subs
          .map((s) => ({
            id: s.id,
            total: Object.values(bonuses(s)).reduce((sum, n) => sum + Math.max(0, n), 0),
          }))
          .filter((s) => s.total > 4);
        expect(heavy).toEqual([]);
      });

      it("gives the Tiefling bloodlines Charisma +2 and their own increase, once", () => {
        const line = (id: string) => one(`imp1:subspecies/tiefling-${id}`);
        expect(line("asmodeus")).toMatchObject({ int: 1, cha: 2 });
        expect(line("baalzebub")).toMatchObject({ int: 1, cha: 2 });
        expect(line("dispater")).toMatchObject({ dex: 1, int: 0, cha: 2 });
        expect(line("fierna")).toMatchObject({ wis: 1, int: 0, cha: 2 });
        expect(line("glasya")).toMatchObject({ dex: 1, int: 0, cha: 2 });
        expect(line("levistus")).toMatchObject({ con: 1, int: 0, cha: 2 });
        expect(line("mammon")).toMatchObject({ int: 1, cha: 2 });
        expect(line("mephistopheles")).toMatchObject({ int: 1, cha: 2 });
        expect(line("zariel")).toMatchObject({ str: 1, int: 0, cha: 2 });
        expect(one("imp1:subspecies/feral-tiefling")).toMatchObject({ dex: 2, int: 1, cha: 0 });
      });

      it("gives the half-elf descents only the Charisma increase", () => {
        for (const id of ["wood-elf", "moon-elf", "sun-elf", "drow"])
          expect(one(`imp1:subspecies/${id}-descent`)).toMatchObject({ cha: 2, str: 0, dex: 0 });
      });

      it("gives the aasimar their own increases", () => {
        expect(one("imp1:subspecies/protector-aasimar")).toMatchObject({ wis: 1, cha: 2 });
        expect(one("imp1:subspecies/scourge-aasimar")).toMatchObject({ con: 1, cha: 2 });
        expect(one("imp1:subspecies/fallen-aasimar")).toMatchObject({ str: 1, cha: 2 });
      });

      it("lets Tasha's customised origin swap the fixed increases for choices", () => {
        const option = result.entries.find(
          (e) => e.id === "imp1:option/customized-ability-score-increases",
        );
        expect(option).toBeDefined();
        const make = (species: string, on: boolean) => {
          const c = createCharacter("srd51");
          c.choices.species = species;
          c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
          if (on) c.options = [option?.id ?? ""];
          return deriveSheet(c, index);
        };
        const fixed = (s: ReturnType<typeof make>) =>
          Object.values(s.abilities).reduce((sum, a) => sum + Math.max(0, a.bonus), 0);
        // Whatever a species gives as fixed increases comes back as picks to make (at least).
        let swapped = 0;
        for (const species of result.entries.filter((e) => e.kind === "species")) {
          const plain = make(species.id, false);
          const custom = make(species.id, true);
          if (fixed(custom) >= fixed(plain)) continue;
          swapped += 1;
          const picks = custom.choices
            .filter((p) => p.grants === "abilityBonus")
            .reduce((sum, p) => sum + (p.value ?? 1) * p.choose, 0);
          expect(fixed(custom) + picks, species.id).toBeGreaterThanOrEqual(fixed(plain));
        }
        expect(swapped).toBeGreaterThan(20);
      });

      it("derives every sub-species without trouble", () => {
        for (const sub of subs) expect(() => bonuses(sub)).not.toThrow();
      });
    },
    120_000,
  );
}

/**
 * Core and supplements imported one after the other, as people do from the two indexes: the races
 * of the app (the Tiefling) are not among the files that bring their sub-races.
 */
export function splitSuite() {
  describe.skipIf(!available)("Aurora's core and supplements imported apart", () => {
    let index = new Map<string, Entry>();
    let aids: Record<string, string> = {};
    beforeAll(() => {
      const names = nameOf();
      const core = parseAurora(readElements(DIR, ["core"]), {
        packId: "imp1",
        index: srd51Index,
        nameOf: names,
      });
      const more = parseAurora(readElements(DIR, ["supplements"]), {
        packId: "imp2",
        index: srd51Index,
        nameOf: names,
      });
      const make = (id: string, entries: Entry[]) =>
        parsePack({
          manifest: { id, ruleset: "custom", version: "1", license: "x", attribution: "x" },
          entries,
        });
      index = indexPacks(...srd51Packs, make("imp1", core.entries), make("imp2", more.entries));
      aids = more.aids;
    }, 120_000);
    afterAll(() => {
      index = new Map();
      aids = {};
    });

    const sheet = (species: string, sub?: string, options: string[] = [], level = 1) => {
      const c = createCharacter("srd51");
      c.choices.species = species;
      if (sub) c.choices.subspecies = sub;
      if (options.length > 0) c.options = options;
      c.classes = [{ classId: "srd51:class/fighter", level }];
      return deriveSheet(c, index);
    };
    const bonus = (s: ReturnType<typeof sheet>) =>
      Object.fromEntries(Object.entries(s.abilities).map(([k, a]) => [k, a.bonus]));

    it("gives a bloodline of the Tiefling of the app its own increase, once", () => {
      const line = (id: string) =>
        bonus(sheet("srd51:species/tiefling", `imp2:subspecies/tiefling-${id}`));
      expect(line("asmodeus")).toMatchObject({ int: 1, cha: 2 });
      expect(line("dispater")).toMatchObject({ dex: 1, int: 0, cha: 2 });
      expect(line("fierna")).toMatchObject({ wis: 1, int: 0, cha: 2 });
      expect(line("zariel")).toMatchObject({ str: 1, int: 0, cha: 2 });
      expect(bonus(sheet("srd51:species/tiefling"))).toMatchObject({ int: 1, cha: 2 });
    });

    it("offers the free ability increase to a species of a book imported on its own", () => {
      // The ways of taking it are in the core files, which this import does not have.
      const shifter = aids.ID_WOTC_MOTM_RACE_SHIFTER ?? "";
      expect(index.has(shifter)).toBe(true);
      const offer = sheet(shifter).choices.find((p) => p.key === `${shifter}/species-offer-1`);
      expect(offer?.options).toHaveLength(2);
      const way = offer?.options[0] ?? "";
      const taken = sheet(shifter, undefined, []);
      expect(taken.choices.some((p) => p.remaining > 0 && p.grants === "trait")).toBe(true);
      const c = createCharacter("srd51");
      c.choices.species = shifter;
      c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
      c.selections = {
        [`${shifter}/species-offer-1`]: [way],
        [`${way}/trait-1`]: ["str"],
        [`${way}/trait-2`]: ["dex"],
      };
      const bonuses = Object.fromEntries(
        Object.entries(deriveSheet(c, index).abilities).map(([k, a]) => [k, a.bonus]),
      );
      expect(bonuses).toMatchObject({ str: 2, dex: 1 });
    });

    it("keeps the legacy of the Tiefling only for the Tiefling without a bloodline", () => {
      const traits = (sub?: string) => sheet("srd51:species/tiefling", sub).traits;
      expect(traits()).toContain("srd51:trait/infernal-legacy");
      expect(traits("imp2:subspecies/tiefling-dispater")).not.toContain(
        "srd51:trait/infernal-legacy",
      );
    });

    it("gives the spells of the legacy of a bloodline, each from its level", () => {
      const spells = (level: number) =>
        sheet("srd51:species/tiefling", "imp2:subspecies/tiefling-dispater", [], level)
          .grantedSpells;
      expect(spells(1)).toEqual(["srd51:spell/thaumaturgy"]);
      expect(spells(3)).toContain("srd51:spell/disguise-self");
      expect(spells(5)).toContain("srd51:spell/detect-thoughts");
    });

    it("lets Tasha's customised origin swap the increases of a race of the app", () => {
      const option = [...index.keys()].find((id) => /^imp2:option\/customized-ability/.test(id));
      expect(option).toBeDefined();
      const plain = sheet("srd51:species/dwarf");
      expect(plain.abilities.con.bonus).toBe(2);
      const custom = sheet("srd51:species/dwarf", undefined, [option ?? ""]);
      expect(custom.abilities.con.bonus).toBe(0);
      const picks = custom.choices.filter((p) => p.grants === "abilityBonus");
      expect(picks.map((p) => p.value).sort()).toEqual([1, 2]);
    });
  });
}

/**
 * What the entries refer to that the files do not define. Reading all of Aurora's content leaves
 * nothing beyond the ids of `UNDEFINED_IDS` (which not even the whole defines), so what a smaller
 * set leaves is a dependency on books that were not read with it. If a new book of Aurora adds an
 * id of its own that nothing defines, the list grows here.
 */
export function unresolvedSuite() {
  describe.skipIf(!available)(
    "what the content of Aurora refers to that it does not define",
    () => {
      const parse = (folders: string[]) =>
        parseAurora(readElements(DIR, folders), {
          packId: "imp1",
          index: srd51Index,
          nameOf: nameOf(),
        });

      // Reading all of it takes more memory than the default of Node: run it with AURORA_FULL=1 and
      // NODE_OPTIONS=--max-old-space-size=12000 when the books of Aurora change.
      it.skipIf(!process.env.AURORA_FULL)(
        "leaves nothing unresolved when all of it is read, beyond the known ids",
        () => {
          const result = parse(["core", "supplements", "unearthed-arcana", "collaborations"]);
          const left = Object.entries(result.unresolved).map(
            ([id, aids]) => `${result.strings[`${id}.name`] ?? id}: ${aids.join(" ")}`,
          );
          expect(left).toEqual([]);
        },
        300_000,
      );

      it.skipIf(!process.env.AURORA_FULL)(
        "is complete with the core and the supplements together, without Unearthed Arcana",
        () => {
          const result = parse(["core", "supplements"]);
          const left = Object.entries(result.unresolved).map(
            ([id, aids]) => `${result.strings[`${id}.name`] ?? id}: ${aids.join(" ")}`,
          );
          expect(left).toEqual([]);
        },
        300_000,
      );

      it("finds what the core refers to in the supplements when it is read alone", () => {
        const result = parse(["core"]);
        const missing = new Set(Object.values(result.unresolved).flat());
        expect(missing.has("ID_WOTC_TCOE_OPTION_CUSTOMIZED_ASI")).toBe(true);
      }, 300_000);
    },
  );
}
