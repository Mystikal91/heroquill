import { describe, expect, it } from "vitest";
import { addDamageType, damageLabel, ownDamageTypes, setDamageName } from "./damage";
import { newHomebrewPack } from "./pack";
import { addLanguage } from "./translate";

const pack = () => ({ ...newHomebrewPack("Mine", 1), id: "mine", lang: "it" });

describe("kinds of damage a pack adds", () => {
  it("keeps the name a person wrote as a text of the pack", () => {
    const made = addDamageType(pack(), "Acido sonico");
    expect(made?.slug).toBe("acido-sonico");
    expect(ownDamageTypes(made?.record ?? pack())).toEqual(["acido-sonico"]);
    expect(damageLabel(made?.record ?? pack(), "acido-sonico", "it")).toBe("Acido sonico");
  });

  it("does not add the same kind twice, nor lose its name", () => {
    const once = addDamageType(pack(), "Sonico")?.record ?? pack();
    const twice = addDamageType(once, "sonico")?.record ?? pack();
    expect(ownDamageTypes(twice)).toEqual(["sonico"]);
    expect(damageLabel(twice, "sonico", "it")).toBe("Sonico");
  });

  it("says a name in the language asked, the original where there is no translation", () => {
    let record = addLanguage(addDamageType(pack(), "Sonico")?.record ?? pack(), "en");
    expect(damageLabel(record, "sonico", "en")).toBe("Sonico");
    record = setDamageName(record, "sonico", "Sonic", "en");
    expect(damageLabel(record, "sonico", "en")).toBe("Sonic");
    expect(damageLabel(record, "sonico", "it")).toBe("Sonico");
  });

  it("makes a readable name of one that has none yet", () => {
    expect(damageLabel(pack(), "acido-sonico", "it")).toBe("Acido sonico");
  });

  it("refuses a name that has no letters", () => {
    expect(addDamageType(pack(), "  !! ")).toBeUndefined();
  });
});
