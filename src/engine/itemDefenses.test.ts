import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function sheetWith(ruleset: "srd51" | "srd52", items: string[], equipped = true) {
  const c = createCharacter(ruleset);
  c.classes = [{ classId: `${ruleset}:class/fighter`, level: 5 }];
  c.inventory = items.map((name) => ({ itemId: `${ruleset}:item/${name}`, quantity: 1, equipped }));
  return deriveSheet(c, ruleset === "srd52" ? bothIndex : srd51Index);
}

describe("the resistances of the magic items of the SRD", () => {
  it("count while the item is worn, each for its own kind of damage", () => {
    expect(sheetWith("srd51", ["ring-of-resistance-fire"]).defenses.resistance).toEqual(["fire"]);
    expect(sheetWith("srd51", ["ring-of-resistance-thunder"]).defenses.resistance).toEqual([
      "thunder",
    ]);
    expect(sheetWith("srd51", ["dragon-scale-mail-silver"]).defenses.resistance).toEqual(["cold"]);
    expect(sheetWith("srd51", ["dragon-scale-mail-green"]).defenses.resistance).toEqual(["poison"]);
    expect(sheetWith("srd51", ["staff-of-frost"]).defenses.resistance).toEqual(["cold"]);
    expect(sheetWith("srd51", ["ring-of-elemental-command-earth"]).defenses.resistance).toEqual([
      "acid",
    ]);
  });

  it("do not count while the item is only carried", () => {
    expect(sheetWith("srd51", ["ring-of-resistance-fire"], false).defenses.resistance).toEqual([]);
  });

  it("add up with each other and with what the character already has", () => {
    const s = sheetWith("srd51", ["ring-of-warmth", "cloak-of-arachnida"]);
    expect([...s.defenses.resistance].sort()).toEqual(["cold", "poison"]);
  });

  it("give the periapt of proof against poison its immunity, and the poisoned condition with it", () => {
    const s = sheetWith("srd51", ["periapt-of-proof-against-poison"]);
    expect(s.defenses.immunity).toEqual(["poison"]);
    expect(s.conditionImmunities).toContain("srd51:condition/poisoned");
  });

  it("are the ones the text says and no more: the potions and the choice of the armor of resistance give none", () => {
    expect(sheetWith("srd51", ["potion-of-fire-resistance"]).defenses.resistance).toEqual([]);
    expect(sheetWith("srd51", ["armor-of-resistance"]).defenses.resistance).toEqual([]);
  });

  it("are there in the 2024 SRD for the items that name a single kind of damage", () => {
    expect(sheetWith("srd52", ["boots-of-the-winterlands"]).defenses.resistance).toEqual(["cold"]);
    expect(sheetWith("srd52", ["brooch-of-shielding"]).defenses.resistance).toEqual(["force"]);
    expect(sheetWith("srd52", ["periapt-of-proof-against-poison"]).defenses.immunity).toEqual([
      "poison",
    ]);
  });
});
