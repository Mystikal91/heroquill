import { describe, expect, it } from "vitest";
import {
  type Character,
  chooseRules,
  createCharacter,
  isBlank,
  rulesToChoose,
  withRulesFlag,
} from "../engine/character";
import { parseCharacter } from "../engine/characterSchema";
import { NO_COINS } from "../engine/coins";
import { editionsIn } from "./edition";

const pending = (): Character => ({ ...createCharacter("srd51"), rulesPending: true });

describe("the edition of a character", () => {
  it("offers only the editions whose rules are loaded, 2014 first", () => {
    expect(editionsIn(["srd51"])).toEqual(["srd51"]);
    expect(editionsIn(["srd52", "custom", "srd51"])).toEqual(["srd51", "srd52"]);
    expect(editionsIn([])).toEqual([]);
  });

  it("is to choose for a new character and for a blank one of before, not for one with choices", () => {
    expect(rulesToChoose({ ...pending(), name: "Elowen" })).toBe(true);
    expect(rulesToChoose(createCharacter("srd51"))).toBe(true);
    expect(rulesToChoose({ ...createCharacter("srd51"), name: "Elowen" })).toBe(false);
    const made = { ...pending(), choices: { species: "srd51:species/elf" } };
    expect(rulesToChoose(made)).toBe(false);
    chooseRules(made, "srd52");
    expect(made.ruleset).toBe("srd51");
  });

  it("stays to choose when a blank one of before is opened and then named", () => {
    const opened = withRulesFlag(createCharacter("srd51"));
    expect(rulesToChoose({ ...opened, name: "Elowen" })).toBe(true);
    const named = withRulesFlag({ ...createCharacter("srd51"), name: "Elowen" });
    expect(named.rulesPending).toBeUndefined();
  });

  it("is chosen once", () => {
    const c = pending();
    chooseRules(c, "srd52");
    expect(c.ruleset).toBe("srd52");
    expect(rulesToChoose(c)).toBe(false);
    chooseRules(c, "srd51");
    expect(c.ruleset).toBe("srd52");
  });

  it("drops what came from the other edition and keeps the person's own and the packs'", () => {
    const c = pending();
    const line = { quantity: 1, equipped: false };
    c.inventory = [
      { ...line, itemId: "srd51:item/club" },
      { ...line, itemId: "mine:item/blade", enchantment: "srd51:item/weapon-1" },
      { ...line, itemId: "free-1", custom: { name: "A letter" } },
    ];
    c.companions = [
      { id: "a", monster: "srd51:monster/wolf" },
      { id: "b", monster: "mine:monster/wisp" },
    ];
    c.play.conditions = ["srd51:condition/poisoned"];
    c.play.inspiration = true;
    c.feats = ["srd51:feat/grappler"];
    c.selections = { "srd51:class/wizard/skills": ["arcana"] };
    chooseRules(c, "srd52");
    expect(c.inventory).toEqual([
      { ...line, itemId: "mine:item/blade" },
      { ...line, itemId: "free-1", custom: { name: "A letter" } },
    ]);
    expect(c.companions?.map((one) => one.id)).toEqual(["b"]);
    expect(c.play.conditions).toEqual([]);
    expect(c.play.inspiration).toBe(true);
    expect([c.feats, c.selections]).toEqual([[], {}]);
    expect(JSON.stringify(c)).not.toContain("srd51:");
  });

  it("a character is blank only with nothing in it", () => {
    expect(isBlank(pending())).toBe(true);
    const filled: Partial<Character>[] = [
      { name: "Elowen" },
      { portrait: "data:," },
      { coins: { ...NO_COINS, gp: 5 } },
      { feats: ["mine:feat/x"] },
      { overrides: { "ability.int": 20 } },
      { story: { ...pending().story, backstory: "Once" } },
    ];
    for (const part of filled) expect(isBlank({ ...pending(), ...part })).toBe(false);
  });

  it("drops nothing when the rules are the ones it had", () => {
    const c = pending();
    c.inventory = [{ itemId: "srd51:item/club", quantity: 1, equipped: false }];
    chooseRules(c, "srd51");
    expect(c.inventory).toHaveLength(1);
  });

  it("has its flag read back as it was saved", () => {
    for (const rulesPending of [true, false, undefined]) {
      const c = { ...createCharacter("srd52"), rulesPending };
      expect(parseCharacter(JSON.parse(JSON.stringify(c))).rulesPending).toBe(rulesPending);
    }
  });
});
