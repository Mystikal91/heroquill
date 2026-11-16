import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { packLanguages, packTexts } from "../storage/packs";
import { addEntry, addOwned, setText } from "./entries";
import { newHomebrewPack } from "./pack";
import { addLanguage, progress, removeLanguage, textKeys, textOwners } from "./translate";

const species: Entry = {
  id: "mine:species/sprite",
  kind: "species",
  effects: [],
  data: { speed: 30, size: "small" },
};

function sample() {
  let record = { ...newHomebrewPack("Mine", 1), id: "mine", lang: "en" };
  record = addEntry(record, species, { name: "Sprite", desc: "Tiny fey." });
  const trait = addOwned(record, species.id, "trait");
  record = setText(
    setText(trait.record, trait.id, "name", "Glimmer"),
    trait.id,
    "desc",
    "You shine.",
  );
  return { record, trait: trait.id };
}

describe("translating a pack", () => {
  it("lists the texts of an entry and of what it owns, name first", () => {
    const { record, trait } = sample();
    expect(textOwners(record, species.id)).toEqual([species.id, trait]);
    expect(textKeys(record, textOwners(record, species.id))).toEqual([
      "mine:species/sprite.name",
      "mine:species/sprite.desc",
      `${trait}.name`,
      `${trait}.desc`,
    ]);
  });

  it("leaves out a text that says nothing", () => {
    const { record } = sample();
    const blank = setText(record, species.id, "desc", " ");
    expect(textKeys(blank, [species.id])).toEqual(["mine:species/sprite.name"]);
  });

  it("counts what is translated, for a pack or for an entry", () => {
    let { record } = sample();
    record = addLanguage(record, "it");
    expect(progress(record, "it")).toEqual({ done: 0, total: 4 });
    record = setText(record, species.id, "name", "Folletto", "it");
    record = setText(record, species.id, "desc", "Minuscolo.", "it");
    expect(progress(record, "it")).toEqual({ done: 2, total: 4 });
    expect(progress(record, "it", [species.id])).toEqual({ done: 2, total: 2 });
  });

  it("adds and removes a language, never the pack's own", () => {
    const { record } = sample();
    expect(addLanguage(record, "en")).toBe(record);
    const withIt = addLanguage(record, "it");
    expect(packLanguages(withIt)).toEqual(["en", "it"]);
    expect(addLanguage(withIt, "it")).toBe(withIt);
    const without = removeLanguage(setText(withIt, species.id, "name", "Folletto", "it"), "it");
    expect(without.translations).toBeUndefined();
    expect(without.strings["mine:species/sprite.name"]).toBe("Sprite");
  });

  it("is read in the language of the person, falling back to the original text by text", () => {
    let { record } = sample();
    record = setText(addLanguage(record, "it"), species.id, "name", "Folletto", "it");
    const texts = packTexts(record, ["it", "en"]);
    expect(texts["mine:species/sprite.name"]).toBe("Folletto");
    expect(texts["mine:species/sprite.desc"]).toBe("Tiny fey.");
  });
});
