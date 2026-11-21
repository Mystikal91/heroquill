import { describe, expect, it } from "vitest";
import { attackHits } from "./monsterRolls";

const roll = (total: number, natural = 10) => ({
  total,
  critical: natural === 20,
  fumble: natural === 1,
});

describe("attackHits", () => {
  it("hits when the total reaches the armor class, and not below", () => {
    expect(attackHits(roll(15), 15)).toBe(true);
    expect(attackHits(roll(14), 15)).toBe(false);
  });

  it("always hits on a natural 20 and never on a natural 1", () => {
    expect(attackHits(roll(2, 20), 30)).toBe(true);
    expect(attackHits(roll(25, 1), 10)).toBe(false);
  });
});
