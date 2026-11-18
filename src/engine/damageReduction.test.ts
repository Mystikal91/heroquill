import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const FEAT = "test:feat/heavy-armor-master" as Entry["id"];
const SHIELDED = "test:feat/stone-skin" as Entry["id"];

// Heavy Armor Master as the 2014 book has it: 3 off nonmagical bludgeoning, piercing and slashing in heavy armor.
const heavyArmorMaster: Entry = {
  id: FEAT,
  kind: "feat",
  effects: [
    {
      type: "damageReduction",
      value: 3,
      damage: ["bludgeoning", "piercing", "slashing"],
      when: "heavyArmor",
      note: "nonmagical attacks",
    },
  ],
  data: {},
};
// The 2024 one: the proficiency bonus, whatever the armor is not asked here.
const proficient: Entry = {
  id: SHIELDED,
  kind: "feat",
  effects: [{ type: "damageReduction", value: 0, plus: "proficiency", when: "heavyArmor" }],
  data: {},
};
const index = new Map<string, Entry>([
  ...srd51Index,
  [FEAT, heavyArmorMaster],
  [SHIELDED, proficient],
]);

function sheetOf(feats: string[], armor: string[], level = 5) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/fighter", level }];
  c.feats = feats;
  c.inventory = armor.map((name) => ({
    itemId: `srd51:item/${name}`,
    quantity: 1,
    equipped: true,
  }));
  return deriveSheet(c, index);
}

describe("damage reduction", () => {
  it("is in force while heavy armor is worn, with what it covers and its note", () => {
    const s = sheetOf([FEAT], ["plate-armor"]);
    expect(s.damageReductions).toEqual([
      {
        source: FEAT,
        amount: 3,
        damage: ["bludgeoning", "piercing", "slashing"],
        note: "nonmagical attacks",
      },
    ]);
  });

  it("is not in force in light or medium armor, or in none", () => {
    expect(sheetOf([FEAT], ["leather-armor"]).damageReductions).toEqual([]);
    expect(sheetOf([FEAT], ["chain-shirt"]).damageReductions).toEqual([]);
    expect(sheetOf([FEAT], []).damageReductions).toEqual([]);
  });

  it("adds the proficiency bonus when the effect says so, and follows the level", () => {
    expect(sheetOf([SHIELDED], ["plate-armor"], 5).damageReductions[0]?.amount).toBe(3);
    expect(sheetOf([SHIELDED], ["plate-armor"], 9).damageReductions[0]?.amount).toBe(4);
  });

  it("is nothing for a character who has no such feat", () => {
    expect(sheetOf([], ["plate-armor"]).damageReductions).toEqual([]);
  });
});
