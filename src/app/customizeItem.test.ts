// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { setText, updateEntry } from "../homebrew/entries";
import { canCustomize, planCustomize, saveCustomItem } from "./customizeItem";
import { character, content } from "./store";
import { userPacks } from "./userPacks";

describe("customizing a weapon of the inventory", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });

  beforeEach(() => {
    userPacks.value = [];
    character.value = createCharacter("srd51");
    character.value.inventory = [
      { itemId: "srd51:item/longsword", quantity: 1, equipped: true, bonus: 2, magical: true },
    ];
  });

  it("only offers weapons and armor", () => {
    expect(canCustomize("srd51:item/longsword")).toBe(true);
    expect(canCustomize("srd51:item/chain-mail")).toBe(true);
    expect(canCustomize("srd51:item/backpack")).toBe(false);
  });

  it("makes a copy in a new pack that remembers its origin and carries the old bonus", () => {
    const plan = planCustomize("srd51:item/longsword");
    expect(plan?.editing).toBe(false);
    const entry = plan?.record.pack.entries.find((e) => e.id === plan.id);
    expect(plan?.id).toMatch(/:item\/longsword$/);
    expect(entry?.data).toMatchObject({
      copyOf: "srd51:item/longsword",
      enhancement: 2,
      magical: true,
    });
    expect(plan?.record.strings[`${plan?.id}.name`]).toBe("Longsword (copy)");
    expect(plan?.record.provenance?.[plan?.id ?? ""]).toEqual({ from: "srd51:item/longsword" });
    // Nothing is stored until the person saves.
    expect(userPacks.value).toEqual([]);
  });

  it("puts the saved copy in the inventory in place of the original", async () => {
    const plan = planCustomize("srd51:item/longsword");
    if (!plan) throw new Error("no plan");
    let record = setText(plan.record, plan.id, "name", "Sun Blade");
    record = updateEntry(record, plan.id, { data: { enhancement: 3 } });
    await saveCustomItem("srd51:item/longsword", plan, record, { enchantment: "" });
    const held = character.value.inventory[0];
    expect(held?.itemId).toBe(plan.id);
    expect(held?.bonus).toBeUndefined();
    expect(held?.magical).toBeUndefined();
    expect(userPacks.value[0]?.strings[`${plan.id}.name`]).toBe("Sun Blade");
  });

  it("edits a homebrew item where it is", async () => {
    const first = planCustomize("srd51:item/longsword");
    if (!first) throw new Error("no plan");
    await saveCustomItem("srd51:item/longsword", first, first.record, { enchantment: "" });
    content.value = await loadContent(["en"], userPacks.value);
    const again = planCustomize(first.id);
    expect(again?.editing).toBe(true);
    expect(again?.id).toBe(first.id);
  });
});
