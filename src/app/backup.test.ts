// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { backupDue, backups, lastExport, noteChange, noteExport, snoozeBackup } from "./backup";

const DAY = 24 * 60 * 60 * 1000;

describe("the reminder to keep a copy", () => {
  beforeEach(() => {
    backups.value = {};
  });

  it("says nothing about a pack nobody changed", () => {
    expect(backupDue("a", 10 * DAY)).toBeUndefined();
  });

  it("waits a day after the first change", () => {
    noteChange("a", 0);
    expect(backupDue("a", DAY / 2)).toBeUndefined();
    expect(backupDue("a", 2 * DAY + 1)).toBe(2);
  });

  it("counts from the first change, not the last", () => {
    noteChange("a", 0);
    noteChange("a", 5 * DAY);
    expect(backupDue("a", 5 * DAY)).toBe(5);
  });

  it("is quiet for a week after 'later'", () => {
    noteChange("a", 0);
    snoozeBackup("a", 2 * DAY);
    expect(backupDue("a", 3 * DAY)).toBeUndefined();
    expect(backupDue("a", 9 * DAY + 1)).toBeDefined();
  });

  it("starts again after a copy", () => {
    noteChange("a", 0);
    noteExport("a", 3 * DAY);
    expect(backupDue("a", 4 * DAY)).toBeUndefined();
    expect(lastExport("a")).toBe(3 * DAY);
    noteChange("a", 4 * DAY);
    expect(backupDue("a", 6 * DAY)).toBe(2);
  });

  it("keeps each pack apart", () => {
    noteChange("a", 0);
    expect(backupDue("b", 5 * DAY)).toBeUndefined();
  });
});
