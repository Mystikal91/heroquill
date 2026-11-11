import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter, createPlayState } from "./character";
import { deriveSheet } from "./derive";
import { type DiceRoll, parseDice, rerollDie, rollExpression } from "./dice";
import { longRest } from "./play";

describe("rolling one die again (the 2024 Heroic Inspiration)", () => {
  const roll: DiceRoll = { expression: "2d6+3", rolls: [[3, 5]], modifier: 3, total: 11 };

  it("puts the new face in place of the chosen die and changes the total", () => {
    // a random that gives 5 makes a face of 6
    const again = rerollDie(roll, 0, 1, () => 5);
    expect(again.rolls).toEqual([[3, 6]]);
    expect(again.total).toBe(12);
    expect(again.modifier).toBe(3);
    // the other die stays
    expect(rerollDie(roll, 0, 0, () => 0).rolls).toEqual([[1, 5]]);
  });

  it("uses the sides of the group the die belongs to", () => {
    const mixed = rollExpression(parseDice("1d8+1d4") ?? { terms: [], modifier: 0 }, () => 0);
    expect(mixed.rolls).toEqual([[1], [1]]);
    // 3 on a d4 is a face of 4: the d8 would have given 4 too, so ask for the highest random
    expect(rerollDie(mixed, 1, 0, (max) => max - 1).rolls).toEqual([[1], [4]]);
    expect(rerollDie(mixed, 0, 0, (max) => max - 1).rolls).toEqual([[8], [1]]);
  });

  it("gives the roll back as it was when there is no such die", () => {
    expect(rerollDie(roll, 0, 2)).toBe(roll);
    expect(rerollDie(roll, 3, 0)).toBe(roll);
  });
});

describe("Heroic Inspiration from a long rest", () => {
  const rested = (grantsInspiration?: boolean) =>
    longRest(
      createPlayState(),
      { d8: 3 },
      grantsInspiration === undefined ? {} : { grantsInspiration },
    );

  it("is given by a trait that says so, and kept when it is already there", () => {
    expect(rested().inspiration).toBe(false);
    expect(rested(true).inspiration).toBe(true);
    expect(longRest({ ...createPlayState(), inspiration: true }, { d8: 3 }).inspiration).toBe(true);
  });

  it("is what the 2024 Human's Resourceful trait is: a Human has it and a Dwarf has not", () => {
    const traits = (species: string) => {
      const c = createCharacter("srd52");
      c.choices.species = `srd52:species/${species}`;
      return deriveSheet(c, bothIndex).traits;
    };
    expect(traits("human")).toContain("srd52:trait/resourceful");
    expect(traits("dwarf")).not.toContain("srd52:trait/resourceful");
  });
});
