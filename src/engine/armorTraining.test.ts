import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { armorMode } from "./exhaustion";

function worn(ruleset: "srd51" | "srd52", cls: string, items: string[]) {
  const c = createCharacter(ruleset);
  c.classes = [{ classId: `${ruleset}:class/${cls}`, level: 1 }];
  c.inventory = items.map((name) => ({
    itemId: `${ruleset}:item/${name}`,
    quantity: 1,
    equipped: true,
  }));
  return deriveSheet(c, ruleset === "srd52" ? bothIndex : srd51Index).armorClass.untrained;
}

describe("armor worn without training", () => {
  it("is known for armor and for a shield, in both editions", () => {
    for (const ruleset of ["srd51", "srd52"] as const) {
      expect(worn(ruleset, "wizard", ["chain-mail"]), `${ruleset} wizard in chain mail`).toBe(true);
      expect(worn(ruleset, "wizard", ["shield"]), `${ruleset} wizard with a shield`).toBe(true);
      expect(worn(ruleset, "wizard", []), `${ruleset} wizard unarmored`).toBe(false);
      expect(worn(ruleset, "fighter", ["chain-mail", "shield"]), `${ruleset} fighter`).toBe(false);
    }
  });

  it("follows the armor: a Cleric has Medium armor and no Heavy armor", () => {
    expect(worn("srd51", "cleric", ["scale-mail"])).toBe(false);
    expect(worn("srd51", "cleric", ["plate-armor"])).toBe(true);
  });
});

describe("the roll in armor worn without training", () => {
  it("is made with disadvantage when it uses Strength or Dexterity", () => {
    expect(armorMode(true, "check", "str", "normal")).toBe("disadvantage");
    expect(armorMode(true, "attack", "dex", "normal")).toBe("disadvantage");
    expect(armorMode(true, "save", "dex", "normal")).toBe("disadvantage");
  });

  it("leaves the other abilities alone, and a roll of no kind", () => {
    expect(armorMode(true, "save", "con", "normal")).toBe("normal");
    expect(armorMode(true, "check", "int", "advantage")).toBe("advantage");
    expect(armorMode(true, undefined, "str", "normal")).toBe("normal");
    expect(armorMode(true, "check", undefined, "normal")).toBe("normal");
  });

  it("cancels an advantage, and does nothing for a character who is trained", () => {
    expect(armorMode(true, "check", "str", "advantage")).toBe("normal");
    expect(armorMode(false, "check", "str", "normal")).toBe("normal");
  });
});
