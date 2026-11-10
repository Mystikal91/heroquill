import { describe, expect, it } from "vitest";
import {
  type ItemOption,
  freeItemName,
  isPotionId,
  matchesQuery,
  rememberRecent,
  searchItems,
  splitQuantity,
} from "./itemSearch";

const opt = (id: string, name: string, kind: ItemOption["kind"] = "gear"): ItemOption => ({
  id,
  name,
  kind,
  homebrew: false,
});

const OPTIONS = [
  opt("srd51:item/potion-of-healing-common", "Potion of Healing", "magic"),
  opt("srd51:item/potion-of-healing-greater", "Potion of Healing (Greater)", "magic"),
  opt("srd51:item/spotted-cloak", "Spotted Cloak", "gear"),
  opt("srd51:item/longsword", "Longsword", "weapon"),
  opt("srd51:item/torch", "Torch"),
  opt("srd51:item/oil-of-sharpness", "Oil of Sharpness", "magic"),
  opt("srd51:item/elixir-of-health", "Élixir de santé", "magic"),
];

describe("searching items", () => {
  it("finds by every word, in any order, ignoring accents and case", () => {
    expect(matchesQuery("Élixir de santé", "elixir SANTE")).toBe(true);
    expect(matchesQuery("Potion of Healing", "healing potion")).toBe(true);
    expect(matchesQuery("Torch", "torch sword")).toBe(false);
    expect(matchesQuery("Torch", "")).toBe(true);
  });

  it("puts names that start with the search before the ones that only hold it", () => {
    const names = searchItems(OPTIONS, "pot", "all").map((o) => o.name);
    expect(names.slice(0, 2)).toEqual(["Potion of Healing", "Potion of Healing (Greater)"]);
    expect(names).toContain("Spotted Cloak");
    expect(names.indexOf("Spotted Cloak")).toBeGreaterThan(1);
  });

  it("knows the potions by their slug and keeps the chips apart", () => {
    expect(isPotionId("srd51:item/potion-of-healing-greater")).toBe(true);
    expect(isPotionId("pack:item/elixir-of-health")).toBe(true);
    expect(isPotionId("srd51:item/oil-of-sharpness")).toBe(true);
    expect(isPotionId("srd51:item/spotted-cloak")).toBe(false);
    expect(isPotionId("srd51:item/torch")).toBe(false);
    expect(searchItems(OPTIONS, "", "potion").map((o) => o.id)).toEqual([
      "srd51:item/elixir-of-health",
      "srd51:item/oil-of-sharpness",
      "srd51:item/potion-of-healing-common",
      "srd51:item/potion-of-healing-greater",
    ]);
    expect(searchItems(OPTIONS, "", "weapon").map((o) => o.name)).toEqual(["Longsword"]);
  });
});

describe("a count in what was typed", () => {
  it("reads it at the start or at the end", () => {
    expect(splitQuantity("2 potions")).toEqual({ quantity: 2, name: "potions" });
    expect(splitQuantity("2x potions")).toEqual({ quantity: 2, name: "potions" });
    expect(splitQuantity("3 × torch")).toEqual({ quantity: 3, name: "torch" });
    expect(splitQuantity("torch x5")).toEqual({ quantity: 5, name: "torch" });
    expect(splitQuantity("torch")).toEqual({ quantity: 1, name: "torch" });
  });

  it("leaves a number that is part of a name alone", () => {
    expect(splitQuantity("+1 longsword")).toEqual({ quantity: 1, name: "+1 longsword" });
    expect(splitQuantity("10-foot pole")).toEqual({ quantity: 1, name: "10-foot pole" });
    expect(splitQuantity("potion of healing")).toEqual({
      quantity: 1,
      name: "potion of healing",
    });
  });

  it("writes the name of a free item with a capital", () => {
    expect(freeItemName("  pozione   di  X ")).toBe("Pozione di X");
  });
});

describe("the items added lately", () => {
  it("keeps the newest first, once each, and not too many", () => {
    expect(rememberRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
    const many = Array.from({ length: 20 }, (_, i) => `i${i}`);
    expect(rememberRecent(many, "new")).toHaveLength(12);
    expect(rememberRecent(many, "new")[0]).toBe("new");
  });
});
