import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import {
  addEntry,
  addOwned,
  entryProblems,
  levelOf,
  moveFeature,
  ownedOfKind,
  readTable,
  removeOwned,
  setTable,
  setText,
} from "./entries";
import { newHomebrewPack } from "./pack";

const pack = () => ({ ...newHomebrewPack("Mine", 1), id: "mine" });

const tinker = (): Entry => ({
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
});

const find = (record: ReturnType<typeof pack>, id: string) =>
  record.pack.entries.find((e) => e.id === id) as Entry;

describe("owned entries", () => {
  it("adds a trait to a species and links it by an effect", () => {
    const sprite: Entry = {
      id: "mine:species/sprite",
      kind: "species",
      effects: [],
      data: { speed: 30, size: "small" },
    };
    const added = addOwned(addEntry(pack(), sprite), "mine:species/sprite", "trait");
    expect(added.id).toBe("mine:trait/trait");
    expect(find(added.record, "mine:species/sprite").effects).toContainEqual({
      type: "trait",
      id: added.id,
    });
    expect(ownedOfKind(added.record, "mine:species/sprite", "trait").map((e) => e.id)).toEqual([
      added.id,
    ]);
  });

  it("adds a feature to a class at a level, and lists them in order of level", () => {
    const a = addOwned(addEntry(pack(), tinker()), "mine:class/tinker", "feature", { level: 2 });
    const b = addOwned(a.record, "mine:class/tinker", "feature", { level: 1 });
    expect(ownedOfKind(b.record, "mine:class/tinker", "feature").map((e) => e.id)).toEqual([
      b.id,
      a.id,
    ]);
    const feature = find(b.record, a.id);
    expect(feature.data).toEqual({ class: "mine:class/tinker", level: 2 });
    expect(entryProblems(feature)).toEqual([]);
  });

  it("gives a feature of a subclass the class of the subclass, and makes the row it needs", () => {
    const storm: Entry = {
      id: "mine:subclass/storm",
      kind: "subclass",
      parent: "srd51:class/wizard",
      effects: [],
      data: { levels: [], spells: [] },
    };
    const added = addOwned(addEntry(pack(), storm), "mine:subclass/storm", "feature", {
      level: 6,
    });
    expect(find(added.record, added.id).data).toEqual({
      class: "srd51:class/wizard",
      subclass: "mine:subclass/storm",
      level: 6,
    });
    expect(find(added.record, "mine:subclass/storm").data.levels).toEqual([
      { level: 6, features: [added.id] },
    ]);
  });

  it("moves a feature to another level", () => {
    const a = addOwned(addEntry(pack(), tinker()), "mine:class/tinker", "feature", { level: 1 });
    const moved = moveFeature(a.record, "mine:class/tinker", a.id, 2);
    expect(levelOf(find(moved, "mine:class/tinker"), a.id)).toBe(2);
    expect(find(moved, a.id).data.level).toBe(2);
  });

  it("removes an owned entry from its owner, with its texts", () => {
    const a = addOwned(
      addEntry(pack(), tinker(), { name: "Tinker" }),
      "mine:class/tinker",
      "feature",
    );
    const named = setText(a.record, a.id, "name", "Gadget");
    const gone = removeOwned(named, "mine:class/tinker", a.id);
    expect(gone.pack.entries.map((e) => e.id)).toEqual(["mine:class/tinker"]);
    expect(Object.keys(gone.strings)).toEqual(["mine:class/tinker.name"]);
    expect(levelOf(find(gone, "mine:class/tinker"), a.id)).toBeUndefined();
  });

  it("writes a table of texts and counts how many the player picks", () => {
    const hermit: Entry = {
      id: "mine:background/hermit",
      kind: "background",
      effects: [],
      data: {},
    };
    const id = hermit.id;
    let record = addEntry(pack(), hermit);
    record = setTable(record, id, "personalityTraits", ["Quiet", " ", "Kind"], 2);
    expect(readTable(record, id, "personalityTraits")).toEqual(["Quiet", "Kind"]);
    expect(find(record, id).data).toEqual({ choose: { personalityTraits: 2 } });
    record = setTable(record, id, "ideals", ["Freedom"], 1);
    record = setTable(record, id, "personalityTraits", [], 2);
    expect(readTable(record, id, "personalityTraits")).toEqual([]);
    expect(find(record, id).data).toEqual({ choose: { ideals: 1 } });
  });
});
