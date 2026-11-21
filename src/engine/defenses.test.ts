import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function make(species: string, subspecies?: string) {
  const c = createCharacter("srd51");
  c.choices.species = `srd51:species/${species}`;
  if (subspecies) c.choices.subspecies = `srd51:subspecies/${subspecies}`;
  c.classes = [{ classId: "srd51:class/fighter", level: 1 }];
  return c;
}

describe("resistances", () => {
  it("lists what the species gives", () => {
    expect(deriveSheet(make("dwarf", "hill-dwarf"), srd51Index).defenses.resistance).toEqual([
      "poison",
    ]);
    expect(deriveSheet(make("tiefling"), srd51Index).defenses.resistance).toEqual(["fire"]);
    expect(deriveSheet(make("human"), srd51Index).defenses).toEqual({
      resistance: [],
      immunity: [],
      vulnerability: [],
    });
  });

  it("follows the dragon a dragonborn picked", () => {
    const c = make("dragonborn");
    const key = "srd51:trait/draconic-ancestry/draconic-ancestry-subtrait";
    c.selections[key] = ["srd51:trait/draconic-ancestry-silver"];
    expect(deriveSheet(c, srd51Index).defenses.resistance).toEqual(["cold"]);
    c.selections[key] = ["srd51:trait/draconic-ancestry-green"];
    expect(deriveSheet(c, srd51Index).defenses.resistance).toEqual(["poison"]);
  });
});
