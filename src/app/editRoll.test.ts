// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { setInspiration } from "../engine/play";
import { partsTotal } from "../engine/rollParts";
import {
  addLog,
  addToRoll,
  changePlay,
  removeFromRoll,
  rerollWithInspiration,
  rollCheck,
  rollDiceText,
  rollLog,
  rollMode,
  setRollModeAfter,
} from "./play";
import { character, content } from "./store";

describe("changing a roll after it landed", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });

  beforeEach(() => {
    character.value = createCharacter("srd51");
    rollLog.value = [];
    rollMode.value = "normal";
  });

  it("adds and takes out dice and numbers in place, counting the changes", () => {
    rollCheck("Stealth", 5, undefined, true, "check");
    const entry = rollLog.value[0];
    if (!entry) throw new Error("no roll");
    addToRoll(entry, { sides: 4, sign: -1 });
    addToRoll(entry, { value: 2, sign: 1 });
    expect(rollLog.value).toHaveLength(1);
    const changed = rollLog.value[0];
    expect(changed?.id).toBe(entry.id);
    expect(changed?.edits).toBe(2);
    expect(changed?.parts && partsTotal(changed.parts)).toBe(changed?.total);
    expect(changed?.detail).toMatch(/- d4 \([1-4]\) \+2$/);
    const die = changed?.parts?.terms.find((t) => t.sides === 4);
    if (!changed || !die) throw new Error("no die");
    removeFromRoll(changed, die.key);
    expect(rollLog.value[0]?.total).toBe((entry.total ?? 0) + 2);
  });

  it("turns a roll into advantage and back, the tone following the d20 that counts", () => {
    rollCheck("Attack", 3, undefined, undefined, "attack");
    const entry = rollLog.value[0];
    if (!entry) throw new Error("no roll");
    setRollModeAfter(entry, "advantage");
    const advantage = rollLog.value[0];
    expect(advantage?.parts?.d20?.faces).toHaveLength(2);
    expect(advantage?.total).toBe(Math.max(...(advantage?.parts?.d20?.faces ?? [])) + 3);
    expect(advantage?.tone === "critical").toBe(advantage?.parts?.d20?.faces.includes(20));
    if (!advantage) throw new Error("no roll");
    setRollModeAfter(advantage, "normal");
    expect(rollLog.value[0]?.parts?.d20?.faces).toHaveLength(1);
    expect(rollLog.value[0]?.edits).toBe(2);
  });

  it("keeps what was added by hand and the way of rolling when the inspiration rolls the d20 again", () => {
    changePlay((p) => setInspiration(p, true));
    rollCheck("Attack", 3, undefined, undefined, "attack");
    const entry = rollLog.value[0];
    if (!entry) throw new Error("no roll");
    addToRoll(entry, { sides: 4, sign: 1 });
    const changed = rollLog.value[0];
    if (!changed) throw new Error("no roll");
    setRollModeAfter(changed, "advantage");
    const edited = rollLog.value[0];
    if (!edited) throw new Error("no roll");
    rerollWithInspiration(edited);
    const again = rollLog.value[0];
    expect(again?.id).not.toBe(edited.id);
    expect(again?.parts?.d20?.mode).toBe("advantage");
    expect(again?.parts?.d20?.faces).toHaveLength(2);
    expect(again?.parts?.terms).toEqual(edited.parts?.terms);
    expect(again?.parts && partsTotal(again.parts)).toBe(again?.total);
  });

  it("changes a roll of dice, and a bare number (a feature that heals a fixed amount)", () => {
    rollDiceText("Longsword", "1d8+3");
    const damage = rollLog.value[0];
    if (!damage) throw new Error("no roll");
    addToRoll(damage, { sides: 6, sign: 1 });
    expect(rollLog.value[0]?.parts?.terms.map((t) => t.sides)).toEqual([8, undefined, 6]);
    addLog({ label: "Second Wind", detail: "7", total: 7 });
    const healed = rollLog.value[0];
    if (!healed) throw new Error("no roll");
    addToRoll(healed, { value: 1, sign: 1 });
    expect(rollLog.value[0]?.total).toBe(8);
    expect(rollLog.value[0]?.parts?.terms[0]?.key).toBe(-healed.id);
  });
});
