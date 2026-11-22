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
