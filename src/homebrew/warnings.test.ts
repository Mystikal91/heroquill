import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import type { UserPackRecord } from "../storage/packs";
import { addEntry } from "./entries";
import { newHomebrewPack } from "./pack";
import { warningsFor } from "./warnings";

const empty = (): UserPackRecord => ({
  ...newHomebrewPack("Mine", 1),
  id: "mine",
  pack: {
    manifest: { id: "mine", ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [],
  },
});

const spell = (over: Partial<Entry["data"]> = {}): Entry => ({
  id: "mine:spell/glow",
  kind: "spell",
  effects: [],
  data: {
    level: 1,
    school: "evocation",
    components: ["V"],
    ritual: false,
    concentration: false,
    classes: ["srd51:class/wizard"],
    ...over,
  },
});

const around = { packs: [] };

describe("warnings about an entry", () => {
  it("has none for a complete spell", () => {
    const record = addEntry(empty(), spell(), { name: "Glow", desc: "Light." });
    expect(warningsFor(record, spell(), around)).toEqual([]);
  });

  it("asks for a name, a description and a class", () => {
    const record = addEntry(empty(), spell({ classes: [] }));
    const codes = warningsFor(record, spell({ classes: [] }), around).map((w) => w.code);
    expect(codes).toEqual(["noName", "noClasses", "noDesc"]);
    expect(
      warningsFor(record, spell({ classes: [] }), around).every((w) => w.severity === "hint"),
    ).toBe(true);
  });

  it("reports data the engine cannot read as an error", () => {
    const bad = spell({ level: 12 });
    const record = addEntry(empty(), bad, { name: "Glow", desc: "x" });
    expect(warningsFor(record, bad, around)).toEqual([
      { severity: "error", code: "problem", text: "level: must be at most 9" },
    ]);
  });

  it("reports a reference to something that is not there, only for the entry asked about", () => {
    const species: Entry = {
      id: "mine:species/sprite",
      kind: "species",
      effects: [{ type: "grantSpell", spell: "mine:spell/missing" }],
      data: { speed: 30 },
    };
    let record = addEntry(empty(), species, { name: "Sprite", desc: "x" });
    record = addEntry(record, spell(), { name: "Glow", desc: "x" });
    expect(warningsFor(record, species, around)).toEqual([
      { severity: "error", code: "broken", text: "mine:spell/missing" },
    ]);
    expect(warningsFor(record, spell(), around)).toEqual([]);
  });

  it("finds what a reference points at in the other packs", () => {
    const species: Entry = {
      id: "mine:species/sprite",
      kind: "species",
      effects: [{ type: "grantSpell", spell: "srd51:spell/light" }],
      data: { speed: 30 },
    };
    const record = addEntry(empty(), species, { name: "Sprite", desc: "x" });
    const light = {
      manifest: {
        id: "srd51",
        ruleset: "srd51" as const,
        version: "1",
        license: "x",
        attribution: "x",
      },
      entries: [
        { id: "srd51:spell/light" as Entry["id"], kind: "spell" as const, effects: [], data: {} },
      ],
    };
    expect(warningsFor(record, species, { packs: [light] })).toEqual([]);
  });
});
