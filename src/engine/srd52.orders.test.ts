import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";

function make(cls: "cleric" | "druid", wis: number, order?: string, cantrip?: string) {
  const c = createCharacter("srd52");
  c.choices.species = "srd52:species/human";
  c.choices.background = "srd52:background/soldier";
  c.classes = [{ classId: `srd52:class/${cls}`, level: 1 }];
  c.abilityBase = { str: 10, dex: 12, con: 12, int: 10, wis, cha: 10 };
  const feature = cls === "cleric" ? "cleric-divine-order" : "druid-primal-order";
  if (order) {
    c.selections[`srd52:feature/${feature}/order`] = [`srd52:trait/${order}`];
    if (cantrip) c.selections[`srd52:trait/${order}/cantrip`] = [`srd52:spell/${cantrip}`];
  }
  return deriveSheet(c, bothIndex);
}
const skill = (sheet: ReturnType<typeof make>, slug: string) =>
  sheet.skills.find((s) => s.id === `srd52:skill/${slug}`)?.bonus ?? Number.NaN;

describe("the Divine Order of the Cleric", () => {
  it("is a choice between Protector and Thaumaturge", () => {
    const pick = make("cleric", 16).choices.find(
      (p) => p.key === "srd52:feature/cleric-divine-order/order",
    );
    expect([...(pick?.options ?? [])].sort()).toEqual([
      "srd52:trait/divine-order-protector",
      "srd52:trait/divine-order-thaumaturge",
    ]);
    expect(pick?.remaining).toBe(1);
  });

  it("makes a Protector proficient with Martial weapons and Heavy armor", () => {
    const without = make("cleric", 16);
    const sheet = make("cleric", 16, "divine-order-protector");
    expect(without.proficiencies.weapon).not.toContain("martial-weapons");
    expect(without.proficiencies.armor).not.toContain("heavy-armor");
    expect(sheet.proficiencies.weapon).toContain("martial-weapons");
    expect(sheet.proficiencies.armor).toContain("heavy-armor");
  });

  it("gives a Thaumaturge a cantrip of the list and the Wisdom modifier on Arcana and Religion", () => {
    const base = make("cleric", 16);
    const sheet = make("cleric", 16, "divine-order-thaumaturge", "guidance");
    expect(
      sheet.choices.some((p) => p.key === "srd52:trait/divine-order-thaumaturge/cantrip"),
    ).toBe(true);
    expect(skill(sheet, "religion")).toBe(skill(base, "religion") + 3);
    expect(skill(sheet, "arcana")).toBe(skill(base, "arcana") + 3);
    expect(skill(sheet, "history")).toBe(skill(base, "history"));
    expect(sheet.proficiencies.weapon).not.toContain("martial-weapons");
  });

  it("adds at least +1 when the Wisdom modifier is lower", () => {
    const base = make("cleric", 8);
    const sheet = make("cleric", 8, "divine-order-thaumaturge");
    expect(skill(sheet, "religion")).toBe(skill(base, "religion") + 1);
  });
});

describe("the Primal Order of the Druid", () => {
  it("is a choice between Magician and Warden", () => {
    const pick = make("druid", 16).choices.find(
      (p) => p.key === "srd52:feature/druid-primal-order/order",
    );
    expect([...(pick?.options ?? [])].sort()).toEqual([
      "srd52:trait/primal-order-magician",
      "srd52:trait/primal-order-warden",
    ]);
  });

  it("makes a Warden proficient with Martial weapons and Medium armor", () => {
    const sheet = make("druid", 16, "primal-order-warden");
    expect(sheet.proficiencies.weapon).toContain("martial-weapons");
    expect(sheet.proficiencies.armor).toContain("medium-armor");
    expect(make("druid", 16).proficiencies.armor).not.toContain("medium-armor");
  });

  it("gives a Magician a cantrip and the Wisdom modifier on Arcana and Nature", () => {
    const base = make("druid", 16);
    const sheet = make("druid", 16, "primal-order-magician");
    expect(sheet.choices.some((p) => p.key === "srd52:trait/primal-order-magician/cantrip")).toBe(
      true,
    );
    expect(skill(sheet, "nature")).toBe(skill(base, "nature") + 3);
    expect(skill(sheet, "arcana")).toBe(skill(base, "arcana") + 3);
    expect(skill(sheet, "religion")).toBe(skill(base, "religion"));
  });
});
