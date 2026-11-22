import { describe, expect, it } from "vitest";
import {
  DM_COLUMNS,
  defaultColumns,
  gridTemplate,
  moveColumn,
  readColumns,
  toggleColumn,
  visibleColumns,
} from "./dmColumns";

describe("the columns of the initiative table", () => {
  it("starts with all of them in the usual order", () => {
    expect(visibleColumns(defaultColumns())).toEqual(DM_COLUMNS.filter((c) => c !== "cond"));
  });

  it("hides and shows a column, but never the name", () => {
    const hidden = toggleColumn(defaultColumns(), "speed");
    expect(visibleColumns(hidden)).not.toContain("speed");
    expect(visibleColumns(toggleColumn(hidden, "speed"))).toContain("speed");
    expect(toggleColumn(defaultColumns(), "name")).toEqual(defaultColumns());
  });

  it("moves a column one place and stops at the ends", () => {
    const down = moveColumn(defaultColumns(), "init", 1);
    expect(down.order.slice(0, 2)).toEqual(["name", "init"]);
    expect(moveColumn(defaultColumns(), "init", -1)).toEqual(defaultColumns());
    const last = DM_COLUMNS[DM_COLUMNS.length - 1];
    expect(moveColumn(defaultColumns(), last ?? "cond", 1)).toEqual(defaultColumns());
  });

  it("keeps the hidden ones where they are in the list", () => {
    const s = moveColumn(toggleColumn(defaultColumns(), "ac"), "ac", -1);
    expect(s.order.indexOf("ac")).toBe(s.order.indexOf("hp") - 1);
    expect(visibleColumns(s)).not.toContain("ac");
  });

  it("reads damaged settings: unknown and repeated columns go, missing ones come back", () => {
    const s = readColumns({ order: ["hp", "bogus", "hp", "name"], hidden: ["name", "ac", "zzz"] });
    expect(s.order.slice(0, 2)).toEqual(["hp", "name"]);
    expect([...s.order].sort()).toEqual([...DM_COLUMNS].sort());
    expect(s.hidden).toEqual(["ac"]);
    expect(readColumns(undefined)).toEqual(defaultColumns());
    expect(readColumns("nonsense")).toEqual(defaultColumns());
  });

  it("makes a grid, and folds speed and conditions when narrow", () => {
    expect(gridTemplate(["init", "name", "hp"])).toBe("4.8rem minmax(0, 1fr) 7.5rem");
    expect(gridTemplate(["init", "name", "speed", "cond"])).toBe(
      "4.8rem minmax(0, 1fr) 4rem 3.4rem",
    );
    expect(gridTemplate(["init", "name", "ac", "speed", "cond"], true)).toBe(
      "2.8rem minmax(0, 1fr) 2.2rem",
    );
  });
});
