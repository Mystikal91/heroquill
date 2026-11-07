import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import {
  STARTING_CATEGORIES,
  startingChoicesOf,
  startingOf,
  startingWealthOf,
} from "../data/startingEquipment";
import { srd51Index } from "../test/srd51";
import { categoryItems, noPicks, resolveStarting, slotKeys, takenOption } from "./startingGear";

const entry = (id: string) => {
  const found = srd51Index.get(id);
  if (!found) throw new Error(id);
  return found;
};
const classes = [...srd51Index.values()].filter((e) => e.kind === "class");

describe("the categories starting equipment picks from", () => {
  it("have items in the SRD", () => {
    // Gaming sets are a 2024 category: the 2014 SRD has no such list (the 2024 tests cover them).
    for (const category of STARTING_CATEGORIES.filter((c) => c !== "gaming-sets"))
      expect(categoryItems(category, srd51Index).length, category).toBeGreaterThan(0);
  });

  it("split the weapons by category and by melee", () => {
    const simple = categoryItems("simple-weapons", srd51Index);
    const simpleMelee = categoryItems("simple-melee-weapons", srd51Index);
    const martial = categoryItems("martial-weapons", srd51Index);
    expect(simple).toContain("srd51:item/dagger");
    expect(simple).toContain("srd51:item/shortbow");
    expect(simpleMelee).toContain("srd51:item/dagger");
    expect(simpleMelee).not.toContain("srd51:item/shortbow");
    expect(martial).toContain("srd51:item/longsword");
    expect(martial.some((id) => simple.includes(id))).toBe(false);
  });

  it("list the foci and the instruments", () => {
    expect(categoryItems("arcane-foci", srd51Index)).toContain("srd51:item/crystal");
    expect(categoryItems("holy-symbols", srd51Index)).toContain("srd51:item/amulet");
    expect(categoryItems("musical-instruments", srd51Index)).toContain("srd51:item/lute");
  });
});

describe("the starting equipment of the classes of the SRD", () => {
  it("has the choices of all twelve, and no gold alternative (the SRD does not print it)", () => {
    expect(classes).toHaveLength(12);
    for (const cls of classes) {
      const { choices, wealth } = startingOf(cls);
      expect(choices.length, cls.id).toBeGreaterThan(0);
      expect(wealth, cls.id).toBeUndefined();
      for (const choice of choices)
        for (const option of choice.options)
          for (const part of option.items) {
            if ("item" in part)
              expect(srd51Index.has(part.item), `${cls.id} ${part.item}`).toBe(true);
            else if ("category" in part)
              expect(categoryItems(part.category, srd51Index).length).toBeGreaterThan(0);
          }
    }
  });

  it("reads like the book for the fighter", () => {
    const fighter = startingOf(entry("srd51:class/fighter"));
    expect(fighter.choices).toHaveLength(4);
    expect(startingWealthOf(entry("srd51:class/monk"))).toBeUndefined();
    // chain mail, or leather armor with a longbow and 20 arrows
    expect(fighter.choices[0]?.options).toEqual([
      { items: [{ item: "srd51:item/chain-mail", quantity: 1 }] },
      {
        items: [
          { item: "srd51:item/leather-armor", quantity: 1 },
          { item: "srd51:item/longbow", quantity: 1 },
          { item: "srd51:item/arrow", quantity: 20 },
        ],
      },
    ]);
  });

  it("asks nothing of the acolyte but a holy symbol", () => {
    const acolyte = startingChoicesOf(entry("srd51:background/acolyte"));
    expect(acolyte).toEqual([{ options: [{ items: [{ category: "holy-symbols", count: 1 }] }] }]);
  });
});

describe("resolving the decisions", () => {
  const fighter = startingOf(entry("srd51:class/fighter")).choices;

  it("is incomplete until every choice is made", () => {
    expect(resolveStarting(fighter, noPicks()).complete).toBe(false);
    const picks = noPicks();
    picks.options = [0, 1, 1, 0];
    expect(resolveStarting(fighter, picks).complete).toBe(false); // the second choice picks two martial weapons
    const slots = slotKeys(1, 0, { category: "martial-weapons", count: 2 });
    expect(slots).toEqual(["1:0:0", "1:0:1"]);
    picks.items = { "1:0:0": "srd51:item/longsword", "1:0:1": "srd51:item/rapier" };
    const done = resolveStarting(fighter, picks);
    expect(done.complete).toBe(true);
    expect(done.items.map((i) => `${i.item.split("/")[1]}×${i.quantity}`)).toEqual([
      "chain-mail×1",
      "longsword×1",
      "rapier×1",
      "handaxe×2",
      "dungeoneers-pack×1",
    ]);
  });

  it("needs no decision for a choice with one option", () => {
    const cleric = startingOf(entry("srd51:class/cleric")).choices;
    const last = cleric.at(-1);
    expect(last && takenOption(last, noPicks(), cleric.length - 1)).toBe(0);
  });
});

describe("a class of another book", () => {
  const aurora = (id: string): Entry => ({ id, kind: "class", effects: [], data: {} });

  it("takes the equipment written for its name, whichever edition it is", () => {
    for (const id of ["personal:class/artificer", "personal:class/artificer-2"]) {
      const artificer = startingOf(aurora(id));
      expect(artificer.fixed.map((i) => i.item)).toContain("srd51:item/thieves-tools");
      expect(artificer.choices).toHaveLength(2);
      expect(artificer.wealth).toEqual({ dice: "5d4", multiplier: 10 });
      for (const i of artificer.fixed) expect(srd51Index.has(i.item), i.item).toBe(true);
      for (const choice of artificer.choices)
        for (const option of choice.options)
          for (const part of option.items)
            if ("item" in part) expect(srd51Index.has(part.item), part.item).toBe(true);
    }
  });

  it("has nothing for a class that is not written", () => {
    expect(startingOf(aurora("personal:class/someone-else"))).toEqual({ fixed: [], choices: [] });
  });
});
