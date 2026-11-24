import { describe, expect, it } from "vitest";
import { chooseRules, createCharacter, rulesToChoose } from "../engine/character";
import { editionsIn } from "./edition";

describe("the edition of a character", () => {
  it("offers only the editions whose rules are loaded, 2014 first", () => {
    expect(editionsIn(["srd51"])).toEqual(["srd51"]);
    expect(editionsIn(["srd52", "custom", "srd51"])).toEqual(["srd51", "srd52"]);
    expect(editionsIn([])).toEqual([]);
  });

  it("is to choose for a new character and for a blank one of before, not for one with choices", () => {
    expect(rulesToChoose({ ...createCharacter("srd51"), rulesPending: true, name: "Elowen" })).toBe(
      true,
    );
    expect(rulesToChoose(createCharacter("srd51"))).toBe(true);
    expect(rulesToChoose({ ...createCharacter("srd51"), name: "Elowen" })).toBe(false);
  });

  it("is chosen once", () => {
    const c = { ...createCharacter("srd51"), rulesPending: true };
    c.inventory = [{ itemId: "srd51:item/club", quantity: 1, equipped: false }];
    chooseRules(c, "srd52");
    expect(c.ruleset).toBe("srd52");
    expect(c.inventory).toEqual([]);
    expect(rulesToChoose(c)).toBe(false);
    chooseRules(c, "srd51");
    expect(c.ruleset).toBe("srd52");
  });
});
