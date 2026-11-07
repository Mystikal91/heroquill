import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const STYLE = "srd52:feature/fighter-fighting-style/fighting-style";
const SECOND_STYLE = "srd52:subclass/champion"; // the Champion's own feature is below
const MORE_STYLE = "srd52:feature/champion-additional-fighting-style/fighting-style";
const BOON = "srd52:feature/fighter-epic-boon/epic-boon";

function fighter(level: number, subclass = true) {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/soldier";
  c.classes = [
    {
      classId: "srd52:class/fighter",
      level,
      ...(subclass && level >= 3 && { subclassId: SECOND_STYLE }),
    },
  ];
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  return c;
}

const usesOf = (level: number, feature: string) =>
  deriveSheet(fighter(level), bothIndex).resources.find(
    (r) => r.entry === `srd52:feature/${feature}`,
  );

describe("a 2024 Fighter", () => {
  it("picks a Fighting Style feat from the four of the SRD", () => {
    const pick = deriveSheet(fighter(1), bothIndex).choices.find((c) => c.key === STYLE);
    expect(pick?.choose).toBe(1);
    expect([...(pick?.options ?? [])].sort()).toEqual([
      "srd52:feat/archery",
      "srd52:feat/defense",
      "srd52:feat/great-weapon-fighting",
      "srd52:feat/two-weapon-fighting",
    ]);
  });

  it("gets +1 armor class from Defense only while wearing armor", () => {
    const c = fighter(1);
    c.selections[STYLE] = ["srd52:feat/defense"];
    c.inventory = [{ itemId: "srd51:item/chain-mail", quantity: 1, equipped: true }];
    const worn = deriveSheet(c, bothIndex).armorClass.value;
    const without = fighter(1);
    without.selections[STYLE] = ["srd52:feat/archery"];
    without.inventory = [{ itemId: "srd51:item/chain-mail", quantity: 1, equipped: true }];
    expect(worn).toBe(deriveSheet(without, bothIndex).armorClass.value + 1);
    // No armor: no bonus.
    const bare = fighter(1);
    bare.selections[STYLE] = ["srd52:feat/defense"];
    const bareArmorless = fighter(1);
    expect(deriveSheet(bare, bothIndex).armorClass.value).toBe(
      deriveSheet(bareArmorless, bothIndex).armorClass.value,
    );
  });

  it("adds 2 to ranged attacks with Archery and not to melee ones", () => {
    const c = fighter(1);
    c.selections[STYLE] = ["srd52:feat/archery"];
    c.inventory = [
      { itemId: "srd52:item/longbow", quantity: 1, equipped: true },
      { itemId: "srd52:item/longsword", quantity: 1, equipped: true },
    ];
    const sheet = deriveSheet(c, bothIndex);
    const bow = sheet.attacks.find((a) => a.itemId === "srd52:item/longbow");
    const sword = sheet.attacks.find((a) => a.itemId === "srd52:item/longsword");
    // Dexterity +2 and proficiency +2, then the style; the sword is Strength +2 and proficiency +2.
    expect(bow?.attackBonus).toBe(6);
    expect(sword?.attackBonus).toBe(4);
  });

  it("gives the Champion a second Fighting Style at level 7", () => {
    expect(deriveSheet(fighter(6), bothIndex).choices.some((c) => c.key === MORE_STYLE)).toBe(
      false,
    );
    const second = deriveSheet(fighter(7), bothIndex).choices.find((c) => c.key === MORE_STYLE);
    expect(second?.options.length).toBe(4);
  });

  it("picks an Epic Boon at level 19, and not before", () => {
    expect(deriveSheet(fighter(18), bothIndex).choices.some((c) => c.key === BOON)).toBe(false);
    const boon = deriveSheet(fighter(19), bothIndex).choices.find((c) => c.key === BOON);
    expect(boon?.options.length).toBe(7);
  });

  it("counts Second Wind, Action Surge and Indomitable by level", () => {
    expect(usesOf(1, "fighter-second-wind")?.max).toBe(2);
    expect(usesOf(4, "fighter-second-wind")?.max).toBe(3);
    expect(usesOf(10, "fighter-second-wind")?.max).toBe(4);
    expect(usesOf(1, "fighter-action-surge")).toBeUndefined();
    expect(usesOf(2, "fighter-action-surge")?.max).toBe(1);
    expect(usesOf(17, "fighter-action-surge")?.max).toBe(2);
    expect(usesOf(8, "fighter-indomitable")).toBeUndefined();
    expect(usesOf(9, "fighter-indomitable")?.max).toBe(1);
    expect(usesOf(13, "fighter-indomitable")?.max).toBe(2);
    expect(usesOf(17, "fighter-indomitable")?.max).toBe(3);
  });

  it("gives Alert's proficiency bonus on initiative", () => {
    const plain = deriveSheet(fighter(5), bothIndex).initiative;
    const c = fighter(5);
    c.feats = ["srd52:feat/alert"];
    expect(deriveSheet(c, bothIndex).initiative).toBe(plain + 3);
  });

  it("offers only General feats for a free pick, never the ability score increase itself", () => {
    const general = [...bothIndex.values()].filter(
      (e) => e.id.startsWith("srd52:feat/") && e.data.category === "general",
    );
    expect(general.map((e) => e.id).sort()).toEqual([
      "srd52:feat/ability-score-improvement",
      "srd52:feat/grappler",
    ]);
    expect(bothIndex.get("srd52:feat/ability-score-improvement")?.data.builtIn).toBe(true);
  });

  it("keeps the level a feat asks for in the form the pickers read", () => {
    expect(bothIndex.get("srd52:feat/grappler")?.data.prerequisites).toEqual([
      { type: "level", level: 4 },
    ]);
  });
});
