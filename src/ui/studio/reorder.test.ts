// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { tintOf } from "../../app/playStates";
import { moved } from "./Reorder";

describe("moving an item of a list", () => {
  it("puts it where it was dropped, the rest keeping their order", () => {
    expect(moved(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moved(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves the list alone when there is nowhere to go", () => {
    const list = ["a", "b"];
    expect(moved(list, 1, 1)).toBe(list);
    expect(moved(list, 0, 5)).toBe(list);
    expect(moved(list, -1, 0)).toBe(list);
  });
});

describe("the glow of a colour", () => {
  it("knows the named colours and any #rrggbb", () => {
    expect(tintOf("red")).toMatch(/^rgba\(/);
    expect(tintOf("#00ff80")).toBe("rgba(0, 255, 128, 0.55)");
  });

  it("has none for what it does not know", () => {
    expect(tintOf(undefined)).toBeUndefined();
    expect(tintOf("chartreuse")).toBeUndefined();
    expect(tintOf("#12345")).toBeUndefined();
  });
});
