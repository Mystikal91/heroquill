import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import {
  canCreateSlot,
  convertSlot,
  createSlot,
  longRest,
  resourceLeft,
  setResourceUsed,
  slotsLeft,
} from "./play";

function sorcerer(level: number, play: (c: ReturnType<typeof createCharacter>) => void = () => {}) {
  const c = createCharacter("srd51");
  c.choices.species = "srd51:species/human";
  c.classes = [{ classId: "srd51:class/sorcerer", level }];
  play(c);
  const sheet = deriveSheet(c, srd51Index);
  const resource = sheet.resources.find((r) => r.kind === "sorceryPoints");
  if (!resource) throw new Error("no sorcery points");
  return { c, sheet, pool: { id: resource.id, max: resource.max } };
}

describe("Flexible Casting", () => {
  it("makes a slot from sorcery points, at the price of the table", () => {
    const { c, pool } = sorcerer(5);
    expect(pool.max).toBe(5);
    expect(canCreateSlot(c.play, 3, pool)).toBe(true);
    expect(canCreateSlot(c.play, 4, pool)).toBe(false);
    const made = createSlot(c.play, 3, pool);
    expect(resourceLeft(made, pool.id, pool.max)).toBe(0);
    expect(made.createdSlots?.[2]).toBe(1);
  });

  it("does nothing when the points do not reach, and never above the 5th level", () => {
    const { c, pool } = sorcerer(2);
    expect(createSlot(c.play, 2, pool)).toBe(c.play);
    expect(createSlot(c.play, 3, pool)).toBe(c.play);
    const rich = sorcerer(20);
    expect(canCreateSlot(rich.c.play, 6, rich.pool)).toBe(false);
    expect(createSlot(rich.c.play, 6, rich.pool)).toBe(rich.c.play);
  });

  it("the slot made shows among the slots of the sheet and is spent like any", () => {
    const { c, pool } = sorcerer(5);
    const before = deriveSheet(c, srd51Index).spellSlots;
    c.play = createSlot(c.play, 1, pool);
    const after = deriveSheet(c, srd51Index);
    expect(after.spellSlots[0]).toBe((before[0] ?? 0) + 1);
    expect(slotsLeft(c.play, 1, after.spellSlots[0] ?? 0)).toBe((before[0] ?? 0) + 1);
  });

  it("a long rest takes the made slots away", () => {
    const { c, pool } = sorcerer(5);
    c.play = createSlot(c.play, 1, pool);
    const rested = longRest(c.play, {});
    expect(rested.createdSlots).toBeUndefined();
  });

  it("turns a slot into as many points as its level, but never past the maximum", () => {
    const { c, sheet, pool } = sorcerer(5, (ch) => {
      ch.play = setResourceUsed(ch.play, "sorceryPoints:sorcerer", 4, 5);
    });
    const total = sheet.spellSlots[2] ?? 0;
    expect(total).toBeGreaterThan(0);
    // 4 spent, 1 left: a 3rd-level slot gives 3 points, 4 left.
    const turned = convertSlot(c.play, 3, total, pool);
    expect(resourceLeft(turned, pool.id, pool.max)).toBe(4);
    expect(slotsLeft(turned, 3, total)).toBe(total - 1);
    // Only 1 point is missing: the slot gives 1 and no more.
    const nearly = setResourceUsed(c.play, pool.id, 1, pool.max);
    const full = convertSlot(nearly, 3, total, pool);
    expect(resourceLeft(full, pool.id, pool.max)).toBe(5);
  });

  it("keeps the slot when no point would be gained, and when there is none left", () => {
    const { c, sheet, pool } = sorcerer(5);
    const total = sheet.spellSlots[2] ?? 0;
    // Full of points: nothing to gain.
    expect(convertSlot(c.play, 3, total, pool)).toBe(c.play);
    const spent = setResourceUsed(c.play, pool.id, 5, pool.max);
    let play = spent;
    for (let i = 0; i < total; i++) play = convertSlot(play, 3, total, pool);
    expect(slotsLeft(play, 3, total)).toBe(0);
    expect(convertSlot(play, 3, total, pool)).toBe(play);
  });
});
