import { describe, expect, it } from "vitest";
import { damageDefenses, plainDamageTypes } from "./defenses";

describe("the damage defenses of a monster as data", () => {
  it("reads the kinds that are named on their own", () => {
    expect(plainDamageTypes("acid; fire; Lightning")).toEqual(["acid", "fire", "lightning"]);
  });

  it("leaves out an entry with a condition, and what is not a kind of damage", () => {
    expect(
      plainDamageTypes(
        "cold; bludgeoning, piercing, and slashing from nonmagical weapons; something else",
      ),
    ).toEqual(["cold"]);
    expect(plainDamageTypes(undefined)).toEqual([]);
    expect(plainDamageTypes("")).toEqual([]);
  });

  it("writes only the lists that have something", () => {
    expect(
      damageDefenses({
        damage_vulnerabilities: [],
        damage_resistances: ["fire", "bludgeoning, piercing, and slashing from nonmagical weapons"],
        damage_immunities: ["poison"],
      }),
    ).toEqual({ damageResistances: ["fire"], damageImmunities: ["poison"] });
    expect(damageDefenses({})).toEqual({});
  });
});
