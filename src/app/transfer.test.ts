// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { parseCharacter } from "../engine/characterSchema";
import {
  type Encounter,
  addCombatants,
  createEncounter,
  manualCombatant,
} from "../engine/encounter";
import { type Bundle, type Section, TRANSFER_FORMAT } from "../storage/bundle";
import { deleteEncounter, listEncounters, saveEncounter } from "../storage/encounters";
import type { UserPackRecord } from "../storage/packs";
import { autoSettings, saveAutoSettings } from "../translate/auto";
import { encounterCount, refreshEncounterCount } from "./encounterCount";
import { language } from "./language";
import { character, characters, content, countConflicts, restoreCharacters } from "./store";
import { applyTransfer, currentCounts, exportTransfer } from "./transfer";
import { userPacks } from "./userPacks";

const record = (
  id: string,
  origin: "homebrew" | "edits",
  strings: Record<string, string>,
): UserPackRecord => ({
  id,
  name: id,
  origin,
  addedAt: 5,
  lang: "it",
  pack: {
    manifest: { id, ruleset: "custom", version: "1", license: "x", attribution: "x" },
    entries: [],
  },
  strings,
});

describe("moving data between devices", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
  });

  it("brings in homebrew packs and merges quick edits, keeping the texts of both", async () => {
    userPacks.value = [record("editsit", "edits", { "a:b/c.name": "mine", "a:b/c.desc": "keep" })];
    const bundle: Bundle = {
      format: TRANSFER_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      homebrew: [record("mybrew", "homebrew", {})],
      edits: [record("editsit", "edits", { "a:b/c.name": "theirs", "a:b/d.name": "new" })],
    };
    const report = await applyTransfer(bundle, new Set<Section>(["homebrew", "edits"]));
    expect(report.packs).toBe(1);
    expect(report.edits).toBe(1);
    const edits = userPacks.value.find((p) => p.id === "editsit");
    expect(edits?.strings).toEqual({
      "a:b/c.name": "theirs",
      "a:b/c.desc": "keep",
      "a:b/d.name": "new",
    });
    expect(userPacks.value.find((p) => p.id === "mybrew")?.origin).toBe("homebrew");
  });

  it("applies the settings and the key only when they are chosen", async () => {
    saveAutoSettings({ ...autoSettings.value, key: "", enabled: false });
    const bundle: Bundle = {
      format: TRANSFER_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: {
        language: "fr",
        translate: { enabled: true, relay: "https://relay.example", descriptionsOnly: false },
      },
      deeplKey: "abc:fx",
    };
    const without = await applyTransfer(bundle, new Set<Section>(["settings"]));
    expect(without.settings).toBe(true);
    expect(language.value).toBe("fr");
    expect(autoSettings.value).toMatchObject({ enabled: true, descriptionsOnly: false });
    expect(autoSettings.value.key).toBe("");

    const withKey = await applyTransfer(bundle, new Set<Section>(["deeplKey"]));
    expect(withKey.deeplKey).toBe(true);
    expect(autoSettings.value.key).toBe("abc:fx");
    language.value = "en";
  });

  it("lists the addresses to download again, leaving out the ones already here", async () => {
    userPacks.value = [
      {
        ...record("impx", "homebrew", {}),
        origin: "personal",
        source: { url: "https://example.org/known.xml" },
      },
    ];
    const bundle: Bundle = {
      format: TRANSFER_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      links: [
        { name: "Known", url: "https://example.org/known.xml/" },
        { name: "New", url: "https://example.org/new.xml" },
      ],
    };
    const report = await applyTransfer(bundle, new Set<Section>(["links"]));
    expect(report.links.map((l) => l.name)).toEqual(["New"]);
  });

  it("decides what to do with a character that is here with other content", async () => {
    const mine = parseCharacter({ ...createCharacter("srd51"), id: "same-id", name: "Mine" });
    await restoreCharacters([mine]);
    expect(characters.value.some((c) => c.id === "same-id")).toBe(true);
    const theirs = { ...mine, name: "Theirs" };

    // The same one is left alone; one with other content is counted.
    expect(await countConflicts([mine])).toBe(0);
    expect(await countConflicts([theirs])).toBe(1);

    const keep = await restoreCharacters([theirs], "keep");
    expect(keep).toEqual({ added: 0, skipped: 1, replaced: 0 });
    expect(characters.value.find((c) => c.id === "same-id")?.name).toBe("Mine");

    const older = await restoreCharacters([theirs], "newest", { "same-id": 1 });
    expect(older).toEqual({ added: 0, skipped: 1, replaced: 0 });
    expect(characters.value.find((c) => c.id === "same-id")?.name).toBe("Mine");

    const newer = await restoreCharacters([theirs], "newest", { "same-id": Date.now() + 60_000 });
    expect(newer).toEqual({ added: 0, skipped: 0, replaced: 1 });
    expect(characters.value.filter((c) => c.id === "same-id")).toHaveLength(1);
    expect(characters.value.find((c) => c.id === "same-id")?.name).toBe("Theirs");
    expect(character.value.id).toBe("same-id");
    expect(character.value.name).toBe("Theirs");

    // With no date on the incoming one, both are kept.
    const before = characters.value.length;
    const undated = await restoreCharacters([{ ...theirs, name: "Third" }], "newest");
    expect(undated.added).toBe(1);
    expect(characters.value.length).toBe(before + 1);
    const copy = await restoreCharacters([{ ...theirs, name: "Fourth" }], "copy");
    expect(copy.added).toBe(1);
    expect(characters.value.length).toBe(before + 2);
  });

  it("reads what to offer for export, and makes a file with what was chosen", async () => {
    const info = currentCounts();
    expect(info.counts.settings).toBe(1);
    const file = await exportTransfer(new Set<Section>(["settings"]), "");
    expect(file.name).toMatch(/\.dndtransfer\.json$/);
    expect(JSON.parse(file.text).format).toBe(TRANSFER_FORMAT);
    const sealed = await exportTransfer(new Set<Section>(["settings"]), "pw");
    expect(JSON.parse(sealed.text).format).toBe("dnd-character-maker-sealed");
  });
});

describe("moving the fights of the DM mode", () => {
  const fight = (name: string, updated = 10): Encounter => ({
    ...addCombatants(createEncounter(name), [manualCombatant({ name: "Orc", maxHp: 9, ac: 12 })]),
    updated,
  });

  const clear = async () => {
    for (const e of await listEncounters()) await deleteEncounter(e.id);
    await refreshEncounterCount();
  };

  it("counts what is saved for the export window", async () => {
    await clear();
    await saveEncounter(fight("a"));
    await saveEncounter(fight("b"));
    await refreshEncounterCount();
    expect(encounterCount.value).toBe(2);
    expect(currentCounts().counts.encounters).toBe(2);
  });

  it("carries them in a file and brings them back where they are missing", async () => {
    await clear();
    const mine = fight("Ambush");
    await saveEncounter(mine);
    const file = await exportTransfer(new Set<Section>(["encounters"]), "");
    await clear();
    const bundle = JSON.parse(file.text) as Bundle;
    expect(bundle.encounters).toHaveLength(1);
    const report = await applyTransfer(bundle, new Set<Section>(["encounters"]));
    expect(report.encounters).toEqual({ added: 1, skipped: 0, replaced: 0 });
    const back = await listEncounters();
    expect(back).toHaveLength(1);
    expect(back[0]?.id).toBe(mine.id);
    expect(back[0]?.combatants[0]?.name).toBe("Orc");
  });

  it("leaves a fight that is the same, and follows the policy for one that differs", async () => {
    await clear();
    const here = fight("Ambush", 10);
    await saveEncounter(here);
    const newer: Encounter = { ...here, name: "Ambush (changed)", updated: 20 };
    const older: Encounter = { ...here, name: "Ambush (old)", updated: 5 };
    const bundle = (list: Encounter[]): Bundle => ({
      format: TRANSFER_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      encounters: list,
    });
    const only = new Set<Section>(["encounters"]);

    expect((await applyTransfer(bundle([here]), only)).encounters).toEqual({
      added: 0,
      skipped: 1,
      replaced: 0,
    });
    expect((await applyTransfer(bundle([newer]), only, "keep")).encounters?.skipped).toBe(1);
    expect((await applyTransfer(bundle([older]), only, "newest")).encounters?.skipped).toBe(1);
    expect((await listEncounters())[0]?.name).toBe("Ambush");
    expect((await applyTransfer(bundle([newer]), only, "newest")).encounters?.replaced).toBe(1);
    expect((await listEncounters())[0]?.name).toBe("Ambush (changed)");
    const copied = await applyTransfer(bundle([older]), only, "copy");
    expect(copied.encounters?.added).toBe(1);
    expect(await listEncounters()).toHaveLength(2);
  });

  it("skips what is not a fight and counts it", async () => {
    await clear();
    const bundle: Bundle = {
      format: TRANSFER_FORMAT,
      version: 1,
      exportedAt: new Date().toISOString(),
      encounters: [{ nonsense: true }, "text", fight("ok")],
    };
    const report = await applyTransfer(bundle, new Set<Section>(["encounters"]));
    expect(report.encounters?.added).toBe(1);
    expect(report.unreadable).toBe(2);
  });
});
