// @vitest-environment happy-dom
import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../content/browser";
import { createCharacter } from "../engine/character";
import { setText, updateEntry } from "../homebrew/entries";
import { PERSONAL_SPELLS_PACK, addCustomSpell, startCustomSpell } from "./customSpell";
import { character, content } from "./store";
import { userPacks } from "./userPacks";

/** What the window does: a spell started for a class, named, given a level, and saved. */
async function write(classId: string, list: "known" | "prepared", name: string, level: number) {
  const started = startCustomSpell(classId);
  let record = setText(started.record, started.id, "name", name);
  record = setText(record, started.id, "desc", "Dust speaks.");
  record = updateEntry(record, started.id, { data: { level } });
  return addCustomSpell(record, started.id, classId, list);
}

describe("a spell written from a character", () => {
  beforeAll(async () => {
    content.value = await loadContent(["en"]);
    userPacks.value = [];
    character.value = createCharacter("srd51");
  });

  it("goes in a pack of its own and in the list of the class, a cantrip in the cantrips", async () => {
    const id = await write("srd51:class/wizard", "known", "Whisper of Dust", 1);
    const cantrip = await write("srd51:class/wizard", "known", "Dust Mote", 0);
    const pack = userPacks.value.find((p) => p.id === PERSONAL_SPELLS_PACK);
    expect(pack?.origin).toBe("homebrew");
    expect(id).toBe(`${PERSONAL_SPELLS_PACK}:spell/whisper-of-dust`);
    expect(pack?.strings[`${id}.name`]).toBe("Whisper of Dust");
    const entry = pack?.pack.entries.find((e) => e.id === id);
    expect(entry?.data).toMatchObject({ level: 1, classes: ["srd51:class/wizard"] });
    const lists = character.value.spells["srd51:class/wizard"];
    expect(lists?.known).toEqual([id]);
    expect(lists?.cantrips).toEqual([cantrip]);
  });

  it("uses the list of prepared spells for a class that prepares", async () => {
    const id = await write("srd51:class/cleric", "prepared", "Bright Verse", 1);
    expect(character.value.spells["srd51:class/cleric"]?.prepared).toEqual([id]);
    // The pack is the same one, with all the spells in it.
    expect(userPacks.value.filter((p) => p.id === PERSONAL_SPELLS_PACK)).toHaveLength(1);
  });
});
