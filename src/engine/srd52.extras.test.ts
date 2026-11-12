import { describe, expect, it } from "vitest";
import { loadSrd52Pack } from "../test/srd52";

describe("the 2024 alignments and poisons", () => {
  it("have the ten alignments of the book, the last being 'unaligned'", () => {
    const alignments = loadSrd52Pack("alignments");
    expect(alignments.entries.map((e) => e.id.split("/")[1])).toEqual([
      "lawful-good",
      "neutral-good",
      "chaotic-good",
      "lawful-neutral",
      "neutral",
      "chaotic-neutral",
      "lawful-evil",
      "neutral-evil",
      "chaotic-evil",
      "unaligned",
    ]);
    for (const e of alignments.entries) expect(e.kind).toBe("alignment");
  });

  it("have the 14 poisons as items with a price and how they are delivered", () => {
    const items = loadSrd52Pack("items");
    const poisons = items.entries.filter((e) => "poison" in e.data);
    expect(poisons).toHaveLength(14);
    const blood = poisons.find((e) => e.id === "srd52:item/assassins-blood");
    expect(blood?.data).toMatchObject({
      cost: { amount: 150, unit: "gp" },
      poison: { delivery: "ingested" },
    });
  });
});
