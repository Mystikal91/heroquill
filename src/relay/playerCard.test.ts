import { describe, expect, it } from "vitest";
import { makeCard, sameCard } from "./playerCard";
import { readCard } from "./protocol";

const input = {
  name: "  Aria ",
  hp: 9,
  maxHp: 12,
  tempHp: 0,
  ac: 15,
  speed: 30,
  conditions: ["Prone"],
};

describe("makeCard", () => {
  it("keeps only what the DM needs and trims the name", () => {
    expect(makeCard(input)).toEqual({
      name: "Aria",
      hp: 9,
      maxHp: 12,
      tempHp: 0,
      ac: 15,
      speed: 30,
      conditions: ["Prone"],
    });
  });

  it("leaves the speed out when there is none and never goes below zero", () => {
    const card = makeCard({ ...input, speed: undefined, hp: -3, maxHp: 0 });
    expect(card).not.toHaveProperty("speed");
    expect(card.hp).toBe(0);
    expect(card.maxHp).toBe(1);
  });

  it("is a card the room accepts", () => {
    expect(readCard(makeCard(input))).toBeDefined();
  });

  it("tells a change from none", () => {
    const card = makeCard(input);
    expect(sameCard(card, makeCard(input))).toBe(true);
    expect(sameCard(card, makeCard({ ...input, hp: 8 }))).toBe(false);
    expect(sameCard(undefined, card)).toBe(false);
  });
});

describe("the numbers at a glance", () => {
  const full = {
    ...input,
    initiativeBonus: 2,
    passivePerception: 12,
    passiveInvestigation: 11,
    passiveInsight: 10,
    proficiency: 2,
    martialDc: 12,
    spellDc: 13,
    spellAttack: 5,
    critRange: 19,
    attunedUsed: 1,
    attunedMax: 3,
    senses: [["Darkvision", "60 ft"]] as [string, string][],
    defenses: [["Resistances", "Fire"]] as [string, string][],
  };

  it("carries them, and the room reads them back as they are", () => {
    const card = makeCard(full);
    expect(readCard(card)).toEqual(card);
    expect(card).toMatchObject({ martialDc: 12, spellAttack: 5, critRange: 19, attunedMax: 3 });
  });

  it("leaves out a normal critical range and attunement nobody uses", () => {
    const card = makeCard({ ...full, critRange: 20, attunedUsed: 0 });
    expect(card).not.toHaveProperty("critRange");
    expect(card).not.toHaveProperty("attunedMax");
  });

  it("cuts a list that is too long", () => {
    const many = Array.from({ length: 30 }, (_, i) => [`Sense ${i}`, "30 ft"] as [string, string]);
    expect(readCard({ ...makeCard(full), senses: many })?.senses).toHaveLength(10);
  });
});
