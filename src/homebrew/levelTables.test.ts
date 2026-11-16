import { describe, expect, it } from "vitest";
import {
  type LevelRow,
  addColumn,
  fillDown,
  levelRows,
  removeColumn,
  setImprovements,
  setSlot,
  setSpellCount,
  setValue,
  slotsOf,
  valueAt,
  valueColumns,
} from "./levelTables";

const rows = (): LevelRow[] =>
  Array.from({ length: 5 }, (_, i) => ({
    level: i + 1,
    features: [],
    abilityScoreImprovements: 0,
    classSpecific: {},
  }));

describe("the tables of a class by level", () => {
  it("adds a column that shows from the start and takes it away again", () => {
    const withKi = addColumn(rows(), "Punti ki");
    expect(valueColumns(withKi)).toEqual(["Punti ki"]);
    expect(valueAt(withKi, 3, "Punti ki")).toBe(0);
    expect(valueColumns(removeColumn(withKi, "Punti ki"))).toEqual([]);
  });

  it("sets one value and repeats it on the levels below", () => {
    let next = addColumn(rows(), "Ire");
    next = setValue(next, 2, "Ire", 3);
    next = fillDown(next, "Ire", 2);
    expect([1, 2, 3, 4, 5].map((l) => valueAt(next, l, "Ire"))).toEqual([0, 3, 3, 3, 3]);
  });

  it("leaves a key that holds something other than a number alone", () => {
    const odd = rows().map((r) => ({ ...r, classSpecific: { dice: "d6", Ire: 2 } }));
    expect(valueColumns(odd)).toEqual(["Ire"]);
    expect(removeColumn(odd, "Ire")[0]?.classSpecific).toEqual({ dice: "d6" });
  });

  it("sets the slots of one spell level and keeps the others", () => {
    let next = setSlot(rows(), 3, 2, 3);
    next = setSlot(next, 3, 1, 4);
    expect(slotsOf(next.find((r) => r.level === 3))).toEqual([4, 3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("sets and clears the cantrips and the improvements", () => {
    let next = setSpellCount(rows(), 1, "cantripsKnown", 2);
    expect(next[0]?.cantripsKnown).toBe(2);
    next = setSpellCount(next, 1, "cantripsKnown", undefined);
    expect("cantripsKnown" in (next[0] ?? {})).toBe(false);
    expect(setImprovements(next, 4, 1)[3]?.abilityScoreImprovements).toBe(1);
  });

  it("makes the row of a level a subclass does not have yet", () => {
    const sparse: LevelRow[] = [{ level: 3, features: [] }];
    const next = setSlot(sparse, 7, 1, 2);
    expect(levelRows({ levels: next }).map((r) => r.level)).toEqual([3, 7]);
  });
});
