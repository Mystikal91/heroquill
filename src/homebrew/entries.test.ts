import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import type { UserPackRecord } from "../storage/packs";
import {
  EntryError,
  addEntry,
  deleteEntry,
  entryProblems,
  newEntryId,
  ownedEntries,
  setText,
  updateEntry,
} from "./entries";
import { newHomebrewPack } from "./pack";

const pack = (): UserPackRecord => ({
  ...newHomebrewPack("Mine", 1),
  id: "mine",
  pack: {
    manifest: { id: "mine", ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [],
  },
});

const species = (): Entry => ({
  id: "mine:species/sprite",
  kind: "species",
  effects: [
    { type: "abilityBonus", ability: "dex", value: 2 },
    { type: "trait", id: "mine:trait/sprite-glow" },
    { type: "trait", id: "srd51:trait/darkvision" },
  ],
  data: { speed: 30, size: "small" },
});
const trait = (): Entry => ({ id: "mine:trait/sprite-glow", kind: "trait", effects: [], data: {} });

function filled() {
  let record = pack();
  record = addEntry(record, species(), { name: "Sprite" });
  record = addEntry(record, trait(), { name: "Glow", desc: "You shed light." });
  return record;
}

describe("entries worked on directly", () => {
  it("adds an entry with its texts and refuses a stranger's id or a repeat", () => {
    const record = filled();
    expect(record.pack.entries).toHaveLength(2);
    expect(record.strings["mine:species/sprite.name"]).toBe("Sprite");
    expect(() => addEntry(record, species())).toThrow(EntryError);
    expect(() => addEntry(record, { ...species(), id: "other:species/x" })).toThrow(EntryError);
  });

  it("makes ids from names, unique within the pack", () => {
    const record = filled();
    expect(newEntryId(record, "species", "Sprite")).toBe("mine:species/sprite-2");
    expect(newEntryId(record, "spell", "Fire Ball!")).toBe("mine:spell/fire-ball");
    expect(newEntryId(record, "spell", "!!!")).toBe("mine:spell/spell");
  });

  it("changes effects and data without touching the rest", () => {
    const record = filled();
    const changed = updateEntry(record, "mine:species/sprite", {
      effects: [{ type: "movement", mode: "fly", feet: 30 }],
      data: { size: "tiny", extra: undefined },
    });
    const entry = changed.pack.entries.find((e) => e.id === "mine:species/sprite");
    expect(entry?.effects).toEqual([{ type: "movement", mode: "fly", feet: 30 }]);
    expect(entry?.data).toEqual({ speed: 30, size: "tiny" });
    // The other entry is the same object: nothing was rebuilt.
    expect(changed.pack.entries[1]).toBe(record.pack.entries[1]);
  });

  it("keeps data the editor does not know when something else changes", () => {
    let record = addEntry(pack(), {
      ...species(),
      data: { speed: 30, size: "small", mystery: { a: 1 } },
    });
    record = updateEntry(record, "mine:species/sprite", { data: { speed: 35 } });
    expect(record.pack.entries[0]?.data).toEqual({ speed: 35, size: "small", mystery: { a: 1 } });
  });

  it("sets and clears the parent", () => {
    let record = addEntry(pack(), {
      id: "mine:subclass/storm",
      kind: "subclass",
      effects: [],
      data: { levels: [], spells: [] },
    });
    record = updateEntry(record, "mine:subclass/storm", { parent: "srd51:class/wizard" });
    expect(record.pack.entries[0]?.parent).toBe("srd51:class/wizard");
    record = updateEntry(record, "mine:subclass/storm", { parent: undefined });
    expect(record.pack.entries[0]).not.toHaveProperty("parent");
  });

  it("refuses to change what is not there", () => {
    expect(() => updateEntry(pack(), "mine:spell/none", {})).toThrow(EntryError);
  });

  it("writes texts in the language of the pack, or in a translation, and clears them", () => {
    let record = filled();
    record = setText(record, "mine:species/sprite", "desc", "Tiny fey.");
    record = setText(record, "mine:species/sprite", "name", "Folletto", "it");
    expect(record.strings["mine:species/sprite.desc"]).toBe("Tiny fey.");
    expect(record.translations?.it).toEqual({ "mine:species/sprite.name": "Folletto" });
    record = setText(record, "mine:species/sprite", "name", "  ", "it");
    expect(record.translations?.it).toEqual({});
    record = setText(record, "mine:species/sprite", "desc", "");
    expect(record.strings).not.toHaveProperty("mine:species/sprite.desc");
  });

  it("finds the entries an entry owns, in its own pack only", () => {
    const record = filled();
    expect(ownedEntries(record, "mine:species/sprite").map((e) => e.id)).toEqual([
      "mine:trait/sprite-glow",
    ]);
    expect(ownedEntries(record, "mine:trait/sprite-glow")).toEqual([]);
  });

  it("finds the features of a class by level and the traits inside a `when`", () => {
    let record = addEntry(pack(), {
      id: "mine:class/tinker",
      kind: "class",
      effects: [{ type: "when", requires: "x", effects: [{ type: "trait", id: "mine:trait/a" }] }],
      data: { levels: [{ level: 1, features: ["mine:feature/gadget"] }] },
    });
    record = addEntry(record, {
      id: "mine:feature/gadget",
      kind: "feature",
      effects: [],
      data: {},
    });
    record = addEntry(record, { id: "mine:trait/a", kind: "trait", effects: [], data: {} });
    record = addEntry(record, { id: "mine:spell/unrelated", kind: "spell", effects: [], data: {} });
    expect(
      ownedEntries(record, "mine:class/tinker")
        .map((e) => e.id)
        .sort(),
    ).toEqual(["mine:feature/gadget", "mine:trait/a"]);
  });

  it("deletes an entry with what it owns, its texts and its translations", () => {
    let record = setText(filled(), "mine:trait/sprite-glow", "name", "Luce", "it");
    record = deleteEntry(record, "mine:species/sprite");
    expect(record.pack.entries).toEqual([]);
    expect(record.strings).toEqual({});
    expect(record.translations?.it).toEqual({});
  });

  it("says what is wrong with an entry", () => {
    expect(entryProblems(species())).toEqual([]);
    const bad = { ...species(), data: { speed: "fast", size: "small" } };
    expect(entryProblems(bad)).toEqual(["speed: expected a number"]);
    const worse = {
      ...species(),
      effects: [{ type: "abilityBonus", ability: "luck", value: 1 }],
    } as unknown as Entry;
    expect(entryProblems(worse).length).toBeGreaterThan(0);
  });
});
