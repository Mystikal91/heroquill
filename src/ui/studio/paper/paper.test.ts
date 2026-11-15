// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../../../data/schema";
import { addEntry, addOwned, setText, updateEntry } from "../../../homebrew/entries";
import { newHomebrewPack } from "../../../homebrew/pack";
import type { UserPackRecord } from "../../../storage/packs";
import { type Words, docOf } from "./blocks";
import { entryMarkdown, monsterMarkdown, toHomebrewery } from "./homebrewery";
import { printable, scopeIds } from "./scope";

const words: Words = {
  name: (id) => id.split("/")[1] ?? id,
  word: (_kind, slug) => slug,
  effect: (e: Effect) => `effect ${e.type}`,
  kind: (e) => e.kind,
};

const pack = (): UserPackRecord => ({ ...newHomebrewPack("Mine", 1), id: "mine", name: "Mine" });
const textOf = (record: UserPackRecord) => (id: string, field: string) =>
  record.strings[`${id}.${field}`] ?? "";

function sample() {
  let record = pack();
  const glow: Entry = {
    id: "mine:spell/glow",
    kind: "spell",
    effects: [],
    data: {
      level: 1,
      school: "evocation",
      components: ["V", "M"],
      ritual: false,
      concentration: true,
      classes: [],
    },
  };
  record = addEntry(record, glow, {
    name: "Glow",
    desc: "A soft light.\n\nIt lasts.",
    castingTime: "1 action",
    range: "30 feet",
    duration: "1 hour",
    material: "a firefly",
    higherLevel: "More light.",
  });
  const sprite: Entry = {
    id: "mine:species/sprite",
    kind: "species",
    effects: [{ type: "abilityBonus", ability: "dex", value: 2 }],
    data: { speed: 30, size: "small" },
  };
  record = addEntry(record, sprite, { name: "Sprite", desc: "Tiny fey." });
  const added = addOwned(record, "mine:species/sprite", "trait");
  record = setText(
    setText(added.record, added.id, "name", "Glimmer"),
    added.id,
    "desc",
    "You shine.",
  );
  const tinker: Entry = {
    id: "mine:class/tinker",
    kind: "class",
    effects: [],
    data: {
      hitDie: 8,
      multiclassing: { prerequisites: [], proficiencies: [] },
      levels: [
        { level: 1, features: [], abilityScoreImprovements: 0 },
        { level: 2, features: [], abilityScoreImprovements: 0 },
      ],
    },
  };
  record = addEntry(record, tinker, { name: "Tinker" });
  const feature = addOwned(record, "mine:class/tinker", "feature", { level: 2 });
  record = setText(
    setText(feature.record, feature.id, "name", "Gadget"),
    feature.id,
    "desc",
    "You build.",
  );
  return record;
}

describe("the document of an entry", () => {
  it("describes a spell the way the rules page does", () => {
    const record = sample();
    const doc = docOf(record, record.pack.entries[0] as Entry, textOf(record), words);
    expect(doc.title).toBe("Glow");
    const facts = doc.blocks.find((b) => b.t === "facts");
    expect(facts && "rows" in facts && facts.rows.map(([l]) => l)).toEqual(
      expect.arrayContaining(["Casting time", "Range", "Components", "Duration"]),
    );
    expect(JSON.stringify(doc.blocks)).toContain("a firefly");
    expect(
      doc.blocks.filter((b) => b.t === "para").map((b) => (b as { text: string }).text),
    ).toEqual(["A soft light.", "It lasts.", "**At higher levels.** More light."]);
  });

  it("puts what a species owns inside it, and what it gives in a list", () => {
    const record = sample();
    const doc = docOf(record, record.pack.entries[1] as Entry, textOf(record), words);
    const text = JSON.stringify(doc.blocks);
    expect(text).toContain("**Glimmer.** You shine.");
    expect(text).toContain("effect abilityBonus");
    expect(text).not.toContain("effect trait");
  });

  it("makes a class table of its levels, with the features by level after it", () => {
    const record = sample();
    const entry = record.pack.entries.find((e) => e.kind === "class") as Entry;
    const doc = docOf(record, entry, textOf(record), words);
    const table = doc.blocks.find((b) => b.t === "table");
    expect(table && "rows" in table && table.rows).toEqual([
      ["1", "—"],
      ["2", "Gadget"],
    ]);
    expect(JSON.stringify(doc.blocks)).toContain("**Gadget.** You build.");
  });

  it("names an entry with no name", () => {
    const record = addEntry(pack(), {
      id: "mine:property/x",
      kind: "property",
      effects: [],
      data: {},
    });
    expect(
      docOf(record, record.pack.entries[0] as Entry, textOf(record), words).title,
    ).toBeTruthy();
  });
});

describe("what to print", () => {
  const record = sample();
  const groupOf = (e: Entry) => e.kind;

  it("leaves out what is written inside other entries", () => {
    expect(printable(record).map((e) => e.id)).toEqual([
      "mine:spell/glow",
      "mine:species/sprite",
      "mine:class/tinker",
    ]);
  });

  it("follows the scope", () => {
    const base = {
      selected: ["mine:spell/glow", "mine:class/tinker"],
      open: "mine:species/sprite",
      groupOf,
    };
    expect(scopeIds(record, "entry", base)).toEqual(["mine:species/sprite"]);
    expect(scopeIds(record, "selection", base)).toEqual(["mine:spell/glow", "mine:class/tinker"]);
    expect(scopeIds(record, "kind", { ...base, group: "spell" })).toEqual(["mine:spell/glow"]);
    expect(scopeIds(record, "pack", base)).toHaveLength(3);
  });
});

describe("the file for Homebrewery", () => {
  const record = sample();
  const docs = record.pack.entries
    .filter((e) => !["trait", "feature"].includes(e.kind))
    .map((e) => docOf(record, e, textOf(record), words));

  it("writes an entry as headings, bold facts and paragraphs", () => {
    const md = entryMarkdown(docs[0] as never);
    expect(md).toContain("### Glow");
    expect(md).toContain("*Level 1 evocation · Concentration*");
    expect(md).toContain("**Casting time:** 1 action");
    expect(md).toContain("A soft light.");
  });

  it("writes a table in Markdown", () => {
    const md = entryMarkdown(docs[2] as never);
    expect(md).toContain("| Level | Features |");
    expect(md).toContain("|:--|:--|");
    expect(md).toContain("| 2 | Gadget |");
  });

  it("puts a title page, then a page for each section", () => {
    const md = toHomebrewery(
      docs,
      { name: "Mine", author: "Ada", description: "A shelf." },
      { titlePage: true, sections: true },
    );
    const pages = md.split("\n\\page\n");
    expect(pages).toHaveLength(4);
    expect(pages[0]).toContain("# Mine");
    expect(pages[0]).toContain("*Ada*");
    expect(pages[1]).toContain("## spell");
    expect(
      toHomebrewery(docs, { name: "Mine" }, { titlePage: false, sections: false }),
    ).not.toContain("# Mine");
  });

  it("draws a creature in the frame of a stat block", () => {
    const monster: Entry = {
      id: "mine:monster/imp",
      kind: "monster",
      effects: [],
      data: {
        size: "tiny",
        type: "fiend",
        armorClass: [{ value: 13 }],
        hitPoints: 10,
        speed: { walk: 20 },
        abilities: { str: 6, dex: 17, con: 13, int: 11, wis: 12, cha: 14 },
        challenge: 1,
        actions: [{}],
      },
    };
    let r = addEntry(pack(), monster, {
      name: "Imp",
      "actions.1.name": "Sting",
      "actions.1.desc": "It stings.",
    });
    r = updateEntry(r, monster.id, {});
    const doc = docOf(r, monster, textOf(r), words);
    const md = monsterMarkdown(doc);
    expect(md.startsWith("___\n___\n> ## Imp")).toBe(true);
    expect(md).toContain(">- **Armor Class** 13");
    expect(md).toContain(">**Sting.** It stings.");
  });
});
