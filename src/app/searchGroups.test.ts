import { describe, expect, it } from "vitest";
import { describeOrigins, groupHits } from "./searchGroups";

const hit = (id: string, name: string, kind: "feature" | "spell" = "feature") => ({
  id,
  kind,
  name,
});

describe("grouping the rules list", () => {
  it("puts together the same name of the same kind, in the order they came", () => {
    const groups = groupHits([
      hit("a:feature/asi-1", "Ability Score Improvement"),
      hit("a:feature/rage", "Rage"),
      hit("a:feature/asi-2", "ability score improvement"),
      hit("a:spell/rage", "Rage", "spell"),
    ]);
    expect(groups.map((g) => [g.name, g.hits.length])).toEqual([
      ["Ability Score Improvement", 2],
      ["Rage", 1],
      ["Rage", 1],
    ]);
  });

  it("ignores accents when it compares names", () => {
    expect(
      groupHits([hit("a:feature/1", "Furtività"), hit("b:feature/1", "Furtivita")]),
    ).toHaveLength(1);
  });
});

describe("describing where entries apply", () => {
  const levels = (l: number[]) => `levels ${l.join(", ")}`;

  it("lists each owner once with its sorted levels", () => {
    expect(
      describeOrigins(
        [
          { who: "Barbarian", level: 8 },
          { who: "Bard", level: 4 },
          { who: "Barbarian", level: 4 },
          { who: "Barbarian", level: 4 },
        ],
        levels,
      ),
    ).toEqual(["Barbarian (levels 4, 8)", "Bard (levels 4)"]);
  });

  it("leaves out the levels when an owner has none", () => {
    expect(describeOrigins([{ who: "My pack" }], levels)).toEqual(["My pack"]);
  });
});
