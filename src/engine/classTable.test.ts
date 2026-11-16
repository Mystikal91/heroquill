import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

const CLASS = "test:class/mystic";
const FEATURE = "test:feature/inner-fire";

const fighter = srd51Index.get("srd51:class/fighter") as Entry;
const base = classData(fighter);

const mystic: Entry = {
  id: CLASS as Entry["id"],
  kind: "class",
  effects: [],
  data: {
    ...base,
    spellcasting: undefined,
    levels: base.levels.map((row) => ({
      ...row,
      features: row.level === 1 ? [FEATURE] : [],
      classSpecific: { "Punti ki": row.level * 2 },
    })),
  },
};

const fire: Entry = {
  id: FEATURE as Entry["id"],
  kind: "feature",
  effects: [{ type: "uses", term: { table: "Punti ki" }, recharge: "short", pool: true }],
  data: { level: 1, class: CLASS },
};

const index = new Map<string, Entry>([...srd51Index, [mystic.id, mystic], [fire.id, fire]]);

function pointsAt(level: number) {
  const c = createCharacter("srd51");
  c.classes = [{ classId: CLASS, level }];
  return deriveSheet(c, index).resources.find((r) => r.entry === FEATURE)?.max;
}

describe("a number taken from a column of the class table", () => {
  it("is the value of the level the character has reached in the class", () => {
    expect(pointsAt(1)).toBe(2);
    expect(pointsAt(5)).toBe(10);
    expect(pointsAt(20)).toBe(40);
  });
});
