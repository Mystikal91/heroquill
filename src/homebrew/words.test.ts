import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { wordEntry, wordOfEntry } from "../engine/words";
import { migratePackRecord } from "../storage/packFormat";
import { type UserPackRecord, parseUserPack } from "../storage/packs";
import { checkData } from "./catalog/data";
import { deleteEntry, setText } from "./entries";
import { newHomebrewPack } from "./pack";
import { addLanguage } from "./translate";
import { addWord, ownWords, wordLabel } from "./words";

const pack = () => ({ ...newHomebrewPack("Mine", 1), id: "mine", lang: "it" });

describe("reserves, kinds of damage and components as entries", () => {
  it("adds a kind of damage as an entry named by what the person wrote", () => {
    const made = addWord(pack(), "damage", "Acido sonico");
    expect(made?.word).toBe("acido-sonico");
    const record = made?.record as UserPackRecord;
    expect(ownWords(record, "damage").map((e) => e.id)).toEqual(["mine:damage/acido-sonico"]);
    expect(record.strings["mine:damage/acido-sonico.name"]).toBe("Acido sonico");
    expect(wordLabel(record, ownWords(record, "damage")[0] as Entry, "it")).toBe("Acido sonico");
  });

  it("does not add the same word twice", () => {
    const once = addWord(pack(), "damage", "Sonico")?.record as UserPackRecord;
    const twice = addWord(once, "damage", "sonico")?.record as UserPackRecord;
    expect(ownWords(twice, "damage")).toHaveLength(1);
  });

  it("starts a reserve that comes back after a long rest, and keeps a component by its code", () => {
    const withReserve = addWord(pack(), "reserve", "Punti psi")?.record as UserPackRecord;
    expect(ownWords(withReserve, "reserve")[0]?.data).toEqual({ recharge: "long" });
    const made = addWord(withReserve, "component", " ab ");
    const component = ownWords(made?.record as UserPackRecord, "component")[0] as Entry;
    expect(made?.word).toBe("AB");
    expect(component.data).toEqual({ code: "AB" });
    expect(wordOfEntry(component)).toBe("AB");
  });

  it("fits the catalog and says a word in the language asked, the original where there is none", () => {
    const base = addWord(pack(), "reserve", "Punti psi")?.record as UserPackRecord;
    const entry = ownWords(base, "reserve")[0] as Entry;
    expect(checkData("reserve", entry.data)).toEqual([]);
    expect(checkData("reserve", { recharge: "sometimes" }).length).toBeGreaterThan(0);
    let record = addLanguage(base, "en");
    expect(wordLabel(record, entry, "en")).toBe("Punti psi");
    record = setText(record, entry.id, "name", "Psi points", "en");
    expect(wordLabel(record, entry, "en")).toBe("Psi points");
    expect(wordLabel(record, entry, "it")).toBe("Punti psi");
  });

  it("is found by its word from the index of every pack, and goes with its entry", () => {
    const record = addWord(pack(), "damage", "Sonico")?.record as UserPackRecord;
    const index = new Map(record.pack.entries.map((e) => [e.id, e] as [string, Entry]));
    expect(wordEntry(index, "damage", "sonico")?.id).toBe("mine:damage/sonico");
    expect(wordEntry(index, "damage", "fire")).toBeUndefined();
    const gone = deleteEntry(record, "mine:damage/sonico");
    expect(ownWords(gone, "damage")).toEqual([]);
    expect(Object.keys(gone.strings).some((k) => k.startsWith("mine:damage/"))).toBe(false);
  });
});

describe("a pack that kept them in its metadata (format 2)", () => {
  const old = () => ({
    id: "old",
    name: "Old",
    origin: "homebrew",
    addedAt: 1,
    lang: "it",
    formatVersion: 2,
    meta: {
      author: "Me",
      damageTypes: ["acido-sonico"],
      reserves: ["punti-psi"],
      components: ["A"],
    },
    pack: {
      manifest: { id: "old", ruleset: "custom", version: "1", license: "Own", attribution: "Me" },
      entries: [
        {
          id: "old:feature/foco",
          kind: "feature",
          effects: [
            { type: "uses", term: 3, recharge: "short", reserve: "punti-psi" },
            { type: "defense", kind: "resistance", damage: "acido-sonico" },
          ],
          data: {},
        },
      ],
    },
    strings: { "damage.acido-sonico": "Acido sonico", "pool.punti-psi": "Punti psi" },
    translations: { en: { "damage.acido-sonico": "Sonic acid", "pool.punti-psi": "Psi points" } },
  });

  it("becomes entries, with the names where entries keep them and the recharge the effects gave", () => {
    const parsed = parseUserPack(old());
    expect(parsed.formatVersion).toBe(3);
    expect(parsed.meta).toEqual({ author: "Me" });
    const ids = parsed.pack.entries.map((e) => e.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "old:damage/acido-sonico",
        "old:reserve/punti-psi",
        "old:component/a",
      ]),
    );
    expect(parsed.pack.entries.find((e) => e.id === "old:reserve/punti-psi")?.data).toEqual({
      recharge: "short",
    });
    expect(parsed.pack.entries.find((e) => e.id === "old:component/a")?.data).toEqual({
      code: "A",
    });
    expect(parsed.strings["old:damage/acido-sonico.name"]).toBe("Acido sonico");
    expect(parsed.strings["old:reserve/punti-psi.name"]).toBe("Punti psi");
    expect(parsed.strings["old:component/a.name"]).toBe("A");
    expect(parsed.translations?.en?.["old:reserve/punti-psi.name"]).toBe("Psi points");
    expect(
      Object.keys(parsed.strings).some((k) => k.startsWith("damage.") || k.startsWith("pool.")),
    ).toBe(false);
  });

  it("leaves a pack without the lists as it is, apart from the version", () => {
    const plain = { ...old(), meta: { author: "Me" } };
    const migrated = migratePackRecord(plain) as { pack: unknown; meta: unknown };
    expect(migrated.pack).toEqual(plain.pack);
    expect(migrated.meta).toEqual({ author: "Me" });
  });
});
