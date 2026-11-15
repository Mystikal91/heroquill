import { signal } from "@preact/signals";
import { applyIdMap, nameBasedId } from "../homebrew/arrange";
import { startEntry } from "../homebrew/blanks";
import { updateEntry } from "../homebrew/entries";
import { newHomebrewPack } from "../homebrew/pack";
import { ui } from "../i18n/ui";
import type { UserPackRecord } from "../storage/packs";
import { updateCharacter } from "./store";
import { addUserPack, userPacks } from "./userPacks";

/** The id of the homebrew pack that holds the spells written from a character. */
export const PERSONAL_SPELLS_PACK = "hbmyspells";

/** The class a custom spell is written for and the list it goes to (`class|list`), while the window is open. */
export const customSpellFor = signal<string | undefined>(undefined);

/** The pack of the spells written from characters: found, or made the first time. */
function personalPack(): UserPackRecord {
  const found = userPacks.value.find((p) => p.id === PERSONAL_SPELLS_PACK);
  if (found) return found;
  const record = newHomebrewPack(ui("spells.myPack"));
  return {
    ...record,
    id: PERSONAL_SPELLS_PACK,
    pack: { ...record.pack, manifest: { ...record.pack.manifest, id: PERSONAL_SPELLS_PACK } },
  };
}

/**
 * A new spell, empty but valid, in the pack of written spells, for a class: the window edits this
 * record as it is and nothing is stored until the person saves.
 */
export function startCustomSpell(classId: string): { record: UserPackRecord; id: string } {
  const started = startEntry(personalPack(), "spell");
  return {
    id: started.id,
    record: updateEntry(started.record, started.id, { data: { classes: [classId] } }),
  };
}

/**
 * Saves the spell written in the window and puts it in the character's list for the class: the
 * cantrips for a cantrip, the other list the class picks from for the others.
 */
export async function addCustomSpell(
  record: UserPackRecord,
  spellId: string,
  classId: string,
  /** The list of the class for a spell of a level: the one the class picks its spells from. */
  list: "known" | "prepared",
): Promise<string> {
  // The spell was started without a name, so its id is only a stand-in: it gets one from the name.
  const name = record.strings[`${spellId}.name`] ?? "";
  const better = nameBasedId(record, spellId, name);
  const final = better ?? spellId;
  const saved = better ? applyIdMap(record, new Map([[spellId, better]])) : record;
  await addUserPack(saved);
  const entry = saved.pack.entries.find((e) => e.id === final);
  const level = Number(entry?.data.level) || 0;
  updateCharacter((d) => {
    const lists = d.spells[classId] ?? { cantrips: [], known: [], prepared: [] };
    d.spells[classId] = lists;
    const target = level === 0 ? lists.cantrips : lists[list];
    if (!target.includes(final)) target.push(final);
  });
  return final;
}
