import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { endConcentration, longRest, setSpellActive, startConcentration } from "./play";

const MAGE_ARMOR = "srd51:spell/mage-armor";
const FAITH = "srd51:spell/shield-of-faith";

function sheetOf(active: string[], armor: string[] = [], ruleset: "srd51" | "srd52" = "srd51") {
  const c = createCharacter(ruleset);
  c.classes = [{ classId: `${ruleset}:class/wizard`, level: 5 }];
  c.choices.species = `${ruleset}:species/human`;
  c.abilityBase = { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 };
  c.inventory = armor.map((name) => ({
    itemId: `${ruleset}:item/${name}`,
    quantity: 1,
    equipped: true,
  }));
  if (active.length > 0) c.play.activeSpells = active;
  return deriveSheet(c, ruleset === "srd52" ? bothIndex : srd51Index);
}

describe("the effect of a spell that is turned on", () => {
  it("does nothing while it is off, and Mage Armor makes the armor class 13 + Dexterity while it is on", () => {
    const bare = sheetOf([]);
    const dex = bare.abilities.dex.modifier;
    expect(bare.armorClass.value).toBe(10 + dex);
    expect(sheetOf([MAGE_ARMOR]).armorClass.value).toBe(13 + dex);
  });

  it("leaves armor that is worn as it is: Mage Armor is for whoever wears none", () => {
    const plain = sheetOf([], ["chain-mail"]).armorClass.value;
    expect(sheetOf([MAGE_ARMOR], ["chain-mail"]).armorClass.value).toBe(plain);
  });

  it("adds the bonus of Shield of Faith to any armor class", () => {
    const base = sheetOf([]).armorClass.value;
    expect(sheetOf([FAITH]).armorClass.value).toBe(base + 2);
    expect(sheetOf([FAITH, MAGE_ARMOR]).armorClass.value).toBe(base + 5);
  });

  it("adds the speed of Longstrider and the bonus of Shield", () => {
    const base = sheetOf([]);
    expect(sheetOf(["srd51:spell/longstrider"]).speed).toBe((base.speed ?? 0) + 10);
    expect(sheetOf(["srd51:spell/shield"]).armorClass.value).toBe(base.armorClass.value + 5);
  });

  it("is the same in the 2024 SRD", () => {
    const base = sheetOf([], [], "srd52").armorClass.value;
    expect(sheetOf(["srd52:spell/mage-armor"], [], "srd52").armorClass.value).toBe(base + 3);
  });

  it("ignores a spell that has no effect", () => {
    expect(sheetOf(["srd51:spell/fireball"]).armorClass.value).toBe(sheetOf([]).armorClass.value);
  });
});

describe("keeping a spell on", () => {
  const play = () => createCharacter("srd51").play;

  it("turns it on and off, once", () => {
    const on = setSpellActive(setSpellActive(play(), MAGE_ARMOR, true), MAGE_ARMOR, true);
    expect(on.activeSpells).toEqual([MAGE_ARMOR]);
    expect(setSpellActive(on, MAGE_ARMOR, false).activeSpells).toBeUndefined();
  });

  it("ends with a long rest", () => {
    const on = setSpellActive(play(), MAGE_ARMOR, true);
    expect(longRest(on, {}).activeSpells).toBeUndefined();
  });

  it("ends with the concentration on that spell, and not with another one's", () => {
    const held = startConcentration(setSpellActive(play(), FAITH, true), FAITH);
    expect(endConcentration(held).activeSpells).toBeUndefined();
    const other = startConcentration(
      setSpellActive(setSpellActive(play(), FAITH, true), MAGE_ARMOR, true),
      FAITH,
    );
    expect(endConcentration(other).activeSpells).toEqual([MAGE_ARMOR]);
  });
});
