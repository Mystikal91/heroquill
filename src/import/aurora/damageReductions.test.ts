// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { indexPacks } from "../../engine/derive";
import { srd51Packs } from "../../test/srd51";
import { DAMAGE_REDUCTIONS } from "./damageReductions";
import { parseAurora } from "./index";

// The two Heavy Armor Master feats in the shape of the books, and a feat that takes nothing off.
const FILE = `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>Test</name></info>
  <element name="Heavy Armor Master" type="Feat" source="Test Book" id="ID_PHB_FEAT_HEAVYARMORMASTER">
    <description><p>While you are wearing heavy armor, damage from nonmagical attacks is reduced by 3.</p></description>
  </element>
  <element name="Heavy Armor Master" type="Feat" source="Test Book 2024" id="ID_WOTC_PHB24_FEAT_HEAVY_ARMOR_MASTER">
    <description><p>While wearing Heavy armor, damage is reduced by your Proficiency Bonus.</p></description>
  </element>
  <element name="Plain Feat" type="Feat" source="Test Book" id="ID_TEST_FEAT_PLAIN">
    <description><p>Nothing special.</p></description>
  </element>
</elements>`;

describe("the feats that take a flat amount off a hit", () => {
  const options = {
    packId: "imp1",
    index: indexPacks(...srd51Packs),
    nameOf: (id: string) => id.split("/")[1] ?? id,
  };
  // By default the 2014 feat stands in for the 2024 one of the same name; the person can keep both.
  const result = parseAurora([FILE], options);
  const both = parseAurora([FILE], { ...options, keepEditions: true });
  const effectsOf = (aid: string, from = result) =>
    from.entries.find((e) => e.id === from.aids[aid])?.effects ?? [];

  it("give the effect of the table, and only those feats", () => {
    expect(effectsOf("ID_PHB_FEAT_HEAVYARMORMASTER")).toContainEqual(
      DAMAGE_REDUCTIONS.ID_PHB_FEAT_HEAVYARMORMASTER,
    );
    expect(effectsOf("ID_WOTC_PHB24_FEAT_HEAVY_ARMOR_MASTER", both)).toContainEqual(
      DAMAGE_REDUCTIONS.ID_WOTC_PHB24_FEAT_HEAVY_ARMOR_MASTER,
    );
    expect(effectsOf("ID_TEST_FEAT_PLAIN").some((e) => e.type === "damageReduction")).toBe(false);
  });

  it("read the 2014 feat as 3 and the 2024 one as the proficiency bonus, in heavy armor", () => {
    expect(DAMAGE_REDUCTIONS.ID_PHB_FEAT_HEAVYARMORMASTER).toMatchObject({
      value: 3,
      when: "heavyArmor",
    });
    expect(DAMAGE_REDUCTIONS.ID_WOTC_PHB24_FEAT_HEAVY_ARMOR_MASTER).toMatchObject({
      value: 0,
      plus: "proficiency",
      when: "heavyArmor",
    });
  });
});
