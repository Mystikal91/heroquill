import { describe, expect, it } from "vitest";
import type { RandomInt } from "./dice";
import {
  type RollParts,
  addTerm,
  keptFace,
  partsDetail,
  partsOfDice,
  partsTone,
  partsTotal,
  removeTerm,
  rerollTerm,
  setD20Mode,
} from "./rollParts";

/** Gives the faces in order (a face of n is `n - 1` out of the generator). */
const faces = (...list: number[]): RandomInt => {
  let i = 0;
  return () => (list[i++] ?? 1) - 1;
};

const check = (faces: number[], mode: "normal" | "advantage" | "disadvantage" = "normal") =>
  ({
    d20: { faces, keys: faces.map((_, i) => i + 1), mode, critMin: 20, floor: 0 },
    terms: [{ key: 10, value: 5, sign: 1 }],
  }) satisfies RollParts;

describe("the pieces of a roll", () => {
  it("keeps the higher d20 with advantage and the lower with disadvantage", () => {
    expect(keptFace(check([14, 7], "advantage").d20)).toBe(0);
    expect(keptFace(check([7, 14], "advantage").d20)).toBe(1);
    expect(keptFace(check([14, 7], "disadvantage").d20)).toBe(1);
    expect(partsTotal(check([14, 7], "disadvantage"))).toBe(12);
    expect(partsDetail(check([14, 7], "advantage"))).toBe("d20 [14, 7] → 14 +5");
  });

  it("adds and takes away dice and numbers, and only takes out what was put in", () => {
    let parts: RollParts = check([10]);
    parts = addTerm(parts, { sides: 4, sign: 1 }, 20, faces(3));
    parts = addTerm(parts, { sides: 6, sign: -1 }, 21, faces(5));
    parts = addTerm(parts, { value: 2, sign: -1 }, 22);
    expect(partsTotal(parts)).toBe(10 + 5 + 3 - 5 - 2);
    expect(partsDetail(parts)).toBe("d20 10 +5 + d4 (3) - d6 (5) -2");
    parts = removeTerm(parts, 21);
    expect(partsTotal(parts)).toBe(16);
    // The bonus of the roll itself stays.
    expect(removeTerm(parts, 10).terms.some((t) => t.key === 10)).toBe(true);
    // A die an effect gave (Bardic Inspiration) is not one the person can take out.
    const bardic = addTerm(parts, { sides: 8, sign: 1, source: "Bardic" }, 23, faces(6));
    expect(removeTerm(bardic, 23).terms.some((t) => t.key === 23)).toBe(true);
  });

  it("turns a d20 into advantage after it landed, and back", () => {
    const advantage = setD20Mode(check([6]), "advantage", 30, faces(17));
    expect(advantage.d20?.faces).toEqual([6, 17]);
    expect(advantage.d20?.keys).toEqual([1, 30]);
    expect(partsTotal(advantage)).toBe(22);
    // The same two dice read the other way: no third die.
    const disadvantage = setD20Mode(advantage, "disadvantage", 31, faces(2));
    expect(disadvantage.d20?.faces).toEqual([6, 17]);
    expect(partsTotal(disadvantage)).toBe(11);
    // Back to normal keeps the one that counted.
    const normal = setD20Mode(disadvantage, "normal", 32);
    expect(normal.d20?.faces).toEqual([6]);
    expect(normal.d20?.keys).toEqual([1]);
  });

  it("finds a critical or a fumble from the d20 that counts", () => {
    expect(partsTone(check([20, 3], "advantage"))).toBe("critical");
    expect(partsTone(check([20, 3], "disadvantage"))).toBeUndefined();
    expect(partsTone(check([1, 3], "disadvantage"))).toBe("fumble");
    expect(partsTone(setD20Mode(check([1]), "advantage", 5, faces(20)))).toBe("critical");
    // Reliable Talent lifts a 1: it is no fumble, and the detail shows the lift.
    const reliable = { ...check([1]), d20: { ...check([1]).d20, floor: 10 } };
    expect(partsTone(reliable)).toBeUndefined();
    expect(partsTotal(reliable)).toBe(15);
    expect(partsDetail(reliable)).toBe("d20 1 → 10 +5");
    // Improved Critical: 19 is enough.
    expect(partsTone({ ...check([19]), d20: { ...check([19]).d20, critMin: 19 } })).toBe(
      "critical",
    );
  });

  it("splits a roll of dice into its dice and rerolls one of them", () => {
    let key = 100;
    const parts = partsOfDice(
      { expression: "2d6+1d4-1", rolls: [[6, 2], [4]], modifier: -1, total: 11 },
      () => key++,
    );
    expect(parts.terms.map((t) => [t.sides, t.value, t.sign])).toEqual([
      [6, 6, 1],
      [6, 2, 1],
      [4, 4, 1],
      [undefined, 1, -1],
    ]);
    expect(partsTotal(parts)).toBe(11);
    expect(partsDetail(parts)).toBe("2d6 (6, 2) + d4 (4) -1");
    const again = rerollTerm(parts, 101, 200, faces(5));
    expect(again.terms[1]).toMatchObject({ key: 200, sides: 6, value: 5 });
    expect(partsTotal(again)).toBe(14);
  });
});
