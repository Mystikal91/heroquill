import { describe, expect, it } from "vitest";
import srd from "../../data/srd51/items.json";
import { priceOf } from "./gear";

type Item = { id: string; kind: string; data: { cost?: unknown; rarity?: string } };
const items = (srd as { entries: Item[] }).entries.filter((e) => e.kind === "item");
const priceById = (id: string) =>
  priceOf(items.find((e) => e.id === id) as Parameters<typeof priceOf>[0]);

describe("the prices of the SRD items", () => {
  it("has the potion of healing at 50 gp, as the Adventuring Gear table (p. 69) says", () => {
    expect(priceById("srd51:item/potion-of-healing-common")).toBe(5000);
  });

  it("has the caltrops at 1 gp for the bag of 20, not 5 cp for one", () => {
    expect(priceById("srd51:item/caltrops")).toBe(100);
  });

  it("gives no other magic item a price: the SRD prints none", () => {
    const priced = items
      .filter((e) => e.data.rarity !== undefined)
      .filter((e) => priceOf(e as Parameters<typeof priceOf>[0]) !== undefined)
      .map((e) => e.id);
    expect(priced).toEqual(["srd51:item/potion-of-healing-common"]);
  });

  it("reads a price of 0 as not known", () => {
    expect(priceOf(undefined)).toBeUndefined();
    expect(priceById("srd51:item/potion-of-healing-greater")).toBeUndefined();
    expect(priceById("srd51:item/alms-box")).toBeUndefined();
  });
});
