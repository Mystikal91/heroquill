import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { homebrewUsedBy } from "./carried";
import type { UserPackRecord } from "./packs";

const pack = (): UserPackRecord => ({
  id: "mine",
  name: "Mine",
  origin: "homebrew",
  addedAt: 1,
  lang: "en",
  pack: {
    manifest: { id: "mine", ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [
      { id: "mine:spell/glow", kind: "spell", effects: [], data: {} },
      { id: "mine:spell/copied", kind: "spell", effects: [], data: {} },
    ],
  },
  strings: { "mine:spell/glow.name": "Glow", "mine:spell/copied.name": "Copied" },
  provenance: { "mine:spell/copied": { from: "imp1:spell/x", restricted: true } },
});

describe("the packs that travel with a character", () => {
  it("leave out what was copied from imported content", () => {
    const character = createCharacter("srd51");
    character.spells["srd51:class/wizard"] = {
      cantrips: ["mine:spell/glow", "mine:spell/copied"],
      known: [],
      prepared: [],
    };
    const [used] = homebrewUsedBy(character, [pack()]);
    expect(used?.pack.entries.map((e) => e.id)).toEqual(["mine:spell/glow"]);
    expect(Object.keys(used?.strings ?? {})).toEqual(["mine:spell/glow.name"]);
  });

  it("do not include a pack the character does not use", () => {
    expect(homebrewUsedBy(createCharacter("srd51"), [pack()])).toEqual([]);
  });
});
