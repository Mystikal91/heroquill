import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { deleteEntry } from "../homebrew/entries";
import { mergeCarried } from "./carried";
import { PACK_FORMAT_VERSION, migratePackRecord, versionOf } from "./packFormat";
import {
  PackParseError,
  type UserPackRecord,
  packLanguages,
  packTexts,
  parsePackFile,
  parseUserPack,
  restrictedIds,
  serializePack,
  withoutRestricted,
} from "./packs";

const GLOW = "mine:spell/glow";
const SPARK = "mine:spell/spark";

function record(over: Partial<UserPackRecord> = {}): UserPackRecord {
  return {
    id: "mine",
    name: "My Spells",
    origin: "homebrew",
    addedAt: 1,
    lang: "en",
    pack: {
      manifest: { id: "mine", ruleset: "custom", version: "1", license: "Own", attribution: "Me" },
      entries: [
        { id: GLOW, kind: "spell", effects: [], data: { level: 1, school: "evocation" } },
        { id: SPARK, kind: "spell", effects: [], data: { level: 0, school: "evocation" } },
      ],
    },
    strings: {
      [`${GLOW}.name`]: "Glow",
      [`${GLOW}.desc`]: "A soft light.",
      [`${SPARK}.name`]: "Spark",
    },
    ...over,
  };
}

describe("pack format versions", () => {
  it("reads a record without a version as version 1 and migrates it", () => {
    expect(versionOf(record())).toBe(1);
    const parsed = parseUserPack(record());
    expect(parsed.formatVersion).toBe(PACK_FORMAT_VERSION);
    expect(parsed.strings[`${GLOW}.name`]).toBe("Glow");
    expect(parsed.translations).toBeUndefined();
  });

  it("leaves a current record as it is", () => {
    const current = { ...record(), formatVersion: PACK_FORMAT_VERSION };
    expect(migratePackRecord(current)).toEqual(current);
  });

  it("refuses a pack made by a newer version of the app", () => {
    expect(() => parseUserPack({ ...record(), formatVersion: PACK_FORMAT_VERSION + 1 })).toThrow(
      PackParseError,
    );
  });

  it("passes what is not an object to the schema, which refuses it", () => {
    expect(() => parseUserPack("nope")).toThrow(PackParseError);
  });

  it("reads a file in the old format and writes the new one", () => {
    const old = JSON.stringify({ format: "dnd-character-maker-pack", ...record() });
    const read = parsePackFile(old, 5);
    expect(read).toMatchObject({ id: "mine", origin: "homebrew", formatVersion: 2, addedAt: 5 });
    const written = JSON.parse(serializePack(read));
    expect(written).toMatchObject({ format: "heroquill-pack", formatVersion: 2 });
    expect(written.origin).toBeUndefined();
    expect(parsePackFile(JSON.stringify(written)).strings[`${GLOW}.name`]).toBe("Glow");
  });

  it("keeps the details of the book through a file", () => {
    const book = record({
      meta: { author: "Ada", description: "Lights", cover: "data:image/png;x" },
    });
    const back = parsePackFile(serializePack(book));
    expect(back.meta).toEqual(book.meta);
  });

  it("refuses an absurdly large cover", () => {
    const big = record({ meta: { cover: "x".repeat(300_001) } });
    expect(() => parseUserPack(big)).toThrow(PackParseError);
  });
});

describe("texts in several languages", () => {
  const multi = () =>
    record({
      lang: "en",
      translations: { it: { [`${GLOW}.name`]: "Bagliore" }, fr: { [`${GLOW}.name`]: "Lueur" } },
    });

  it("lists the languages, the original first", () => {
    expect(packLanguages(multi())).toEqual(["en", "it", "fr"]);
  });

  it("takes the preferred language and falls back to the original per text", () => {
    const texts = packTexts(multi(), ["it", "en"]);
    expect(texts[`${GLOW}.name`]).toBe("Bagliore");
    expect(texts[`${GLOW}.desc`]).toBe("A soft light.");
  });

  it("follows the order of preference between translations", () => {
    expect(packTexts(multi(), ["fr", "it", "en"])[`${GLOW}.name`]).toBe("Lueur");
    expect(packTexts(multi(), ["de", "it", "en"])[`${GLOW}.name`]).toBe("Bagliore");
  });

  it("never lets a translation beat the original language when that is preferred", () => {
    const italian = record({ lang: "it", translations: { en: { [`${GLOW}.name`]: "Glow!" } } });
    italian.strings[`${GLOW}.name`] = "Bagliore";
    expect(packTexts(italian, ["it", "en"])[`${GLOW}.name`]).toBe("Bagliore");
    expect(packTexts(italian, ["en", "it"])[`${GLOW}.name`]).toBe("Glow!");
  });

  it("is what the content shows", async () => {
    const pack = parseUserPack(multi());
    expect((await loadContent(["it", "en"], [pack])).name(GLOW)).toBe("Bagliore");
    expect((await loadContent(["en"], [pack])).name(GLOW)).toBe("Glow");
    expect((await loadContent(["de", "en"], [pack])).name(GLOW)).toBe("Glow");
  });
});

describe("copies of content that may not be shared", () => {
  const withCopy = () =>
    record({
      provenance: {
        [SPARK]: { from: "imp1:spell/spark", restricted: true },
        [GLOW]: { from: "srd51:spell/light" },
      },
      translations: { it: { [`${SPARK}.name`]: "Scintilla", [`${GLOW}.name`]: "Bagliore" } },
    });

  it("tells which entries are restricted", () => {
    expect(restrictedIds(withCopy())).toEqual([SPARK]);
    expect(restrictedIds(record())).toEqual([]);
  });

  it("takes them out, with their texts, translations and notes of origin", () => {
    const clean = withoutRestricted(withCopy());
    expect(clean.pack.entries.map((e) => e.id)).toEqual([GLOW]);
    expect(Object.keys(clean.strings).every((k) => k.startsWith(GLOW))).toBe(true);
    expect(clean.translations?.it).toEqual({ [`${GLOW}.name`]: "Bagliore" });
    expect(clean.provenance).toEqual({ [GLOW]: { from: "srd51:spell/light" } });
  });

  it("returns the same pack when nothing is restricted", () => {
    const plain = record();
    expect(withoutRestricted(plain)).toBe(plain);
  });

  it("leaves them out of an exported file", () => {
    const text = serializePack(withCopy());
    expect(text).not.toContain("Scintilla");
    expect(text).not.toContain(SPARK);
    expect(text).toContain(GLOW);
  });
});

describe("keeping the extra fields while the pack is worked on", () => {
  it("removes the translations and notes of an entry that is deleted", () => {
    const gone = deleteEntry(
      record({
        provenance: { [SPARK]: { from: "srd51:spell/spark" } },
        translations: { it: { [`${SPARK}.name`]: "Scintilla", [`${GLOW}.name`]: "Bagliore" } },
      }),
      SPARK,
    );
    expect(gone.translations?.it).toEqual({ [`${GLOW}.name`]: "Bagliore" });
    expect(gone.provenance).toEqual({});
  });

  it("brings the translations and origins of new entries when packs are merged", () => {
    const here = record({
      pack: { ...record().pack, entries: [record().pack.entries[0] as never] },
    });
    const incoming = record({
      translations: { it: { [`${SPARK}.name`]: "Scintilla" } },
      provenance: { [SPARK]: { from: "srd51:spell/spark" } },
    });
    const merged = mergeCarried(here, incoming);
    expect(merged.added).toBe(1);
    expect(merged.record.translations?.it).toEqual({ [`${SPARK}.name`]: "Scintilla" });
    expect(merged.record.provenance).toEqual({ [SPARK]: { from: "srd51:spell/spark" } });
  });
});
