// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { resourceLeft } from "../engine/play";
import { addCheckBoost, boostsFor, keepBoostedUse, rollCheck, rollLog } from "./play";
import { character, content, sheet } from "./store";

const SECOND_WIND = "srd52:feature/fighter-second-wind";
const TACTICAL_MIND = "srd52:feature/fighter-tactical-mind";

const windLeft = () => {
  const counter = sheet.value?.resources.find((r) => r.entry === SECOND_WIND);
  return counter ? resourceLeft(character.value.play, counter.id, counter.max) : -1;
};

describe("Tactical Mind: a die on a failed ability check", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });
  beforeEach(() => {
    const c = createCharacter("srd52");
    c.choices.species = "srd52:species/human";
    c.choices.background = "srd52:background/soldier";
    c.classes = [{ classId: "srd52:class/fighter", level: 2 }];
    c.abilityBase = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    character.value = c;
    rollLog.value = [];
  });

  it("is on the sheet of a Fighter of level 2", () => {
    expect(sheet.value?.checkBoosts).toEqual([
      { feature: TACTICAL_MIND, dice: "1d10", spends: SECOND_WIND },
    ]);
    expect(windLeft()).toBe(2);
  });

  it("is offered only after a skill roll, not after another d20", () => {
    rollCheck("Initiative", 2);
    const other = rollLog.value[0];
    expect(other && boostsFor(other)).toEqual([]);
    rollCheck("Athletics", 2, undefined, true);
    const skill = rollLog.value[0];
    expect(skill && boostsFor(skill).map((b) => b.feature)).toEqual([TACTICAL_MIND]);
  });

  it("adds the die and uses up a use of Second Wind, and a refund gives it back", () => {
    rollCheck("Athletics", 2, undefined, true);
    const roll = rollLog.value[0];
    if (!roll || roll.total === undefined) throw new Error("no roll");
    addCheckBoost(roll, TACTICAL_MIND);
    expect(windLeft()).toBe(1);
    const boosted = rollLog.value[0];
    expect(boosted?.total).toBeGreaterThan(roll.total);
    expect(boosted?.total).toBeLessThanOrEqual(roll.total + 10);
    // It cannot be added twice to the same roll.
    expect(boosted && boostsFor(boosted)).toEqual([]);
    if (boosted) keepBoostedUse(boosted);
    expect(windLeft()).toBe(2);
    expect(rollLog.value[0]?.boosted).toBeUndefined();
  });

  it("is not offered once the uses are gone", () => {
    rollCheck("Athletics", 2, undefined, true);
    const first = rollLog.value[0];
    if (first) addCheckBoost(first, TACTICAL_MIND);
    rollCheck("Stealth", 2, undefined, true);
    const second = rollLog.value[0];
    if (second) addCheckBoost(second, TACTICAL_MIND);
    expect(windLeft()).toBe(0);
    rollCheck("Perception", 2, undefined, true);
    const third = rollLog.value[0];
    expect(third && boostsFor(third)).toEqual([]);
  });
});
