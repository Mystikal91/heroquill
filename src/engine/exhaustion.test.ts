import { describe, expect, it } from "vitest";
import { srd51Index } from "../test/srd51";
import { bothIndex } from "../test/srd52";
import { createCharacter, createPlayState } from "./character";
import { parseCharacter } from "./characterSchema";
import { deriveSheet } from "./derive";
import {
  MAX_EXHAUSTION,
  exhaustionLevel,
  exhaustionMode,
  isExhaustionCondition,
  setExhaustion,
} from "./exhaustion";
import { longRest } from "./play";

function sheetAt(ruleset: "srd51" | "srd52", level: number, cls = "fighter") {
  const c = createCharacter(ruleset);
  c.choices.species = `${ruleset}:species/${ruleset === "srd52" ? "human" : "dwarf"}`;
  c.classes = [{ classId: `${ruleset}:class/${cls}`, level: 5 }];
  c.abilityBase = { str: 14, dex: 12, con: 14, int: 16, wis: 10, cha: 10 };
  const index = ruleset === "srd52" ? bothIndex : srd51Index;
  const plain = deriveSheet(c, index);
  c.play = setExhaustion(c.play, level);
  return { plain, tired: deriveSheet(c, index) };
}
const skill = (s: ReturnType<typeof sheetAt>["plain"], slug: string, ruleset: string) =>
  s.skills.find((x) => x.id === `${ruleset}:skill/${slug}`)?.bonus ?? Number.NaN;

describe("the level of exhaustion", () => {
  it("is set from 0 to 6 and kept in the play state", () => {
    const play = createPlayState();
    expect(exhaustionLevel(play)).toBe(0);
    expect(exhaustionLevel(setExhaustion(play, 3))).toBe(3);
    expect(exhaustionLevel(setExhaustion(play, 9))).toBe(MAX_EXHAUSTION);
    expect(exhaustionLevel(setExhaustion(setExhaustion(play, 3), -1))).toBe(0);
    expect(setExhaustion(play, 0)).not.toHaveProperty("exhaustion");
  });

  it("counts a condition saved by an older version as the first level, and the level replaces it", () => {
    const old = {
      ...createPlayState(),
      conditions: ["srd51:condition/exhaustion", "srd51:condition/poisoned"],
    };
    expect(exhaustionLevel(old)).toBe(1);
    const set = setExhaustion(old, 2);
    expect(set.conditions).toEqual(["srd51:condition/poisoned"]);
    expect(exhaustionLevel(set)).toBe(2);
    expect(isExhaustionCondition("srd52:condition/exhaustion")).toBe(true);
    expect(isExhaustionCondition("srd52:condition/poisoned")).toBe(false);
  });

  it("goes down by one with a long rest, and an old condition goes with the last level", () => {
    const rested = (play: ReturnType<typeof createPlayState>) => longRest(play, { d8: 5 });
    expect(exhaustionLevel(rested(setExhaustion(createPlayState(), 3)))).toBe(2);
    expect(exhaustionLevel(rested(setExhaustion(createPlayState(), 1)))).toBe(0);
    const old = { ...createPlayState(), conditions: ["srd51:condition/exhaustion"] };
    expect(rested(old).conditions).toEqual([]);
  });

  it("is a number the saved character accepts", () => {
    const c = createCharacter("srd52");
    c.play = setExhaustion(c.play, 4);
    expect(parseCharacter(JSON.parse(JSON.stringify(c))).play.exhaustion).toBe(4);
  });
});

describe("the 2024 exhaustion", () => {
  it("lowers every D20 Test by 2 for each level and the speed by 5 feet, not the spell save DC", () => {
    const { plain, tired } = sheetAt("srd52", 2, "wizard");
    expect(skill(tired, "arcana", "srd52")).toBe(skill(plain, "arcana", "srd52") - 4);
    expect(tired.saves.con.bonus).toBe(plain.saves.con.bonus - 4);
    expect(tired.initiative).toBe(plain.initiative - 4);
    expect(tired.speed).toBe((plain.speed ?? 0) - 10);
    const dc = (s: typeof plain) => s.spellcasters[0]?.saveDc ?? Number.NaN;
    expect(dc(tired)).toBe(dc(plain));
    expect(tired.spellcasters[0]?.attackBonus).toBe((plain.spellcasters[0]?.attackBonus ?? 0) - 4);
    expect(tired.hitPoints.max).toBe(plain.hitPoints.max);
  });

  it("never takes the speed under 0", () => {
    expect(sheetAt("srd52", 6).tired.speed).toBe(0);
  });

  it("has no disadvantage on the rolls", () => {
    expect(exhaustionMode("srd52", 5, "check", "normal")).toBe("normal");
    expect(exhaustionMode("srd52", 5, "attack", "advantage")).toBe("advantage");
  });
});

describe("the 2014 exhaustion", () => {
  it("halves the speed from the 2nd level and takes it away from the 5th", () => {
    const base = sheetAt("srd51", 1).plain.speed ?? 0;
    expect(sheetAt("srd51", 1).tired.speed).toBe(base);
    expect(sheetAt("srd51", 2).tired.speed).toBe(Math.floor(base / 2));
    expect(sheetAt("srd51", 4).tired.speed).toBe(Math.floor(base / 2));
    expect(sheetAt("srd51", 5).tired.speed).toBe(0);
  });

  it("halves the hit point maximum from the 4th level", () => {
    const { plain, tired } = sheetAt("srd51", 3);
    expect(tired.hitPoints.max).toBe(plain.hitPoints.max);
    const four = sheetAt("srd51", 4);
    expect(four.tired.hitPoints.max).toBe(Math.floor(four.plain.hitPoints.max / 2));
  });

  it("changes no bonus: the disadvantages are on the rolls", () => {
    const { plain, tired } = sheetAt("srd51", 3);
    expect(skill(tired, "athletics", "srd51")).toBe(skill(plain, "athletics", "srd51"));
    expect(tired.saves.str.bonus).toBe(plain.saves.str.bonus);
  });

  it("gives disadvantage on ability checks from the 1st level, on attacks and saves from the 3rd", () => {
    const mode = (
      level: number,
      kind: "check" | "attack" | "save",
      m: "normal" | "advantage" = "normal",
    ) => exhaustionMode("srd51", level, kind, m);
    expect(mode(0, "check")).toBe("normal");
    expect(mode(1, "check")).toBe("disadvantage");
    expect(mode(1, "attack")).toBe("normal");
    expect(mode(2, "save")).toBe("normal");
    expect(mode(3, "attack")).toBe("disadvantage");
    expect(mode(3, "save")).toBe("disadvantage");
    // an advantage and a disadvantage cancel
    expect(mode(1, "check", "advantage")).toBe("normal");
    // a roll of no kind (damage, a monster) is not touched
    expect(exhaustionMode("srd51", 6, undefined, "advantage")).toBe("advantage");
  });
});
