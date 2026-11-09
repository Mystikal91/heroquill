import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const ARMED = (item: string) => [{ itemId: item, quantity: 1, equipped: true }];

/** A 2014 character of a species, with a weapon in hand. */
function oldRules(species: string, weapon: string) {
  const c = createCharacter("srd51");
  c.choices.species = `srd51:species/${species}`;
  c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  c.inventory = ARMED(`srd51:item/${weapon}`);
  return deriveSheet(c, bothIndex);
}

/** A 2024 Human with the given Strength and Dexterity and a weapon in hand. */
function newRules(str: number, dex: number, weapon: string, size?: string) {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  if (size) c.selections["srd52:species/human/size"] = [size];
  c.abilityBase = { str, dex, con: 13, int: 12, wis: 10, cha: 8 };
  c.inventory = ARMED(`srd52:item/${weapon}`);
  return deriveSheet(c, bothIndex);
}

const heavyWarnings = (sheet: { warnings: { code: string }[] }) =>
  sheet.warnings.filter((w) => w.code === "heavySmall" || w.code === "heavyScore");

describe("a Heavy weapon in the 2014 rules: Small creatures have disadvantage", () => {
  it("is flagged for a Halfling with a greatsword, on the attack and in the notes", () => {
    const sheet = oldRules("halfling", "greatsword");
    expect(sheet.attacks[0]?.heavy).toBe("small");
    expect(heavyWarnings(sheet)).toEqual([
      { code: "heavySmall", params: { item: "srd51:item/greatsword" } },
    ]);
  });

  it("is not flagged for a Medium creature, nor for a weapon that is not Heavy", () => {
    expect(oldRules("human", "greatsword").attacks[0]?.heavy).toBeUndefined();
    expect(oldRules("halfling", "longsword").attacks[0]?.heavy).toBeUndefined();
    expect(heavyWarnings(oldRules("halfling", "shortsword"))).toEqual([]);
  });

  it("does not change the attack bonus: it is only a warning", () => {
    // No class, so no proficiency: the bonus is the Strength modifier, flagged or not.
    const sheet = oldRules("halfling", "greatsword");
    expect(sheet.attacks[0]?.heavy).toBe("small");
    expect(sheet.attacks[0]?.attackBonus).toBe(sheet.abilities.str.modifier);
  });
});

describe("a Heavy weapon in the 2024 rules: the score that fits the weapon", () => {
  it("asks Strength 13 for a Melee weapon", () => {
    expect(newRules(12, 14, "greatsword").attacks[0]?.heavy).toBe("str");
    expect(newRules(13, 8, "greatsword").attacks[0]?.heavy).toBeUndefined();
    expect(heavyWarnings(newRules(12, 14, "greatsword"))).toEqual([
      { code: "heavyScore", params: { item: "srd52:item/greatsword", ability: "str" } },
    ]);
  });

  it("asks Dexterity 13 for a Ranged weapon, not Strength", () => {
    expect(newRules(15, 12, "longbow").attacks[0]?.heavy).toBe("dex");
    expect(newRules(8, 13, "longbow").attacks[0]?.heavy).toBeUndefined();
  });

  it("does not care about size, which the 2014 rule used", () => {
    expect(newRules(15, 14, "greatsword", "small").attacks[0]?.heavy).toBeUndefined();
  });

  it("says nothing for a weapon that is not Heavy", () => {
    expect(heavyWarnings(newRules(8, 8, "shortsword"))).toEqual([]);
  });
});
