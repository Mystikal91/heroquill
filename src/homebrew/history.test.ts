import { describe, expect, it } from "vitest";
import {
  HISTORY_LIMIT,
  JOIN_MS,
  canRedo,
  canUndo,
  change,
  redo,
  replacePresent,
  startHistory,
  undo,
} from "./history";

describe("history of changes", () => {
  it("goes back and forward", () => {
    let h = startHistory("a");
    h = change(h, "b", undefined, 0);
    h = change(h, "c", undefined, 0);
    expect([canUndo(h), canRedo(h)]).toEqual([true, false]);
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(h.present).toBe("b");
    expect(canRedo(h)).toBe(true);
  });

  it("does nothing at the ends", () => {
    const h = startHistory("a");
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("drops the future when something new is done", () => {
    let h = change(change(startHistory("a"), "b"), "c");
    h = undo(h);
    h = change(h, "d");
    expect(h.future).toEqual([]);
    expect(undo(h).present).toBe("b");
  });

  it("joins quick changes of the same field into one step", () => {
    let h = startHistory("a");
    h = change(h, "ab", "x.name", 1000);
    h = change(h, "abc", "x.name", 1000 + JOIN_MS - 1);
    expect(h.past).toEqual(["a"]);
    expect(undo(h).present).toBe("a");
  });

  it("starts a new step for another field, a slow change, or no key", () => {
    let h = startHistory("a");
    h = change(h, "b", "x.name", 0);
    h = change(h, "c", "x.desc", 10);
    h = change(h, "d", "x.desc", 10 + JOIN_MS + 1);
    h = change(h, "e", undefined, 10 + JOIN_MS + 2);
    h = change(h, "f", undefined, 10 + JOIN_MS + 3);
    expect(h.past).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("ignores a change that is no change", () => {
    const h = startHistory("a");
    expect(change(h, "a")).toBe(h);
  });

  it("keeps a limited number of steps", () => {
    let h = startHistory(0);
    for (let n = 1; n <= HISTORY_LIMIT + 20; n++) h = change(h, n);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });

  it("can take a new present without making a step", () => {
    const h = replacePresent(change(startHistory("a"), "b"), "b2");
    expect(h.present).toBe("b2");
    expect(h.past).toEqual(["a"]);
  });
});
