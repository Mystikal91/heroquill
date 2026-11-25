import { describe, expect, it } from "vitest";
import { createPlayState } from "./character";
import {
  applyDamage,
  applyHealing,
  currentHp,
  deathSaveRoll,
  deathStatus,
  gainTempHp,
  hitDiceLeft,
  longRest,
  revive,
  setDeathSave,
  setSlotsUsed,
  shortRest,
  slotsLeft,
  spendHitDie,
  toggleCondition,
} from "./play";

const MAX = 20;

describe("hit points", () => {
  it("is full until something changes it, and never above the maximum", () => {
    expect(currentHp(createPlayState(), MAX)).toBe(20);
    expect(currentHp({ ...createPlayState(), hp: 99 }, MAX)).toBe(20);
  });

  it("takes damage on temporary hit points first", () => {
    const start = { ...createPlayState(), tempHp: 5 };
    const hit = applyDamage(start, MAX, 8);
    expect(hit.tempHp).toBe(0);
    expect(currentHp(hit, MAX)).toBe(17);
  });

  it("stops at 0 and marks no failure for the hit that drops you", () => {
    const down = applyDamage(createPlayState(), MAX, 25);
    expect(currentHp(down, MAX)).toBe(0);
    expect(down.deathSaves.failures).toBe(0);
    expect(deathStatus(down, MAX)).toBe("dying");
  });

  it("counts damage at 0 hit points as a failed death save", () => {
    const down = applyDamage(createPlayState(), MAX, 20);
    const again = applyDamage(down, MAX, 3);
    expect(again.deathSaves.failures).toBe(1);
  });

  it("kills outright when the damage left over is at least the maximum", () => {
    const start = { ...createPlayState(), hp: 5 };
    expect(deathStatus(applyDamage(start, MAX, 5 + MAX), MAX)).toBe("dead");
    expect(deathStatus(applyDamage(start, MAX, 5 + MAX - 1), MAX)).toBe("dying");
  });

  it("heals up to the maximum and ends dying", () => {
    const down = applyDamage(createPlayState(), MAX, 30);
    const up = applyHealing(setDeathSave(down, "successes", 2), MAX, 4);
    expect(currentHp(up, MAX)).toBe(4);
    expect(up.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(currentHp(applyHealing(up, MAX, 100), MAX)).toBe(20);
  });

  it("cannot heal the dead", () => {
    const dead = setDeathSave(applyDamage(createPlayState(), MAX, 20), "failures", 3);
    expect(currentHp(applyHealing(dead, MAX, 10), MAX)).toBe(0);
  });

  it("keeps the larger of two temporary hit point amounts", () => {
    const some = gainTempHp(createPlayState(), 6);
    expect(gainTempHp(some, 3).tempHp).toBe(6);
    expect(gainTempHp(some, 9).tempHp).toBe(9);
  });

  it("becomes stable after three successes and dead after three failures", () => {
    const down = applyDamage(createPlayState(), MAX, 20);
    expect(deathStatus(setDeathSave(down, "successes", 3), MAX)).toBe("stable");
    expect(deathStatus(setDeathSave(down, "failures", 3), MAX)).toBe("dead");
    expect(setDeathSave(down, "failures", 9).deathSaves.failures).toBe(3);
  });
});

describe("slots and hit dice", () => {
  it("tracks slots left and never goes outside 0..total", () => {
    const play = setSlotsUsed(createPlayState(), 2, 5, 3);
    expect(play.slotsUsed[1]).toBe(3);
    expect(slotsLeft(play, 2, 3)).toBe(0);
    expect(slotsLeft(setSlotsUsed(play, 2, -4, 3), 2, 3)).toBe(3);
  });

  it("spends a hit die for the roll plus Constitution, even at full health", () => {
    const hurt = applyDamage(createPlayState(), MAX, 12); // 8 hp
    const rested = spendHitDie(hurt, MAX, "d8", 5, 2);
    expect(currentHp(rested, MAX)).toBe(15);
    expect(hitDiceLeft(rested, "d8", 3)).toBe(2);
    expect(spendHitDie(createPlayState(), MAX, "d8", 1, -3).hitDiceUsed.d8).toBe(1);
  });

  it("gives warlocks their slots back on a short rest, and nobody else", () => {
    const spent = setSlotsUsed(createPlayState(), 1, 2, 2);
    expect(shortRest(spent, "all").slotsUsed[0]).toBe(0);
    expect(shortRest(spent, "none").slotsUsed[0]).toBe(2);
    expect(shortRest(spent, "pact").slotsUsed[0]).toBe(2);
  });
});

describe("long rest", () => {
  it("restores hit points, slots and death saves, and clears temporary hit points", () => {
    let play = applyDamage({ ...createPlayState(), tempHp: 4 }, MAX, 19);
    play = setSlotsUsed(play, 1, 2, 4);
    play = setDeathSave(play, "failures", 2);
    const rested = longRest(play, { d8: 4 });
    expect(rested.hp).toBeUndefined();
    expect(rested.tempHp).toBe(0);
    expect(rested.slotsUsed).toEqual(Array(9).fill(0));
    expect(rested.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("regains half the hit dice, at least one, largest first", () => {
    const used = { ...createPlayState(), hitDiceUsed: { d6: 2, d10: 2 } };
    // 4 dice in total: regain 2, taken from the d10 first.
    expect(longRest(used, { d6: 2, d10: 2 }).hitDiceUsed).toEqual({ d6: 2 });
    // 1 die in total: still regain 1.
    expect(
      longRest({ ...createPlayState(), hitDiceUsed: { d8: 1 } }, { d8: 1 }).hitDiceUsed,
    ).toEqual({});
  });

  it("keeps conditions and inspiration", () => {
    const play = toggleCondition(
      { ...createPlayState(), inspiration: true },
      "srd51:condition/poisoned",
    );
    const rested = longRest(play, { d8: 1 });
    expect(rested.conditions).toEqual(["srd51:condition/poisoned"]);
    expect(rested.inspiration).toBe(true);
  });
});

describe("conditions", () => {
  it("toggles a condition on and off", () => {
    const on = toggleCondition(createPlayState(), "x:condition/prone");
    expect(on.conditions).toEqual(["x:condition/prone"]);
    expect(toggleCondition(on, "x:condition/prone").conditions).toEqual([]);
  });
});

describe("a death save", () => {
  const dying = () => ({ ...createPlayState(), hp: 0 });

  it("counts a success from 10, a failure below it, and two failures for a 1", () => {
    expect(deathSaveRoll(dying(), 20, 14).deathSaves).toEqual({ successes: 1, failures: 0 });
    expect(deathSaveRoll(dying(), 20, 10).deathSaves).toEqual({ successes: 1, failures: 0 });
    expect(deathSaveRoll(dying(), 20, 9).deathSaves).toEqual({ successes: 0, failures: 1 });
    expect(deathSaveRoll(dying(), 20, 1).deathSaves).toEqual({ successes: 0, failures: 2 });
  });

  it("brings back one hit point and clears the saves on a 20", () => {
    const hurt = { ...dying(), deathSaves: { successes: 1, failures: 2 } };
    const back = deathSaveRoll(hurt, 20, 20);
    expect(currentHp(back, 20)).toBe(1);
    expect(back.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it("is undone by reviving: one hit point and clean saves, even from dead", () => {
    const dead = { ...dying(), deathSaves: { successes: 1, failures: 3 } };
    expect(deathStatus(dead, 20)).toBe("dead");
    const back = revive(dead);
    expect(currentHp(back, 20)).toBe(1);
    expect(back.deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(deathStatus(back, 20)).toBe("alive");
  });

  it("never goes past three", () => {
    const near = { ...dying(), deathSaves: { successes: 0, failures: 2 } };
    expect(deathSaveRoll(near, 20, 1).deathSaves.failures).toBe(3);
  });
});
