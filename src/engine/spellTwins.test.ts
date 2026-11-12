import { describe, expect, it } from "vitest";
import type { Effect } from "../data/schema";
import { bothIndex } from "../test/srd52";
import { localizeSpells, spellFor2024 } from "./rulesets";

describe("2014 spells in a book, on a 2024 character", () => {
  it("become the 2024 spell of the same name, and stay when the 2024 SRD lacks it", () => {
    expect(spellFor2024("srd51:spell/fireball", bothIndex)).toBe("srd52:spell/fireball");
    expect(spellFor2024("srd51:spell/feeblemind", bothIndex)).toBe("srd51:spell/feeblemind");
    expect(spellFor2024("imp1:spell/homebrew", bothIndex)).toBe("imp1:spell/homebrew");
  });

  it("are changed inside an effect, a granted spell and a list of choices alike", () => {
    const grant = { type: "grantSpell", spell: "srd51:spell/shield" } as Effect;
    expect(localizeSpells(grant, bothIndex)).toEqual({
      type: "grantSpell",
      spell: "srd52:spell/shield",
    });
    const choice = {
      type: "choice",
      id: "pick",
      choose: 1,
      grants: "spell",
      from: ["srd51:spell/shield", "srd51:spell/feeblemind"],
    } as Effect;
    expect(localizeSpells(choice, bothIndex)).toMatchObject({
      from: ["srd52:spell/shield", "srd51:spell/feeblemind"],
    });
  });
});
