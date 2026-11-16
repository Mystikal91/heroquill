import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import { startEntry } from "./blanks";
import { applyClassCasting, applySubclassCasting } from "./casting";
import { addOwned } from "./entries";
import { levelOverview } from "./overview";
import { newHomebrewPack } from "./pack";

const name = (id: string) => id.split("/")[1] ?? id;
const blank = (kind: "class" | "subclass") => startEntry(newHomebrewPack("Mine", 1), kind).record;

describe("the levels of a class at a glance", () => {
  it("lists all twenty levels and marks the increases", () => {
    const record = blank("class");
    const cells = levelOverview(record.pack.entries[0] as Entry, name);
    expect(cells).toHaveLength(20);
    expect(cells.filter((c) => c.asi).map((c) => c.level)).toEqual([4, 8, 12, 16, 19]);
  });

  it("shows what each level gives", () => {
    let record = blank("class");
    const added = addOwned(record, record.pack.entries[0]?.id ?? "", "feature", { level: 3 });
    record = added.record;
    const cells = levelOverview(record.pack.entries[0] as Entry, name);
    expect(cells[2]?.features.map((f) => f.id)).toEqual([added.id]);
    expect(cells[0]?.features).toEqual([]);
  });

  it("shows cantrips and the slots a level has", () => {
    const record = blank("class");
    const entry = record.pack.entries[0] as Entry;
    const casting = applyClassCasting(entry.data, {
      kind: "full",
      ability: "int",
      preparation: "prepared",
      cantrips: 3,
    });
    const cells = levelOverview(
      { ...entry, data: { ...entry.data, levels: casting.levels } },
      name,
    );
    expect(cells[0]).toMatchObject({ cantrips: 3, slots: [[1, 2]] });
    expect(cells[4]?.slots).toEqual([
      [1, 4],
      [2, 3],
      [3, 2],
    ]);
  });

  it("lists only the levels a subclass has something at", () => {
    const record = blank("subclass");
    const entry = record.pack.entries[0] as Entry;
    expect(levelOverview(entry, name)).toEqual([]);
    const third = applySubclassCasting(entry.data, {
      enabled: true,
      ability: "int",
      list: "srd51:class/wizard",
      schools: [],
      cantrips: 2,
    });
    const cells = levelOverview({ ...entry, data: { ...entry.data, levels: third.levels } }, name);
    expect(cells[0]?.level).toBe(3);
    expect(cells.every((c) => !c.asi)).toBe(true);
  });
});
