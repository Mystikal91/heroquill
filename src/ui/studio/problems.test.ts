// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { checkData } from "../../homebrew/catalog";
import { explainProblem } from "./problems";

describe("what is wrong, in words", () => {
  it("says what a field needs", () => {
    expect(explainProblem("hitDie: required")).toBe("Hit die is needed.");
    expect(explainProblem("speed: expected a number")).toBe("Speed must be a number.");
    expect(explainProblem("level: must be at most 9")).toBe("Level must be at most 9.");
    expect(explainProblem("hitDie: must be at least 4")).toBe("Hit die must be at least 4.");
  });

  it("names the field at the end of a path, not the way to it", () => {
    expect(explainProblem("damage[0].damageType.index: required")).toBe("Name is needed.");
    expect(explainProblem("weapon.range.normal: expected a number")).toContain("Normal range");
  });

  it("asks for a pick, and says when a field does not belong", () => {
    expect(explainProblem("feat: expected an entry id")).toBe("Choose a value for Feat.");
    expect(explainProblem("wings: unknown field")).toBe(
      "Wings is not something this kind of entry has.",
    );
  });

  it("leaves alone what it cannot say better", () => {
    expect(explainProblem("something else entirely")).toBe("something else entirely");
    expect(explainProblem("effects: Invalid key")).toBe("effects: Invalid key");
  });

  it("explains every problem the catalog can find in a broken entry", () => {
    const problems = checkData("species", { size: "huge-ish", wings: true });
    for (const p of problems)
      expect(explainProblem(p)).not.toMatch(/: (required|expected|unknown field)/);
  });
});
