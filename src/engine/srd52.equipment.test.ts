import { describe, expect, it } from "vitest";
import { itemData } from "../data/items";
import pairs from "../data/srd52Pairs.json";
import { startingOf } from "../data/startingEquipment";
import { bothIndex } from "../test/srd52";
import { addStartingItems } from "./gear";
import { categoryItems, noPicks, resolveStarting } from "./startingGear";

const fighter = () => startingOf(bothIndex.get("srd52:class/fighter"));
const soldier = () => startingOf(bothIndex.get("srd52:background/soldier"));

describe("2024 equipment", () => {
  it("converts the whole table of weapons, armor, tools, gear and ammunition", () => {
    const items = [...bothIndex.values()].filter((e) => e.id.startsWith("srd52:item/"));
    const by = (category: string) => items.filter((e) => e.data.category === category).length;
    expect(by("weapon")).toBe(38);
    expect(by("armor")).toBe(13);
    expect(by("tools")).toBe(37);
    expect(items.length).toBe(182);
  });

  it("gives every weapon and armor a shape the engine reads", () => {
    for (const e of bothIndex.values()) {
      if (!e.id.startsWith("srd52:item/")) continue;
      if (e.data.category === "weapon") expect(itemData(e).weapon, e.id).toBeDefined();
      if (e.data.category === "armor") expect(itemData(e).armor, e.id).toBeDefined();
    }
  });

  it("reads armor like the 2014 table", () => {
    const chain = bothIndex.get("srd52:item/chain-mail")?.data.armor as Record<string, unknown>;
    expect(chain).toMatchObject({
      category: "heavy",
      base: 16,
      dexBonus: false,
      strengthMinimum: 13,
    });
    const shield = bothIndex.get("srd52:item/shield")?.data.armor as Record<string, unknown>;
    expect(shield).toMatchObject({ category: "shield", base: 2 });
  });

  it("counts ammunition in bundles, like the 2014 items", () => {
    const arrows = bothIndex.get("srd52:item/arrows");
    expect((arrows?.data.gear as { bundleSize?: number }).bundleSize).toBe(20);
  });

  it("gives the Fighter the three starting options of the book, the last one gold only", () => {
    const [choice] = fighter().choices;
    expect(fighter().choices.length).toBe(1);
    expect(choice?.options.length).toBe(3);
    const a = resolveStarting(fighter().choices, { options: [0], items: {} });
    expect(a.complete).toBe(true);
    expect(a.gold).toBe(4);
    expect(a.items.map((i) => i.item)).toEqual([
      "srd52:item/chain-mail",
      "srd52:item/greatsword",
      "srd52:item/flail",
      "srd52:item/javelin",
      "srd52:item/dungeoneer-pack",
    ]);
    const c = resolveStarting(fighter().choices, { options: [2], items: {} });
    expect(c).toMatchObject({ gold: 155, items: [], complete: true });
    expect(resolveStarting(fighter().choices, noPicks()).complete).toBe(false);
  });

  it("opens a pack into what it holds and turns 20 arrows into one bundle", () => {
    const b = resolveStarting(fighter().choices, { options: [1], items: {} });
    const inventory: { itemId: string; quantity: number; equipped?: boolean }[] = [];
    addStartingItems(inventory as never, bothIndex, b.items);
    const quantity = (id: string) => inventory.find((i) => i.itemId === id)?.quantity;
    expect(quantity("srd52:item/arrows")).toBe(1);
    expect(quantity("srd52:item/torch")).toBe(10);
    expect(quantity("srd52:item/dungeoneer-pack")).toBeUndefined();
    expect(b.gold).toBe(11);
  });

  it("asks the Soldier for a gaming set among the four of the 2024 table", () => {
    const [choice] = soldier().choices;
    expect(choice?.options.length).toBe(2);
    expect(categoryItems("gaming-sets", bothIndex, "srd52")).toEqual([
      "srd52:item/dice",
      "srd52:item/dragonchess",
      "srd52:item/playing-cards",
      "srd52:item/three-dragon-ante",
    ]);
    // None of them in the 2014 pack's namespace.
    expect(categoryItems("gaming-sets", bothIndex, "srd51")).toEqual([]);
    const gold = resolveStarting(soldier().choices, { options: [1], items: {} });
    expect(gold).toMatchObject({ gold: 50, items: [], complete: true });
  });
});

describe("the 2014 and 2024 item pairs", () => {
  it("names items that exist in both packs", () => {
    for (const [id52, id51] of Object.entries(pairs.items)) {
      expect(bothIndex.has(id52), id52).toBe(true);
      expect(bothIndex.has(id51), id51).toBe(true);
    }
  });

  it("pairs by slug and by the book's renames, and keeps the new things apart", () => {
    expect(pairs.items["srd52:item/longsword"]).toBe("srd51:item/longsword");
    expect(pairs.items["srd52:item/light-crossbow"]).toBe("srd51:item/crossbow-light");
    expect(pairs.items["srd52:item/dungeoneer-pack"]).toBe("srd51:item/dungeoneers-pack");
    expect(pairs.items["srd52:item/arrows"]).toBe("srd51:item/arrow");
    expect(pairs.onlyIn2024).toContain("srd52:item/musket");
    expect(Object.keys(pairs.items).length + pairs.onlyIn2024.length).toBe(182);
  });

  it("never pairs two 2024 items with the same 2014 one", () => {
    const targets = Object.values(pairs.items);
    expect(new Set(targets).size).toBe(targets.length);
  });
});
