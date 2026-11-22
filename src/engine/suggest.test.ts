import { describe, expect, it } from "vitest";
import type { Ability } from "../data/schema";
import type { PendingChoice } from "./choices";
import { abilityPriority, suggestPicks, suggestSpells, suggestedBase } from "./suggest";

const choice = (over: Partial<PendingChoice>): PendingChoice => ({
  key: "k",
  source: "s",
  id: "c",
  grants: "proficiency",
  choose: 2,
  options: [],
  selected: [],
  remaining: 2,
  ...over,
});

const modifier: Record<Ability, number> = { str: -1, dex: 2, con: 1, int: 3, wis: 1, cha: 0 };
const skills: Record<string, Ability> = {
  athletics: "str",
  stealth: "dex",
  arcana: "int",
  insight: "wis",
  persuasion: "cha",
};

describe("what the build screen suggests", () => {
  it("orders the abilities of a known class, and of another by what it asks", () => {
    expect(abilityPriority("srd51:class/wizard")[0]).toBe("int");
    expect(abilityPriority("hb:class/wizard")[0]).toBe("int");
    expect(abilityPriority("hb:class/spellsword", ["str", "int"]).slice(0, 3)).toEqual([
      "str",
      "int",
      "con",
    ]);
    expect(abilityPriority(undefined)).toHaveLength(6);
  });

  it("gives the highest values to the first abilities", () => {
    const base = suggestedBase(abilityPriority("srd51:class/fighter"));
    expect(base.str).toBe(15);
    expect(base.con).toBe(14);
    expect(base.int).toBe(8);
    expect(
      suggestedBase(["dex", "str", "con", "int", "wis", "cha"], [9, 17, 12, 8, 14, 10]).dex,
    ).toBe(17);
  });

  it("picks the skills of the best abilities, never one already held", () => {
    const picks = suggestPicks(
      choice({ options: ["skill:athletics", "skill:stealth", "skill:arcana", "skill:insight"] }),
      {
        held: (o) => o === "skill:arcana",
        skillAbility: (s) => skills[s],
        modifier,
        priority: abilityPriority("srd51:class/wizard"),
      },
    );
    expect(picks).toEqual(["skill:stealth", "skill:insight"]);
  });

  it("fills languages in order and leaves feats to the person", () => {
    const ctx = {
      held: (o: string) => o === "elvish",
      skillAbility: () => undefined,
      modifier,
      priority: abilityPriority("srd51:class/wizard"),
    };
    expect(
      suggestPicks(
        choice({ grants: "language", choose: 1, remaining: 1, options: ["elvish", "dwarvish"] }),
        ctx,
      ),
    ).toEqual(["dwarvish"]);
    expect(suggestPicks(choice({ grants: "feat", options: ["a", "b"] }), ctx)).toEqual([]);
  });

  it("takes the class's favourite spells first, then the lowest levels", () => {
    const pool = [
      "srd51:spell/acid-splash",
      "srd51:spell/fire-bolt",
      "srd51:spell/mage-hand",
      "srd51:spell/fireball",
    ];
    const level = (id: string) => (id.endsWith("fireball") ? 3 : 0);
    const name = (id: string) => id.split("/").pop() ?? id;
    expect(suggestSpells("srd51:class/wizard", pool, [], 3, level, name)).toEqual([
      "srd51:spell/fire-bolt",
      "srd51:spell/mage-hand",
      "srd51:spell/acid-splash",
    ]);
    expect(
      suggestSpells("srd51:class/wizard", pool, ["srd51:spell/fire-bolt"], 2, level, name),
    ).toEqual(["srd51:spell/mage-hand"]);
  });
});
