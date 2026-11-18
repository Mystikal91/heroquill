// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { setSpellActive } from "../engine/play";
import { changePlay, rollCheck, rollLog } from "./play";
import { character, content } from "./store";

const BLESS = "srd51:spell/bless";

describe("a die that an effect adds to the rolls (Bless)", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });

  beforeEach(() => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/cleric", level: 3 }];
    character.value = c;
    rollLog.value = [];
  });

  it("is rolled with an attack roll and a saving throw, and written in the log", () => {
    changePlay((p) => setSpellActive(p, BLESS, true));
    for (const kind of ["attack", "save"] as const) {
      rollLog.value = [];
      const roll = rollCheck("Test", 5, undefined, undefined, kind);
      const entry = rollLog.value[0];
      expect(entry?.detail).toMatch(/\+ d4 \([1-4]\)/);
      // The total counts the d4: 5 + the d20 (1 to 20) + the d4 (1 to 4).
      expect(roll.total).toBeGreaterThanOrEqual(7);
      expect(roll.total).toBeLessThanOrEqual(29);
      expect(entry?.total).toBe(roll.total);
    }
  });

  it("is not rolled with an ability check, or when the spell is off", () => {
    changePlay((p) => setSpellActive(p, BLESS, true));
    rollCheck("Check", 3, undefined, true, "check");
    expect(rollLog.value[0]?.detail).not.toMatch(/d4/);
    changePlay((p) => setSpellActive(p, BLESS, false));
    rollLog.value = [];
    rollCheck("Attack", 3, undefined, undefined, "attack");
    expect(rollLog.value[0]?.detail).not.toMatch(/d4/);
  });

  it("is spent by the first roll it goes to, and the spell ends with it (Guidance)", () => {
    changePlay((p) => setSpellActive(p, "srd51:spell/guidance", true));
    // Not on an attack: it is for an ability check.
    rollCheck("Attack", 3, undefined, undefined, "attack");
    expect(character.value.play.activeSpells).toEqual(["srd51:spell/guidance"]);
    rollLog.value = [];
    rollCheck("Check", 3, undefined, true, "check");
    expect(rollLog.value[0]?.detail).toMatch(/\+ d4 \([1-4]\)/);
    expect(character.value.play.activeSpells).toBeUndefined();
    rollLog.value = [];
    rollCheck("Check", 3, undefined, true, "check");
    expect(rollLog.value[0]?.detail).not.toMatch(/d4/);
  });
});
