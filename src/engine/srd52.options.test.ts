import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

type Character = ReturnType<typeof createCharacter>;

function make(cls: "sorcerer" | "warlock", level: number): Character {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/soldier";
  c.classes = [{ classId: `srd52:class/${cls}`, level }];
  c.abilityBase = { str: 10, dex: 12, con: 12, int: 10, wis: 10, cha: 16 };
  return c;
}
const sheetOf = (c: Character) => deriveSheet(c, bothIndex);
const METAMAGIC = "srd52:feature/sorcerer-metamagic";
const INVOCATIONS = "srd52:feature/warlock-eldritch-invocations";
const pick = (c: Character, feature: string, step: string) =>
  sheetOf(c).choices.find((p) => p.key === `${feature}/${step}`);
const optionId = (slug: string) => `srd52:feature/${slug}`;

describe("the Metamagic options of the Sorcerer", () => {
  it("are the ten of the book, two at level 2 and two more at 10 and at 17", () => {
    const first = pick(make("sorcerer", 2), METAMAGIC, "option");
    expect(first?.options.length).toBe(10);
    expect(first?.choose).toBe(2);
    expect(pick(make("sorcerer", 9), METAMAGIC, "option-10")).toBeUndefined();
    expect(pick(make("sorcerer", 10), METAMAGIC, "option-10")?.choose).toBe(2);
    expect(pick(make("sorcerer", 16), METAMAGIC, "option-17")).toBeUndefined();
    expect(pick(make("sorcerer", 17), METAMAGIC, "option-17")?.choose).toBe(2);
  });

  it("have the cost in the text", () => {
    expect(bothIndex.has(optionId("metamagic-quickened-spell"))).toBe(true);
  });
});

describe("the Eldritch Invocations of the Warlock", () => {
  it("are as many as the table says: one at level 1, three at 2, seven at 10", () => {
    const count = (level: number) => pick(make("warlock", level), INVOCATIONS, "option")?.choose;
    expect(count(1)).toBe(1);
    expect(count(2)).toBe(3);
    expect(count(10)).toBe(7);
  });

  it("ask for the level and the pact of the book", () => {
    const c = make("warlock", 2);
    const needs = pick(c, INVOCATIONS, "option")?.needs ?? {};
    expect(needs[optionId("invocation-devils-sight")]?.met ?? true).toBe(true);
    expect(needs[optionId("invocation-ascendant-step")]?.met).toBe(false);
    expect(needs[optionId("invocation-thirsting-blade")]?.met).toBe(false);
    const blade = make("warlock", 5);
    blade.selections[`${INVOCATIONS}/option`] = [optionId("invocation-pact-of-the-blade")];
    const later = pick(blade, INVOCATIONS, "option")?.needs ?? {};
    expect(later[optionId("invocation-ascendant-step")]?.met).toBe(true);
    expect(later[optionId("invocation-thirsting-blade")]?.met).toBe(true);
    expect(later[optionId("invocation-devouring-blade")]?.met).toBe(false);
  });

  it("can be taken again with another cantrip: Agonizing Blast is an option for each damaging cantrip", () => {
    const options = pick(make("warlock", 2), INVOCATIONS, "option")?.options ?? [];
    const agonizing = options.filter((o) => o.includes("invocation-agonizing-blast-"));
    expect(agonizing.sort()).toEqual([
      optionId("invocation-agonizing-blast-chill-touch"),
      optionId("invocation-agonizing-blast-eldritch-blast"),
      optionId("invocation-agonizing-blast-poison-spray"),
    ]);
    // Eldritch Spear needs a range of 10 feet or more, Repelling Blast an attack roll
    expect(options.filter((o) => o.includes("invocation-eldritch-spear-")).length).toBe(2);
    expect(options.filter((o) => o.includes("invocation-repelling-blast-")).length).toBe(3);
    expect(options.filter((o) => o.includes("invocation-lessons-of-the-first-ones-")).length).toBe(
      4,
    );
    // the plain entry of a repeatable invocation is not an option by itself
    expect(options).not.toContain(optionId("invocation-agonizing-blast"));
  });

  it("let a character take the same invocation twice with two cantrips", () => {
    const c = make("warlock", 2);
    c.selections[`${INVOCATIONS}/option`] = [
      optionId("invocation-agonizing-blast-eldritch-blast"),
      optionId("invocation-agonizing-blast-poison-spray"),
      optionId("invocation-armor-of-shadows"),
    ];
    const sheet = sheetOf(c);
    expect(sheet.warnings.filter((w) => w.code === "invalidChoice")).toEqual([]);
    expect(sheet.spellDamage.length).toBe(2);
    expect(sheet.atWillSpells).toContain("srd52:spell/mage-armor");
  });

  it("give the spells, senses and speed their text promises", () => {
    const c = make("warlock", 15);
    c.selections[`${INVOCATIONS}/option`] = [
      optionId("invocation-witch-sight"),
      optionId("invocation-gift-of-the-depths"),
      optionId("invocation-visions-of-distant-realms"),
    ];
    const sheet = sheetOf(c);
    expect(sheet.senses.truesight).toBe(30);
    expect(sheet.atWillSpells).toContain("srd52:spell/arcane-eye");
    expect(sheet.grantedSpells).toContain("srd52:spell/water-breathing");
    expect(sheet.movement.swim).toBeDefined();
  });

  it("give the Pact of the Tome three cantrips and two rituals to pick", () => {
    const c = make("warlock", 2);
    c.selections[`${INVOCATIONS}/option`] = [optionId("invocation-pact-of-the-tome")];
    const sheet = sheetOf(c);
    expect(sheet.choices.find((p) => p.key.endsWith("pact-of-the-tome/cantrips"))?.choose).toBe(3);
    expect(sheet.choices.find((p) => p.key.endsWith("pact-of-the-tome/rituals"))?.choose).toBe(2);
  });
});
