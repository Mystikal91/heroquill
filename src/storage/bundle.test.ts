import { describe, expect, it } from "vitest";
import { createCampaign } from "../engine/campaign";
import { createCharacter } from "../engine/character";
import { createEncounter, readEncounter } from "../engine/encounter";
import {
  DEFAULT_SECTIONS,
  type Section,
  type Sources,
  buildBundle,
  describeBundle,
  linksOf,
  onlySections,
  openSealed,
  openTransfer,
  serializeBundle,
} from "./bundle";
import { WrongPassphrase, seal, unseal } from "./crypto";
import type { UserPackRecord } from "./packs";

const pack = (over: Partial<UserPackRecord>): UserPackRecord => ({
  id: "p1",
  name: "Pack",
  origin: "homebrew",
  addedAt: 1,
  lang: "en",
  pack: {
    manifest: { id: "p1", ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [],
  },
  strings: {},
  ...over,
});

const sources: Sources = {
  characters: [createCharacter("srd51"), createCharacter("srd51")],
  packs: [
    pack({ id: "mine", name: "Mine", origin: "homebrew" }),
    pack({ id: "editsit", name: "Edits", origin: "edits", lang: "it" }),
    pack({
      id: "impa",
      name: "From a link",
      origin: "personal",
      source: { url: "https://example.org/a.xml" },
      keepEditions: true,
    }),
    pack({ id: "impb", name: "From files", origin: "personal", source: { files: ["b.xml"] } }),
  ],
  settings: { language: "it", units: "metric" },
  deeplKey: "secret:fx",
  translations: [["it\nHello", "Ciao"]],
};

const all = new Set<Section>([
  "characters",
  "homebrew",
  "edits",
  "links",
  "settings",
  "deeplKey",
  "translations",
]);

describe("a transfer file", () => {
  it("holds only the parts that were chosen", () => {
    const bundle = buildBundle(sources, new Set(DEFAULT_SECTIONS));
    expect(bundle.characters).toHaveLength(2);
    expect(bundle.homebrew).toHaveLength(1);
    expect(bundle.edits).toHaveLength(1);
    expect(bundle.settings?.language).toBe("it");
    // The key and the saved translations are not in unless asked for.
    expect(bundle.deeplKey).toBeUndefined();
    expect(bundle.translations).toBeUndefined();
    expect(JSON.stringify(bundle)).not.toContain("secret:fx");
  });

  it("says when each character last changed, only along with the characters", () => {
    const withTimes = { ...sources, characterTimes: { a: 10, b: 20 } };
    expect(buildBundle(withTimes, new Set<Section>(["characters"])).characterTimes).toEqual({
      a: 10,
      b: 20,
    });
    expect(buildBundle(withTimes, new Set<Section>(["settings"])).characterTimes).toBeUndefined();
  });

  it("carries the key only when it is chosen", () => {
    expect(buildBundle(sources, all).deeplKey).toBe("secret:fx");
  });

  it("sends the packs of Aurora as addresses, and names the ones made from files", () => {
    const bundle = buildBundle(sources, new Set<Section>(["links"]));
    expect(bundle.links).toEqual([
      { id: "impa", name: "From a link", url: "https://example.org/a.xml", keepEditions: true },
    ]);
    expect(bundle.files).toEqual(["From files"]);
    expect(JSON.stringify(bundle)).not.toContain("manifest");
    expect(linksOf(sources.packs).links).toHaveLength(1);
  });

  it("says how much of each part there is, and can drop parts", () => {
    const bundle = buildBundle(sources, all);
    expect(describeBundle(bundle)).toEqual({
      characters: 2,
      encounters: 0,
      homebrew: 1,
      edits: 1,
      links: 1,
      settings: 1,
      deeplKey: 1,
      translations: 1,
    });
    const slim = onlySections(bundle, new Set<Section>(["characters"]));
    expect(describeBundle(slim).homebrew).toBe(0);
    expect(slim.deeplKey).toBeUndefined();
  });
});

describe("opening a file", () => {
  it("tells a transfer file from other text", async () => {
    const text = await serializeBundle(buildBundle(sources, all));
    expect(openTransfer(text)?.kind).toBe("plain");
    expect(openTransfer("not json")).toBeUndefined();
    expect(openTransfer(JSON.stringify({ format: "other" }))).toBeUndefined();
  });

  it("protects the file with a passphrase and opens it with the same one", async () => {
    const text = await serializeBundle(buildBundle(sources, all), "correct horse");
    expect(text).not.toContain("secret:fx");
    expect(text).not.toContain("From a link");
    const opened = openTransfer(text);
    expect(opened?.kind).toBe("sealed");
    if (opened?.kind !== "sealed") throw new Error("not sealed");
    const bundle = await openSealed(opened.sealed, "correct horse");
    expect(bundle.deeplKey).toBe("secret:fx");
    await expect(openSealed(opened.sealed, "wrong")).rejects.toBeInstanceOf(WrongPassphrase);
  });
});

describe("encrypting a text", () => {
  it("round-trips, and uses a new salt and nonce every time", async () => {
    const a = await seal("hello", "pass");
    const b = await seal("hello", "pass");
    expect(a.data).not.toBe(b.data);
    expect(a.salt).not.toBe(b.salt);
    expect(await unseal(a, "pass")).toBe("hello");
  });

  it("notices a changed file", async () => {
    const sealed = await seal("hello", "pass");
    const flipped = { ...sealed, data: `${sealed.data.slice(0, -4)}AAAA` };
    await expect(unseal(flipped, "pass")).rejects.toBeInstanceOf(WrongPassphrase);
  });

  it("copes with a large text", async () => {
    const big = "x".repeat(300_000);
    expect(await unseal(await seal(big, "p"), "p")).toBe(big);
  });
});

describe("the fights of the DM mode in a transfer file", () => {
  const fights = [createEncounter("One"), createEncounter("Two")];
  const withFights: Sources = { ...sources, encounters: fights };

  it("travel when asked for and are on by default", () => {
    expect(DEFAULT_SECTIONS).toContain("encounters");
    const bundle = buildBundle(withFights, new Set<Section>(["encounters"]));
    expect(bundle.encounters).toHaveLength(2);
    expect(bundle.characters).toBeUndefined();
    expect(describeBundle(bundle).encounters).toBe(2);
    expect(buildBundle(withFights, new Set<Section>(["characters"])).encounters).toBeUndefined();
  });

  it("can be left out of a file that has them", () => {
    const bundle = buildBundle(withFights, new Set<Section>(["encounters", "characters"]));
    expect(onlySections(bundle, new Set<Section>(["characters"])).encounters).toBeUndefined();
    expect(onlySections(bundle, new Set<Section>(["encounters"])).encounters).toHaveLength(2);
  });

  it("are an empty list, not nothing, when there are none", () => {
    expect(buildBundle(sources, new Set<Section>(["encounters"])).encounters).toEqual([]);
  });
});

describe("the campaigns of the DM mode in a transfer file", () => {
  const camp = createCampaign("Lost Mine");
  const withCamp: Sources = {
    ...sources,
    encounters: [createEncounter("One", camp.id)],
    campaigns: [camp],
  };

  it("travel with the fights, and are left out with them", () => {
    const bundle = buildBundle(withCamp, new Set<Section>(["encounters"]));
    expect(bundle.campaigns).toHaveLength(1);
    expect(buildBundle(withCamp, new Set<Section>(["characters"])).campaigns).toBeUndefined();
    expect(onlySections(bundle, new Set<Section>(["characters"])).campaigns).toBeUndefined();
  });

  it("are pointed to by the fights, which keep the link when read", () => {
    const fight = createEncounter("One", camp.id);
    expect(readEncounter(JSON.parse(JSON.stringify(fight)))?.campaignId).toBe(camp.id);
    expect(
      readEncounter(JSON.parse(JSON.stringify(createEncounter("Old"))))?.campaignId,
    ).toBeUndefined();
  });
});
