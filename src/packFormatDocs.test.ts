import { readFileSync } from "node:fs";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { MARK_END, MARK_START, withReference } from "../scripts/pack-docs";
import { EntrySchema, brokenReferences } from "./data/schema";
import { createCharacter } from "./engine/character";
import { deriveSheet } from "./engine/derive";
import { entryProblems } from "./homebrew/entries";
import { parsePackFile } from "./storage/packs";
import { srd51Index } from "./test/srd51";

const PAGE = readFileSync("docs/PACK_FORMAT.md", "utf8");

/** The complete pack files written in the page (fenced as `json example`). */
const examples = () =>
  [...PAGE.matchAll(/```json example\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "");

describe("docs/PACK_FORMAT.md", () => {
  it("has its reference up to date with the catalog (run `npm run docs:pack`)", () => {
    expect(PAGE).toContain(MARK_START);
    expect(PAGE).toContain(MARK_END);
    expect(withReference(PAGE)).toBe(PAGE);
  });

  it("lists every kind of entry and every effect of the engine", () => {
    for (const kind of [
      "species",
      "class",
      "spell",
      "item",
      "monster",
      "feat",
      "background",
      "subclass",
    ])
      expect(PAGE).toContain(`#### \`${kind}\``);
    // The ids of the rules are there, for both editions.
    expect(PAGE).toContain("### Ids of the rules");
    expect(PAGE).toMatch(/fireball/);
    expect(PAGE).toMatch(/skill:arcana/);
    for (const effect of ["abilityBonus", "uses", "spends", "when", "choice", "trait"])
      expect(PAGE).toContain(`#### \`${effect}\``);
  });

  it("has examples that the app accepts as they are", () => {
    const blocks = [...PAGE.matchAll(/```json example\n([\s\S]*?)\n```/g)].map((m) => m[1] ?? "");
    expect(blocks.length).toBeGreaterThan(0);
    for (const text of blocks) {
      const record = parsePackFile(text);
      const problems = record.pack.entries.flatMap((e) => entryProblems(e));
      expect(problems).toEqual([]);
      expect(brokenReferences([record.pack])).toEqual([]);
      for (const e of record.pack.entries) expect(v.safeParse(EntrySchema, e).success).toBe(true);
      // Every entry has its name.
      for (const e of record.pack.entries)
        expect(record.strings[`${e.id}.name`], e.id).toBeTruthy();
    }
  });

  it("links to sections that exist", () => {
    const ids = new Set<string>();
    const seen = new Map<string, number>();
    for (const m of PAGE.replace(/```[\s\S]*?```/g, "").matchAll(/^#{1,6}\s+(.*)$/gm)) {
      const base = (m[1] ?? "")
        .toLowerCase()
        .replace(/`/g, "")
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .trim()
        .replace(/\s/g, "-");
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      ids.add(n === 0 ? base : `${base}-${n}`);
    }
    const links = [...PAGE.replace(/```[\s\S]*?```/g, "").matchAll(/\]\(#([^)]+)\)/g)].map(
      (m) => m[1] ?? "",
    );
    expect(links.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("says true things about the larger example (the numbers in its closing paragraph)", () => {
    const blocks = examples();
    const text = blocks.find((b) => b.includes('"id": "mindbook"'));
    expect(text).toBeTruthy();
    const record = parsePackFile(text ?? "");
    const index = new Map(srd51Index);
    for (const e of record.pack.entries) index.set(e.id, e);
    const c = createCharacter("srd51");
    c.choices.species = "mindbook:species/dreamer";
    c.classes = [{ classId: "mindbook:class/mystic", level: 3 }];
    const sheet = deriveSheet(c, index);
    // 2 from the species and 14 from the table: one counter.
    expect(sheet.resources.filter((r) => r.reserve === "focus-points").map((r) => r.max)).toEqual([
      16,
    ]);
    const caster = sheet.spellcasters[0];
    expect(caster?.lists.maxSpellLevel).toBe(2);
    expect(caster?.spellLimit).toBe(4);
    expect(caster?.reserve).toBe("focus-points");
    expect(sheet.defenses.resistance).toContain("psychic");
  });
});
