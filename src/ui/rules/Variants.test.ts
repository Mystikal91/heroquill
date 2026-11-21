// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { content } from "../../app/store";
import type { Entry } from "../../data/schema";
import { originsOf } from "./Variants";

const entry = (id: string, kind: string, effects: unknown[] = [], data: object = {}) =>
  ({ id, kind, effects, data }) as unknown as Entry;

function load(entries: Entry[]) {
  content.value = {
    index: new Map(entries.map((e) => [e.id, e])),
    name: (id: string) => id.split("/")[1] ?? id,
  } as never;
}

describe("what a variant of a rule applies to", () => {
  afterEach(() => {
    content.value = undefined;
  });

  it("names the class, the subclass and the level of a feature", () => {
    load([
      entry("a:class/bard", "class"),
      entry("a:feature/asi", "feature", [], { class: "a:class/bard", level: 4 }),
      entry("a:subclass/lore", "subclass"),
      entry("a:feature/gift", "feature", [], {
        class: "a:class/bard",
        subclass: "a:subclass/lore",
        level: 3,
      }),
    ]);
    expect(originsOf("a:feature/asi")).toEqual([{ who: "bard", level: 4 }]);
    expect(originsOf("a:feature/gift")).toEqual([{ who: "bard · lore", level: 3 }]);
  });

  it("names the species that gives a trait, even inside a condition, and every one that does", () => {
    load([
      entry("b:trait/fey-step", "trait"),
      entry("b:species/eladrin", "species", [{ type: "trait", id: "b:trait/fey-step" }]),
      entry("b:subspecies/dusk", "subspecies", [
        { type: "when", requires: "x", effects: [{ type: "trait", id: "b:trait/fey-step" }] },
      ]),
    ]);
    expect(originsOf("b:trait/fey-step")).toEqual([{ who: "eladrin" }, { who: "dusk" }]);
  });

  it("has nothing to say about content with no owner, and the edition for the SRD", () => {
    load([entry("b:trait/lone", "trait"), entry("srd51:trait/darkvision", "trait")]);
    expect(originsOf("b:trait/lone")).toEqual([]);
    expect(originsOf("srd51:trait/darkvision")).toHaveLength(1);
  });
});
