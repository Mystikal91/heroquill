// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { parsePack } from "../../data/schema";
import { createCharacter } from "../../engine/character";
import { deriveSheet, indexPacks } from "../../engine/derive";
import { build, complete } from "../../test/characters";
import { srd51Packs } from "../../test/srd51";
import { parseAurora } from "./index";
import { REPLACED_BY_FLAG } from "./optionalFeatures";

// Invented content in the shape of Tasha's optional features and of a book's optional background features.
const FILE = `<?xml version="1.0" encoding="utf-8" ?><elements><info><name>Test</name></info>
  <element name="Scout Lore" type="Class Feature" source="Test Book" id="ID_TEST_CF_SCOUT_LORE">
    <description><p><i>1st-level ranger feature, which replaces the Natural Explorer feature</i></p><p>You know the land.</p></description>
    <rules>
      <grant type="Class Feature" id="ID_TEST_CF_SCOUT_LORE_KEEN" />
      <grant type="Class Feature" id="ID_TEST_CF_SCOUT_LORE_SWIFT" requirements="[level:ranger:6]" />
    </rules>
  </element>
  <element name="Ranger, LV01: Scout Lore" type="Item" source="Test Book" id="ID_TEST_ITEM_OCF_SCOUT_LORE">
    <description><p><i>You can equip this item to “enable” it.</i></p></description>
    <setters><set name="category">Optional Class Features</set><set name="inventory-hidden">true</set></setters>
    <rules>
      <grant type="Grants" id="ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_NATURAL_EXPLORER" />
      <grant type="Class Feature" id="ID_TEST_CF_SCOUT_LORE" requirements="[level:ranger:1]" />
    </rules>
  </element>
  <element name="Keen" type="Class Feature" source="Test Book" id="ID_TEST_CF_SCOUT_LORE_KEEN">
    <description><p>Keen eyes.</p></description>
    <rules><stat name="perception" value="2" /></rules>
  </element>
  <element name="Swift" type="Class Feature" source="Test Book" id="ID_TEST_CF_SCOUT_LORE_SWIFT">
    <description><p>You move fast.</p></description>
  </element>
  <element name="Ranger, LV03: Extra Trick" type="Item" source="Test Book" id="ID_TEST_ITEM_OCF_EXTRA">
    <description><p><i>You can equip this item to “enable” it.</i></p></description>
    <setters><set name="category">Optional Class Features</set></setters>
    <rules><grant type="Class Feature" id="ID_TEST_CF_KEEN_EXTRA" requirements="[level:ranger:3]" /></rules>
  </element>
  <element name="Extra Trick" type="Class Feature" source="Test Book" id="ID_TEST_CF_KEEN_EXTRA">
    <description><p>One more trick.</p></description>
  </element>
  <element name="A Plain Rope" type="Item" source="Test Book" id="ID_TEST_ITEM_ROPE">
    <description><p>Rope.</p></description>
    <setters><set name="category">Adventuring Gear</set></setters>
  </element>
  <element name="Optional Feature: Inheritor" type="Background Feature" source="Test Book" id="ID_TEST_BGF_INHERITOR">
    <supports>Background Feature, Optional Background Feature</supports>
    <description><p>You are the heir of a famed legacy.</p></description>
    <rules><grant type="Grants" id="ID_INTERNAL_GRANT_OPTIONAL_BACKGROUND_FEATURE" /></rules>
  </element>
  <element name="Shelter of the Faithful" type="Background Feature" source="Test Book" id="ID_TEST_BGF_SHELTER">
    <supports>Background Feature, Acolyte</supports>
    <description><p>Not optional: a background's own feature.</p></description>
  </element>
  <element name="Test Hermit" type="Background" source="Test Book" id="ID_TEST_BG_HERMIT">
    <description><p>You lived alone.</p></description>
    <rules>
      <grant type="Background Feature" id="ID_TEST_BGF_SHELTER" requirements="!ID_INTERNAL_GRANT_OPTIONAL_BACKGROUND_FEATURE" />
      <select type="Background Feature" name="Variant Feature" supports="Optional Background Feature" optional="true" />
    </rules>
  </element>
  <element name="Test Heir" type="Background" source="Test Book" id="ID_TEST_BG_HEIR">
    <description><p>You must pick.</p></description>
    <rules>
      <select type="Background Feature" name="Legacy" supports="Optional Background Feature" />
    </rules>
  </element>
</elements>`;

const parse = () =>
  parseAurora([FILE], {
    packId: "imp1",
    index: indexPacks(...srd51Packs),
    nameOf: (id) => id.split("/")[1] ?? id,
  });

describe("optional features as options", () => {
  const result = parse();
  const option = (id: string) => result.entries.find((e) => e.id === `imp1:option/${id}`);

  it("makes an option of each hidden optional-feature item, named by the feature", () => {
    expect(option("ranger-lv01-scout-lore")?.kind).toBe("option");
    expect(result.strings["imp1:option/ranger-lv01-scout-lore.name"]).toBe("Scout Lore (Ranger)");
    expect(result.strings["imp1:option/ranger-lv01-scout-lore.desc"]).toContain(
      "You know the land",
    );
    // Not an item of the inventory, and an ordinary item stays one.
    expect(result.entries.some((e) => e.kind === "item" && /scout-lore/.test(e.id))).toBe(false);
    expect(result.entries.find((e) => e.id.endsWith("item/a-plain-rope"))?.kind).toBe("item");
  });

  it("lists what the option replaces, only among entries the app has", () => {
    const replaces = option("ranger-lv01-scout-lore")?.data.replaces as string[];
    expect(replaces).toEqual(
      REPLACED_BY_FLAG.ID_INTERNAL_FEATURE_REPLACEMENT_RANGER_NATURAL_EXPLORER,
    );
    expect(option("ranger-lv03-extra-trick")?.data.replaces).toBeUndefined();
    for (const id of replaces) expect(indexPacks(...srd51Packs).has(id)).toBe(true);
  });

  it("makes the optional background feature an option that stands in for the feature", () => {
    const inheritor = result.entries.find((e) =>
      e.id.endsWith("option/optional-feature-inheritor"),
    );
    expect(inheritor?.data.backgroundFeature).toBe(true);
    expect(result.strings[`${inheritor?.id}.name`]).toBe("Inheritor");
    // A background's own feature is not an option.
    expect(result.entries.some((e) => /shelter/.test(e.id))).toBe(false);
  });

  it("does not make a choice of a select Aurora marks optional: the optional rules offer it", () => {
    const choices = (slug: string) =>
      result.entries
        .find((e) => e.id === `imp1:background/${slug}`)
        ?.effects.filter((e) => e.type === "choice") ?? [];
    // `optional="true"`: the person may leave it empty, so nothing is left to choose.
    expect(choices("test-hermit")).toEqual([]);
    // Without it the select stays a choice to make.
    expect(choices("test-heir")).toHaveLength(1);
    // The feature itself is still an option of the optional rules.
    expect(
      result.entries.find((e) => e.id.endsWith("option/optional-feature-inheritor"))?.data
        .backgroundFeature,
    ).toBe(true);
  });

  it("every id the table names exists in the SRD or is the Beast Master's, which the SRD lacks", () => {
    const index = indexPacks(...srd51Packs);
    for (const [flag, ids] of Object.entries(REPLACED_BY_FLAG))
      for (const id of ids) expect(index.has(id), `${flag}: ${id}`).toBe(true);
  });
});

describe("a character with an optional feature", () => {
  const result = parse();
  const pack = parsePack({
    manifest: {
      id: "imp1",
      ruleset: "custom",
      version: "1",
      license: "Personal",
      attribution: "x",
    },
    entries: result.entries,
  });
  const index = indexPacks(...srd51Packs, pack);
  const ranger = (level: number, options: string[]) => {
    const c = complete(build("ranger", level, "human"));
    c.options = options;
    return deriveSheet(c, index);
  };

  it("hides the feature it replaces and gets the features it is made of at their levels", () => {
    const plain = ranger(6, []);
    expect(plain.traits).not.toContain("imp1:feature/keen");
    expect(plain.hiddenFeatures).not.toContain("srd51:feature/natural-explorer-2-terrain-types");

    const swapped = ranger(6, ["imp1:option/ranger-lv01-scout-lore"]);
    expect(swapped.traits).toEqual(
      expect.arrayContaining([
        "imp1:feature/scout-lore",
        "imp1:feature/keen",
        "imp1:feature/swift",
      ]),
    );
    expect(swapped.superseded["srd51:feature/natural-explorer-2-terrain-types"]).toBe(
      "imp1:option/ranger-lv01-scout-lore",
    );
    expect(swapped.hiddenFeatures).toContain("srd51:feature/natural-explorer-2-terrain-types");
    // The favored enemy was not replaced.
    expect(swapped.hiddenFeatures).not.toContain("srd51:feature/favored-enemy-2-types");
  });

  it("gives a feature of a higher level only once that level is reached", () => {
    const low = ranger(3, [
      "imp1:option/ranger-lv01-scout-lore",
      "imp1:option/ranger-lv03-extra-trick",
    ]);
    expect(low.traits).toContain("imp1:feature/keen");
    expect(low.traits).not.toContain("imp1:feature/swift");
    expect(low.traits).toContain("imp1:feature/extra-trick");
    expect(ranger(2, ["imp1:option/ranger-lv03-extra-trick"]).traits).not.toContain(
      "imp1:feature/extra-trick",
    );
  });

  it("is not affected by the options of a character that has none", () => {
    expect(createCharacter("srd51").options ?? []).toEqual([]);
  });
});
