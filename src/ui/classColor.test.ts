import { describe, expect, it } from "vitest";
import { CLASS_COLORS, NO_CLASS_COLOR, classColor } from "./classColor";

const luminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

describe("the colours of the classes", () => {
  it("can be read under white (the bands only darken them)", () => {
    for (const color of [...Object.values(CLASS_COLORS), NO_CLASS_COLOR])
      expect(1.05 / (luminance(color) + 0.05), color).toBeGreaterThanOrEqual(5);
  });

  it("go by the name of the class, whatever the book, and have one for the rest", () => {
    expect(classColor("x:class/artificer-2")).toBe(CLASS_COLORS.artificer);
    expect(classColor("x:class/pugilist")).toBe(NO_CLASS_COLOR);
    expect(classColor(undefined)).toBe(NO_CLASS_COLOR);
  });
});
