import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { bundleFromIndex, importBundle } from "./arrange";
import { newHomebrewPack } from "./model";

const entry = (id: string, kind: Entry["kind"], effects: Entry["effects"] = []): Entry => ({
  id: id as Entry["id"],
  kind,
  effects,
  data: {},
});

describe("copying entries of the rules", () => {
  const index = new Map<string, Entry>([
    [
      "srd51:species/dwarf",
      entry("srd51:species/dwarf", "species", [{ type: "trait", id: "srd51:trait/stonecunning" }]),
    ],
    ["srd51:trait/stonecunning", entry("srd51:trait/stonecunning", "trait")],
    ["srd51:trait/other", entry("srd51:trait/other", "trait")],
  ]);
  const texts = {
    fields: (id: string) => (id.includes("other") ? [] : ["name", "desc"]),
    read: (id: string, field: string) => `${id.split("/")[1]} ${field}`,
  };

  it("takes what the entry owns and the texts as they read", () => {
    const bundle = bundleFromIndex(index, texts, ["srd51:species/dwarf"], "en");
    expect(bundle.entries.map((e) => e.id)).toEqual([
      "srd51:species/dwarf",
      "srd51:trait/stonecunning",
    ]);
    expect(bundle.strings["srd51:trait/stonecunning.desc"]).toBe("stonecunning desc");
    expect(bundle.chosen).toEqual(["srd51:species/dwarf"]);
  });

  it("ignores ids the rules do not have", () => {
    expect(bundleFromIndex(index, texts, ["srd51:spell/none"], "en").entries).toEqual([]);
  });

  it("goes into a pack with a note of where each entry came from, and a restriction when asked", () => {
    const pack = { ...newHomebrewPack("Mine", 1), id: "mine" };
    const bundle = bundleFromIndex(index, texts, ["srd51:species/dwarf"], "en");
    const done = importBundle(bundle, pack, { restricted: true, from: (id) => id });
    expect(done.newIds).toEqual(["mine:species/dwarf"]);
    expect(done.record.provenance?.["mine:trait/stonecunning"]).toEqual({
      from: "srd51:trait/stonecunning",
      restricted: true,
    });
    const species = done.record.pack.entries.find((e) => e.id === "mine:species/dwarf");
    expect(species?.effects).toContainEqual({ type: "trait", id: "mine:trait/stonecunning" });
  });
});
