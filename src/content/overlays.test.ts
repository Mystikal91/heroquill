import { describe, expect, it } from "vitest";
import { createCharacter } from "../engine/character";
import { deriveSheet } from "../engine/derive";
import { srd51Index } from "../test/srd51";
import { applyOverlays } from "./overlays";

const id = "srd51:feature/intimidating-presence";
const fresh = () => new Map(srd51Index);

describe("what a pack adds to the entries of another", () => {
  it("adds effects after the ones the entry has and keeps everything else", () => {
    const index = fresh();
    const before = index.get(id);
    const extra = { type: "featureValue" as const, name: "intimidating presence:dc", term: 8 };
    applyOverlays(index, { [id]: { effects: [extra] } });
    const after = index.get(id);
    expect(after?.effects).toEqual([...(before?.effects ?? []), extra]);
    expect(after?.data).toEqual(before?.data);
    expect(after?.id).toBe(id);
  });

  it("does not add the same effect twice, nor take the place of an activation", () => {
    const index = fresh();
    const extra = { type: "featureValue" as const, name: "x:dc", term: 8 };
    applyOverlays(index, { [id]: { effects: [extra], activation: "reaction" } });
    applyOverlays(index, { [id]: { effects: [extra] } });
    const after = index.get(id);
    expect(after?.effects.filter((e) => e.type === "featureValue")).toHaveLength(1);
    // The SRD says it is an action: a pack does not change that.
    expect((after?.data as { activation?: string }).activation).toBe("action");
  });

  it("says how a feature is used when the entry does not", () => {
    const index = fresh();
    applyOverlays(index, { "srd51:feature/font-of-magic": { activation: "bonus" } });
    expect(index.get("srd51:feature/font-of-magic")?.data).toMatchObject({ activation: "bonus" });
  });

  it("leaves an entry the index does not have, and no overlay, alone", () => {
    const index = fresh();
    const size = index.size;
    applyOverlays(index, { "srd51:feature/not-there": { activation: "action" } });
    applyOverlays(index, undefined);
    expect(index.size).toBe(size);
    expect(index.has("srd51:feature/not-there")).toBe(false);
  });
});

describe("the numbers an overlay gives to a feature", () => {
  it("shows the DC of Tranquility, worked out for the character", () => {
    const tranquility = "srd51:feature/tranquility";
    const index = new Map(srd51Index);
    applyOverlays(index, {
      [tranquility]: {
        effects: [
          { type: "featureValue", name: "tranquility:dc", term: 8 },
          { type: "featureValue", name: "tranquility:dc", term: { of: "proficiency" } },
          { type: "featureValue", name: "tranquility:dc", term: { mod: "wis" } },
        ],
      },
    });
    const c = createCharacter("srd51");
    c.classes = [
      { classId: "srd51:class/monk", level: 11, subclassId: "srd51:subclass/open-hand" },
    ];
    c.abilityBase = { str: 10, dex: 14, con: 12, int: 8, wis: 14, cha: 10 };
    const sheet = deriveSheet(c, index);
    expect(sheet.features).toContain(tranquility);
    // 8 + the proficiency bonus of level 11 (4) + Wisdom 14 (+2).
    expect(sheet.featureValues[tranquility]).toEqual([{ name: "tranquility:dc", value: "14" }]);
    // Without the overlay there is nothing to show.
    expect(deriveSheet(c, srd51Index).featureValues[tranquility]).toBeUndefined();
  });

  it("puts a spell of the SRD on the list of a class of the pack, once", () => {
    const index = fresh();
    const spell = "srd51:spell/cure-wounds";
    const before = (index.get(spell)?.data.classes as string[]).length;
    applyOverlays(index, { [spell]: { spellClasses: ["imp1:class/artificer"] } });
    applyOverlays(index, { [spell]: { spellClasses: ["imp1:class/artificer"] } });
    const classes = index.get(spell)?.data.classes as string[];
    expect(classes).toHaveLength(before + 1);
    expect(classes).toContain("imp1:class/artificer");
  });
});
