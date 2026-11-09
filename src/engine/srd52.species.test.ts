import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const SIZE = "srd52:species/human/size";

function human(size?: string) {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  if (size) c.selections[SIZE] = [size];
  return deriveSheet(c, bothIndex);
}

describe("the size of a 2024 Human", () => {
  it("is a choice between Small and Medium, as the book says", () => {
    const pick = human().choices.find((c) => c.key === SIZE);
    expect(pick?.grants).toBe("size");
    expect(pick?.choose).toBe(1);
    expect([...(pick?.options ?? [])].sort()).toEqual(["medium", "small"]);
    expect(pick?.remaining).toBe(1);
  });

  it("has no size on the sheet until it is chosen, and has the chosen one after", () => {
    expect(human().size).toBeUndefined();
    expect(human("small").size).toBe("small");
    expect(human("medium").size).toBe("medium");
  });

  it("does not take a size the species does not offer", () => {
    const sheet = human("large");
    expect(sheet.size).toBeUndefined();
    expect(sheet.warnings.some((w) => w.code === "invalidChoice")).toBe(true);
  });

  it("keeps the speed and leaves the species data without a size", () => {
    expect(human("small").speed).toBe(30);
    expect(bothIndex.get("srd52:species/human")?.data).not.toHaveProperty("size");
  });
});

describe("the size of a species that has only one", () => {
  it("comes from the species, for a 2014 Dwarf and a 2014 Halfling", () => {
    const sizeOf = (species: string) => {
      const c = createCharacter("srd51");
      c.choices.species = `srd51:species/${species}`;
      return deriveSheet(c, bothIndex).size;
    };
    expect(sizeOf("dwarf")).toBe("medium");
    expect(sizeOf("halfling")).toBe("small");
  });

  it("is absent while no species is chosen", () => {
    expect(deriveSheet(createCharacter("srd52"), bothIndex).size).toBeUndefined();
  });
});
