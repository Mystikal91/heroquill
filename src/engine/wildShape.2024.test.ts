import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import { loadSrd52Pack, srd52Packs } from "../test/srd52";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import { indexPacks } from "./derive";
import { applyDamage } from "./play";
import {
  assumeBeastKeepingHitPoints,
  beastPool,
  canAssume,
  damageBeast,
  endShapeIfDown,
  healBeast,
  trimForms,
  wildShapeLimits,
} from "./wildShape";

const index = indexPacks(...srd52Packs, loadSrd52Pack("monsters"));
const druid = classData(index.get("srd52:class/druid") as never);
const beast = (slug: string) => {
  const entry = index.get(`srd52:monster/${slug}`);
  if (!entry) throw new Error(`missing ${slug}`);
  return entry;
};

describe("the limits of the 2024 Wild Shape", () => {
  it("come from the Beast Shapes table: known forms, challenge rating, flying", () => {
    expect(wildShapeLimits(druid, 1)).toBeUndefined();
    expect(wildShapeLimits(druid, 2)).toEqual({
      maxCr: 0.25,
      swim: true,
      fly: false,
      hours: 1,
      knownForms: 4,
    });
    expect(wildShapeLimits(druid, 4)).toMatchObject({ maxCr: 0.5, knownForms: 6, fly: false });
    expect(wildShapeLimits(druid, 8)).toMatchObject({
      maxCr: 1,
      knownForms: 8,
      fly: true,
      hours: 4,
    });
  });

  it("let a beast swim from the start and fly only from level 8", () => {
    const at = (n: number) => {
      const limits = wildShapeLimits(druid, n);
      if (!limits) throw new Error("no limits");
      return limits;
    };
    expect(canAssume(beast("wolf"), at(2))).toBe(true);
    expect(canAssume(beast("crocodile"), at(4))).toBe(true);
    expect(canAssume(beast("giant-bat"), at(4))).toBe(false);
    expect(canAssume(beast("giant-bat"), at(8))).toBe(true);
    expect(canAssume(beast("riding-horse"), at(2))).toBe(true);
  });
});

describe("a 2024 shape keeps the druid's own hit points", () => {
  it("gives temporary hit points as many as the level, and the higher number stays", () => {
    const play = createPlayState();
    const shaped = assumeBeastKeepingHitPoints(play, "srd52:monster/wolf", 6);
    expect(shaped.tempHp).toBe(6);
    expect(shaped.wildShape).toMatchObject({ monster: "srd52:monster/wolf", own: true });
    expect(
      assumeBeastKeepingHitPoints({ ...play, tempHp: 9 }, "srd52:monster/wolf", 6).tempHp,
    ).toBe(9);
  });

  it("has no hit points of the beast: damage and healing do not touch the shape", () => {
    const shaped = assumeBeastKeepingHitPoints(createPlayState(), "srd52:monster/wolf", 6);
    expect(beastPool(shaped)).toBeUndefined();
    expect(damageBeast(shaped, 5)).toEqual({ play: shaped, overflow: 5 });
    expect(healBeast(shaped, 5)).toBe(shaped);
  });

  it("takes the damage off the temporary hit points first, as any damage does", () => {
    const shaped = assumeBeastKeepingHitPoints(createPlayState(), "srd52:monster/wolf", 6);
    const hit = applyDamage(shaped, 30, 4);
    expect(hit.tempHp).toBe(2);
    expect(hit.hp).toBe(30);
  });

  it("ends when the druid falls to 0 hit points, not when the temporary ones are gone", () => {
    const shaped = assumeBeastKeepingHitPoints(createPlayState(), "srd52:monster/wolf", 6);
    expect(endShapeIfDown(applyDamage(shaped, 30, 8), 30).wildShape).toBeDefined();
    expect(endShapeIfDown(applyDamage(shaped, 30, 36), 30).wildShape).toBeUndefined();
  });

  it("is a shape the saved character accepts", () => {
    const c = createCharacter("srd52");
    c.play = assumeBeastKeepingHitPoints(c.play, "srd52:monster/wolf", 6);
    c.wildShapeForms = ["srd52:monster/wolf"];
    const back = parseCharacter(JSON.parse(JSON.stringify(c)));
    expect(back.play.wildShape?.own).toBe(true);
    expect(back.wildShapeForms).toEqual(["srd52:monster/wolf"]);
  });
});

describe("the known forms", () => {
  it("lose the last ones when the table allows fewer", () => {
    expect(trimForms(["a", "b", "c"], 2)).toEqual(["a", "b"]);
    expect(trimForms(undefined, 4)).toEqual([]);
    expect(trimForms(["a"], 4)).toEqual(["a"]);
  });
});
