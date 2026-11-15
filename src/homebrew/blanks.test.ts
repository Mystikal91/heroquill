import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { ENTRY_KINDS, EffectSchema } from "../data/schema";
import { type Variant, blankData, blankEffect, defaultFor, startEntry } from "./blanks";
import { checkData } from "./catalog/data";
import { EFFECT_TYPES, effectFields } from "./catalog/effects";
import { checkFields } from "./catalog/fields";
import { entryProblems } from "./entries";
import { newHomebrewPack } from "./pack";

describe("blank entries", () => {
  it("are valid for every kind, as far as the engine needs", () => {
    for (const kind of ENTRY_KINDS) expect(checkData(kind, blankData(kind)), kind).toEqual([]);
  });

  it("are valid for every kind of item", () => {
    for (const variant of ["weapon", "armor", "gear", "magic"] as Variant[])
      expect(checkData("item", blankData("item", variant)), variant).toEqual([]);
  });

  it("start a class with its twenty levels and the usual increases", () => {
    const data = blankData("class") as {
      levels: { level: number; abilityScoreImprovements: number }[];
    };
    expect(data.levels).toHaveLength(20);
    expect(data.levels[3]?.abilityScoreImprovements).toBe(1);
    expect(data.levels[19]?.abilityScoreImprovements).toBe(5);
  });

  it("are added to a pack with an id of their own and no problems", () => {
    const pack = { ...newHomebrewPack("Mine", 1), id: "mine" };
    const first = startEntry(pack, "species");
    const second = startEntry(first.record, "species");
    expect(first.id).toBe("mine:species/species");
    expect(second.id).toBe("mine:species/species-2");
    const entry = second.record.pack.entries.find((e) => e.id === second.id);
    expect(entry && entryProblems(entry)).toEqual([]);
  });
});

describe("blank effects", () => {
  it("make every effect type with the fields it must have", () => {
    for (const type of EFFECT_TYPES) {
      const effect = blankEffect(type) as Record<string, unknown>;
      expect(effect.type).toBe(type);
      const { type: _t, ...rest } = effect;
      // Only a pick (an entry, a word of the rules) may be missing.
      const problems = checkFields(effectFields(type), rest).filter(
        (p) => !/required|a name of the rules|an entry id/.test(p),
      );
      expect(problems, type).toEqual([]);
    }
  });

  it("are accepted by the engine's schema once the pointers are picked", () => {
    const effect = blankEffect("modifier");
    expect(v.safeParse(EffectSchema, effect).success).toBe(true);
    expect(v.safeParse(EffectSchema, blankEffect("abilityBonus")).success).toBe(true);
    expect(v.safeParse(EffectSchema, blankEffect("movement")).success).toBe(true);
  });

  it("have defaults that follow the type of the field", () => {
    expect(defaultFor({ type: "number", min: 2 })).toBe(2);
    expect(defaultFor({ type: "choice", options: ["a", "b"] })).toBe("a");
    expect(defaultFor({ type: "ref" })).toBeUndefined();
    expect(defaultFor({ type: "list", of: { type: "text" } })).toEqual([]);
  });
});
