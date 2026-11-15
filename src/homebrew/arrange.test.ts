import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import type { UserPackRecord } from "../storage/packs";
import {
  applyIdMap,
  bundleOf,
  copyEntries,
  dependenciesOf,
  importBundle,
  isReferenced,
  moveEntries,
  nameBasedId,
  renameId,
  rewriteIds,
} from "./arrange";
import { addEntry, addOwned, setText } from "./entries";
import { newHomebrewPack } from "./pack";

const pack = (id: string): UserPackRecord => ({
  ...newHomebrewPack(id, 1),
  id,
  name: id,
  pack: {
    manifest: { id, ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [],
  },
});

const spell = (id: string): Entry => ({
  id: id as Entry["id"],
  kind: "spell",
  effects: [],
  data: {
    level: 1,
    school: "evocation",
    components: ["V"],
    ritual: false,
    concentration: false,
    classes: [],
  },
});

/** A source pack with a species (and its trait) that grants a spell, and the spell. */
function source() {
  let record = pack("aaa");
  record = addEntry(record, spell("aaa:spell/glow"), { name: "Glow", desc: "Light." });
  record = addEntry(
    record,
    {
      id: "aaa:species/sprite",
      kind: "species",
      effects: [{ type: "grantSpell", spell: "aaa:spell/glow" }],
      data: { speed: 30, size: "small" },
    },
    { name: "Sprite" },
  );
  record = addOwned(record, "aaa:species/sprite", "trait").record;
  record = setText(record, "aaa:trait/trait", "name", "Shine");
  return record;
}

describe("rewriting ids", () => {
  it("replaces them wherever they are written, and only whole ids", () => {
    const map = new Map([["aaa:spell/glow", "bbb:spell/glow"]]);
    const value = {
      a: "aaa:spell/glow",
      b: ["x", "aaa:spell/glow"],
      c: { "aaa:spell/glow": 1 },
      d: "!aaa:spell/glow,other",
      e: "aaa:spell/glow-more",
    };
    expect(rewriteIds(value, map)).toEqual({
      a: "bbb:spell/glow",
      b: ["x", "bbb:spell/glow"],
      c: { "bbb:spell/glow": 1 },
      d: "!bbb:spell/glow,other",
      e: "aaa:spell/glow-more",
    });
  });

  it("returns the same value when nothing changes", () => {
    const value = { a: 1 };
    expect(rewriteIds(value, new Map([["aaa:spell/x", "bbb:spell/x"]]))).toBe(value);
  });
});

describe("bundles", () => {
  it("take what an entry owns, and their texts", () => {
    const bundle = bundleOf(source(), ["aaa:species/sprite"]);
    expect(bundle.entries.map((e) => e.id)).toEqual(["aaa:species/sprite", "aaa:trait/trait"]);
    expect(bundle.chosen).toEqual(["aaa:species/sprite"]);
    expect(Object.keys(bundle.strings).sort()).toEqual([
      "aaa:species/sprite.name",
      "aaa:trait/trait.name",
    ]);
  });

  it("find what an entry refers to in its pack", () => {
    expect(dependenciesOf(source(), ["aaa:species/sprite"])).toEqual(["aaa:spell/glow"]);
    expect(dependenciesOf(source(), ["aaa:spell/glow"])).toEqual([]);
  });
});

describe("copying", () => {
  it("puts entries in another pack under new ids, with their texts and what they own", () => {
    const done = copyEntries(source(), pack("bbb"), ["aaa:species/sprite"]);
    const [target] = done.records;
    expect(target?.pack.entries.map((e) => e.id)).toEqual([
      "bbb:species/sprite",
      "bbb:trait/trait",
    ]);
    expect(target?.strings["bbb:trait/trait.name"]).toBe("Shine");
    expect(done.newIds).toEqual(["bbb:species/sprite"]);
    // The trait the species gives is the copy of the trait.
    expect(target?.pack.entries[0]?.effects).toContainEqual({
      type: "grantSpell",
      spell: "aaa:spell/glow",
    });
  });

  it("makes a duplicate in the same pack with a free id, and renames it", () => {
    const record = source();
    const done = copyEntries(record, record, ["aaa:spell/glow"], { rename: (n) => `${n} (copy)` });
    const [next] = done.records;
    expect(next?.pack.entries.map((e) => e.id)).toContain("aaa:spell/glow-2");
    expect(next?.strings["aaa:spell/glow-2.name"]).toBe("Glow (copy)");
    expect(next?.strings["aaa:spell/glow.name"]).toBe("Glow");
  });

  it("follows the references among the entries copied together", () => {
    const record = source();
    const bundle = bundleOf(record, ["aaa:species/sprite", "aaa:spell/glow"]);
    const done = importBundle(bundle, pack("bbb"));
    const species = done.record.pack.entries.find((e) => e.id === "bbb:species/sprite");
    expect(species?.effects).toContainEqual({ type: "grantSpell", spell: "bbb:spell/glow" });
  });

  it("keeps the translations and where an entry came from", () => {
    let record = setText(source(), "aaa:spell/glow", "name", "Bagliore", "it");
    record = {
      ...record,
      provenance: { "aaa:spell/glow": { from: "imp1:spell/light", restricted: true } },
    };
    const done = copyEntries(record, pack("bbb"), ["aaa:spell/glow"]);
    const [target] = done.records;
    expect(target?.translations?.it).toEqual({ "bbb:spell/glow.name": "Bagliore" });
    expect(target?.provenance).toEqual({
      "bbb:spell/glow": { from: "imp1:spell/light", restricted: true },
    });
  });

  it("puts texts in the right language when the packs differ", () => {
    const italian = { ...pack("bbb"), lang: "it" };
    const done = copyEntries(source(), italian, ["aaa:spell/glow"]);
    const [target] = done.records;
    expect(target?.strings["bbb:spell/glow.name"]).toBeUndefined();
    expect(target?.translations?.en?.["bbb:spell/glow.name"]).toBe("Glow");
  });

  it("marks what comes from content that may not be shared", () => {
    const bundle = bundleOf(source(), ["aaa:spell/glow"]);
    const done = importBundle(bundle, pack("bbb"), { restricted: true });
    expect(done.record.provenance?.["bbb:spell/glow"]?.restricted).toBe(true);
  });
});

describe("moving", () => {
  it("takes entries out of the source and puts them in the target, with their texts", () => {
    const done = moveEntries(source(), pack("bbb"), ["aaa:species/sprite"]);
    const [from, to] = done.records;
    expect(from?.pack.entries.map((e) => e.id)).toEqual(["aaa:spell/glow"]);
    expect(
      Object.keys(from?.strings ?? {}).some((k) => k.includes("sprite") || k.includes("trait")),
    ).toBe(false);
    expect(to?.pack.entries.map((e) => e.id)).toEqual(["bbb:species/sprite", "bbb:trait/trait"]);
    expect(done.idMap.get("aaa:species/sprite")).toBe("bbb:species/sprite");
  });

  it("makes what stays refer to what moved, in the source and in the other packs", () => {
    const record = source();
    const mine = pack("ccc");
    const other = addEntry(mine, {
      id: "ccc:feat/lucky",
      kind: "feat",
      effects: [{ type: "grantSpell", spell: "aaa:spell/glow" }],
      data: {},
    });
    const done = moveEntries(record, pack("bbb"), ["aaa:spell/glow"], [other]);
    const [from, to, third] = done.records;
    const species = from?.pack.entries.find((e) => e.id === "aaa:species/sprite");
    expect(species?.effects).toContainEqual({ type: "grantSpell", spell: "bbb:spell/glow" });
    expect(to?.pack.entries[0]?.id).toBe("bbb:spell/glow");
    expect(third?.pack.entries[0]?.effects).toContainEqual({
      type: "grantSpell",
      spell: "bbb:spell/glow",
    });
  });

  it("gives a moved entry a free id when the target has one like it", () => {
    let target = pack("bbb");
    target = addEntry(target, spell("bbb:spell/glow"));
    const done = moveEntries(source(), target, ["aaa:spell/glow"]);
    expect(done.idMap.get("aaa:spell/glow")).toBe("bbb:spell/glow-2");
  });

  it("does nothing within one pack, and leaves the packs it did not change out", () => {
    const record = source();
    expect(moveEntries(record, record, ["aaa:spell/glow"]).records).toEqual([]);
    const done = moveEntries(record, pack("bbb"), ["aaa:spell/glow"], [pack("ccc")]);
    expect(done.records).toHaveLength(2);
  });
});

describe("renaming an id", () => {
  it("changes the entry, its texts, and everything that points at it", () => {
    const record = source();
    const done = renameId(record, "aaa:spell/glow", "aaa:spell/radiance");
    const [next] = done.records;
    expect(next?.pack.entries.map((e) => e.id)).toContain("aaa:spell/radiance");
    expect(next?.strings["aaa:spell/radiance.name"]).toBe("Glow");
    expect(next?.strings["aaa:spell/glow.name"]).toBeUndefined();
    const species = next?.pack.entries.find((e) => e.kind === "species");
    expect(species?.effects).toContainEqual({ type: "grantSpell", spell: "aaa:spell/radiance" });
    expect(done.idMap.get("aaa:spell/glow")).toBe("aaa:spell/radiance");
  });

  it("applies a map to a pack that only refers to the ids", () => {
    const other = addEntry(pack("ccc"), {
      id: "ccc:feat/x",
      kind: "feat",
      effects: [{ type: "grantSpell", spell: "aaa:spell/glow" }],
      data: {},
    });
    const next = applyIdMap(other, new Map([["aaa:spell/glow", "aaa:spell/z"]]));
    expect(next.pack.entries[0]?.effects).toContainEqual({
      type: "grantSpell",
      spell: "aaa:spell/z",
    });
    expect(applyIdMap(other, new Map([["zzz:spell/q", "zzz:spell/r"]]))).toBe(other);
  });

  it("gives an entry an id from its name when its first one was a stand-in", () => {
    const record = addEntry(pack("aaa"), spell("aaa:spell/spell"));
    expect(nameBasedId(record, "aaa:spell/spell", "Frost Bite")).toBe("aaa:spell/frost-bite");
    expect(nameBasedId(record, "aaa:spell/spell", "!!!")).toBeUndefined();
    expect(nameBasedId(record, "aaa:spell/glow", "Frost Bite")).toBeUndefined();
  });

  it("knows when another entry refers to an id", () => {
    const record = source();
    expect(isReferenced([record], "aaa:spell/glow")).toBe(true);
    expect(isReferenced([record], "aaa:species/sprite")).toBe(false);
  });
});
