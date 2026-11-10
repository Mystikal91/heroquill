// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { currentHp } from "../engine/play";
import { CLASSES, build, complete } from "../test/characters";
import { damageCharacter, useItem } from "./play";
import { character, content, sheet } from "./store";

describe("drinking a potion of healing of the SRD", () => {
  it("rolls its dice, heals and uses the potion up", async () => {
    content.value = await loadContent(["en"]);
    const base = complete(build(CLASSES[0] ?? "fighter", 5, "human"));
    const id = "srd51:item/potion-of-healing-superior";
    character.value = { ...base, inventory: [{ itemId: id, quantity: 2, equipped: false }] };
    const max = sheet.value?.hitPoints.max ?? 0;
    expect(max).toBeGreaterThan(30);
    damageCharacter(max - 1);
    const hurt = currentHp(character.value.play ?? ({} as never), max);
    expect(hurt).toBe(1);
    useItem(id);
    const healed = currentHp(character.value.play ?? ({} as never), max);
    // 8d4 + 8 is at least 16 and at most 40 (and never above the maximum).
    expect(healed - hurt).toBeGreaterThanOrEqual(16);
    expect(healed - hurt).toBeLessThanOrEqual(40);
    expect(character.value.inventory[0]?.quantity).toBe(1);
  });
});
