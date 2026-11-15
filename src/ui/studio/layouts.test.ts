import { describe, expect, it } from "vitest";
import { ENTRY_KINDS } from "../../data/schema";
import { blankData } from "../../homebrew/blanks";
import { DATA_FIELDS, KIND_META } from "../../homebrew/catalog";
import { LAYOUTS } from "./layouts";

describe("the layouts of the studio", () => {
  it("lay out every kind of entry", () => {
    expect(Object.keys(LAYOUTS).sort()).toEqual([...ENTRY_KINDS].sort());
  });

  it("only show a beginner fields the catalog has", () => {
    for (const kind of ENTRY_KINDS) {
      const entry = { id: `x:${kind}/y`, kind, effects: [], data: blankData(kind) } as never;
      const known = DATA_FIELDS[kind].map((f) => f.key);
      const missing = LAYOUTS[kind].guided(entry).filter((key) => !known.includes(key));
      expect(missing, kind).toEqual([]);
    }
  });

  it("show an item the parts that it has", () => {
    const item = (data: Record<string, unknown>) =>
      LAYOUTS.item.guided({ id: "x:item/y", kind: "item", effects: [], data } as never);
    expect(item(blankData("item", "weapon"))).toEqual(["cost", "weight", "weapon", "enhancement"]);
    expect(item(blankData("item", "armor"))).toEqual(["cost", "weight", "armor"]);
    expect(item(blankData("item", "magic"))).toEqual([
      "cost",
      "weight",
      "rarity",
      "attunement",
      "slot",
    ]);
    expect(item(blankData("item", "gear"))).toEqual(["cost", "weight"]);
  });

  it("own what the catalog says a kind owns", () => {
    for (const kind of ENTRY_KINDS) {
      const owns = LAYOUTS[kind].owns;
      if (owns) expect(KIND_META[kind].owns, kind).toContain(owns);
    }
  });

  it("name a parent only where the kind has one to pick", () => {
    expect(LAYOUTS.subclass.parent).toBe("class");
    expect(LAYOUTS.subspecies.parent).toBe("species");
    for (const kind of ENTRY_KINDS)
      if (LAYOUTS[kind].parent) expect(KIND_META[LAYOUTS[kind].parent as never]).toBeDefined();
  });
});
