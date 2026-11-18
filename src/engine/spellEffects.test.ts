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

  it("makes Barkskin a floor of 16: it lifts a lower armor class, in armor or out of it, and changes nothing above it", () => {
    const bark = "srd51:spell/barkskin";
    expect(sheetOf([bark]).armorClass.value).toBe(16);
    expect(sheetOf([bark], ["leather-armor"]).armorClass.value).toBe(16);
    // Chain mail is 16 already, plate 18: the spell does nothing.
    const chain = sheetOf([], ["chain-mail"]).armorClass.value;
    expect(sheetOf([bark], ["chain-mail"]).armorClass.value).toBe(Math.max(chain, 16));
    expect(sheetOf([bark], ["plate-armor"]).armorClass.value).toBe(18);
  });

  it("lets the bonuses come on top of the floor of Barkskin, and says where the difference comes from", () => {
    const s = sheetOf([FAITH, "srd51:spell/barkskin"]);
    expect(s.armorClass.value).toBe(18);
    expect(s.armorClass.parts.some((p) => p.feature === "srd51:spell/barkskin")).toBe(true);
    expect(s.armorClass.parts.reduce((sum, p) => sum + p.value, 0)).toBe(18);
  });

  it("is 17 in the 2024 SRD", () => {
    expect(sheetOf(["srd52:spell/barkskin"], [], "srd52").armorClass.value).toBe(17);
  });

  it("makes Haste double the speed and add 2 to the armor class, in both editions", () => {
    for (const [ruleset, id] of [
      ["srd51", "srd51:spell/haste"],
      ["srd52", "srd52:spell/haste"],
    ] as const) {
      const base = sheetOf([], [], ruleset);
      const hasted = sheetOf([id], [], ruleset);
      expect(hasted.speed).toBe((base.speed ?? 0) * 2);
      expect(hasted.armorClass.value).toBe(base.armorClass.value + 2);
      // The swimming and climbing speeds follow the walking one.
      expect(hasted.movement.swim?.feet).toBe(
        base.movement.swim?.feet ? base.movement.swim.feet * 2 : undefined,
      );
    }
  });

  it("gives Bless a d4 on attack rolls and saving throws", () => {
    expect(sheetOf(["srd51:spell/bless"]).rollDice).toEqual([
      { die: 4, on: ["attack", "save"], source: "srd51:spell/bless" },
    ]);
    expect(sheetOf([]).rollDice).toEqual([]);
  });

  it("adds 5 to the hit point maximum with Aid, in both editions", () => {
    for (const [ruleset, id] of [
      ["srd51", "srd51:spell/aid"],
      ["srd52", "srd52:spell/aid"],
    ] as const) {
      const base = sheetOf([], [], ruleset).hitPoints.max;
      expect(sheetOf([id], [], ruleset).hitPoints.max).toBe(base + 5);
    }
  });

  it("gives Guidance one d4 on an ability check, spent by it", () => {
    expect(sheetOf(["srd51:spell/guidance"]).rollDice).toEqual([
      { die: 4, on: ["check"], source: "srd51:spell/guidance", once: true },
    ]);
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
