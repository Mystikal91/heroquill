import { describe, expect, it } from "vitest";
import type { Effect } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { addCustomEffect, longRest, removeCustomEffect, setCustomEffectOn } from "./play";

const ac2: Effect = { type: "modifier", target: "ac", value: 2 };
const fire: Effect = { type: "defense", kind: "resistance", damage: "fire" };

function sheetWith(
  add: (
    play: ReturnType<typeof createCharacter>["play"],
  ) => ReturnType<typeof createCharacter>["play"],
) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: "srd51:class/fighter", level: 3 }];
  c.play = add(c.play);
  return deriveSheet(c, srdIndex);
}
const srdIndex = srd51Index;

describe("an effect the person adds by hand", () => {
  it("counts on the sheet like any other effect: a bonus to the armor class, a resistance", () => {
    const base = sheetWith((p) => p);
    const s = sheetWith((p) => addCustomEffect(p, "Blessing of the cleric", [ac2, fire]));
    expect(s.armorClass.value).toBe(base.armorClass.value + 2);
    expect(s.defenses.resistance).toEqual(["fire"]);
    // The part of the armor class says where it comes from, by the name the person gave.
    expect(
      s.armorClass.parts.some((part) => part.feature === "custom:effect/blessing-of-the-cleric"),
    ).toBe(true);
  });

  it("needs a name and something to do", () => {
    const play = createCharacter("srd51").play;
    expect(addCustomEffect(play, "  ", [ac2])).toBe(play);
    expect(addCustomEffect(play, "Aid", [])).toBe(play);
  });

  it("gets an id that is its name as a slug, and a different one when the name is taken", () => {
    let play = createCharacter("srd51").play;
    play = addCustomEffect(play, "Fortificação", [ac2]);
    play = addCustomEffect(play, "Fortificacao", [ac2]);
    expect((play.customEffects ?? []).map((e) => e.id)).toEqual(["fortificacao", "fortificacao-2"]);
  });

  it("can be removed, one at a time", () => {
    let play = addCustomEffect(createCharacter("srd51").play, "Aid", [ac2]);
    play = addCustomEffect(play, "Ward", [fire]);
    play = removeCustomEffect(play, "aid");
    expect((play.customEffects ?? []).map((e) => e.name)).toEqual(["Ward"]);
    expect(removeCustomEffect(play, "ward").customEffects).toBeUndefined();
  });

  it("can be turned off and on, staying on the list", () => {
    const base = sheetWith((p) => p);
    const added = addCustomEffect(createCharacter("srd51").play, "Aid", [ac2]);
    const off = setCustomEffectOn(added, "aid", false);
    expect(off.customEffects?.map((e) => e.name)).toEqual(["Aid"]);
    expect(sheetWith(() => off).armorClass.value).toBe(base.armorClass.value);
    const on = setCustomEffectOn(off, "aid", true);
    expect(on.customEffects?.[0]?.off).toBeUndefined();
    expect(sheetWith(() => on).armorClass.value).toBe(base.armorClass.value + 2);
  });

  it("is turned off, not lost, by a long rest", () => {
    const play = addCustomEffect(createCharacter("srd51").play, "Aid", [ac2]);
    const rested = longRest(play, {});
    expect(rested.customEffects?.map((e) => [e.name, e.off])).toEqual([["Aid", true]]);
  });

  it("works for a spell the character does not know: another player put it on", () => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: "srd51:class/fighter", level: 3 }];
    const base = deriveSheet(c, srdIndex).armorClass.value;
    c.play.activeSpells = ["srd51:spell/shield-of-faith"];
    expect(deriveSheet(c, srdIndex).armorClass.value).toBe(base + 2);
  });
});
