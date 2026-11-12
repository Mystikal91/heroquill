import { describe, expect, it } from "vitest";
import { inRuleset, subclassOf } from "./rulesets";

describe("rulesets", () => {
  it("shows a character its own SRD and the packs, never the other SRD", () => {
    expect(inRuleset("srd52:spell/fireball", "srd52")).toBe(true);
    expect(inRuleset("srd51:spell/fireball", "srd52")).toBe(false);
    expect(inRuleset("imp1:spell/fireball", "srd52")).toBe(true);
  });

  it("gives a subclass of a book to the 2014 class and to the 2024 class of the same name", () => {
    const book = { id: "imp1:subclass/battle-master", parent: "srd51:class/fighter" };
    expect(subclassOf(book, "srd51:class/fighter")).toBe(true);
    expect(subclassOf(book, "srd52:class/fighter")).toBe(true);
    expect(subclassOf(book, "srd52:class/wizard")).toBe(false);
  });

  it("keeps the subclasses of an SRD with the class of its own edition", () => {
    const srd51 = { id: "srd51:subclass/champion", parent: "srd51:class/fighter" };
    expect(subclassOf(srd51, "srd52:class/fighter")).toBe(false);
    const srd52 = { id: "srd52:subclass/champion", parent: "srd52:class/fighter" };
    expect(subclassOf(srd52, "srd52:class/fighter")).toBe(true);
    expect(subclassOf(srd52, "srd51:class/fighter")).toBe(false);
  });
});
