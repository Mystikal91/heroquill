import { describe, expect, it } from "vitest";
import { planFlow } from "./flow";

const unit = (key: string, height: number, keep = false) => ({ key, height, keep });

describe("planFlow", () => {
  it("fills the columns in order, then the pages", () => {
    const items = ["a", "b", "c", "d", "e"].map((k) => unit(k, 40));
    expect(planFlow(items, 2, 100, 100)).toEqual([
      [
        ["a", "b"],
        ["c", "d"],
      ],
      [["e"]],
    ]);
  });

  it("gives the first page less room", () => {
    const items = ["a", "b", "c"].map((k) => unit(k, 40));
    expect(planFlow(items, 1, 50, 100)).toEqual([[["a"]], [["b", "c"]]]);
  });

  it("keeps a title with what follows it", () => {
    const items = [unit("a", 50), unit("title", 10, true), unit("b", 45)];
    expect(planFlow(items, 2, 100, 100)).toEqual([[["a"], ["title", "b"]]]);
  });

  it("cuts a block taller than a column into its parts, and never leaves a column empty", () => {
    const items = [
      { ...unit("long", 250), parts: [unit("long.0", 90), unit("long.1", 90), unit("long.2", 70)] },
      unit("huge", 500),
    ];
    expect(planFlow(items, 2, 100, 100)).toEqual([
      [["long.0"], ["long.1"]],
      [["long.2"], ["huge"]],
    ]);
  });

  it("has one empty page for nothing", () => {
    expect(planFlow([], 2, 100, 100)).toEqual([[[]]]);
  });
});
