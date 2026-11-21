import { type Encounter, readEncounter } from "../engine/encounter";
import { uuid } from "../engine/uuid";
import { ui } from "../i18n/ui";
import { listEncounters, saveEncounter } from "../storage/encounters";
import { encountersChanged, refreshEncounterCount } from "./encounterCount";
import type { ConflictPolicy } from "./store";

const same = (a: Encounter, b: Encounter) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Puts the fights of a file next to the ones here. A fight that is here and the same is left alone;
 * with the same id and other content it follows the policy of the characters: the newest wins, the one
 * here is kept, or both are kept (the incoming one as a copy). Anything that is not a fight is skipped
 * and counted.
 */
export async function restoreEncounters(
  raw: readonly unknown[],
  policy: ConflictPolicy = "copy",
): Promise<{ added: number; skipped: number; replaced: number; unreadable: number }> {
  const here = new Map((await listEncounters()).map((e) => [e.id, e]));
  let added = 0;
  let skipped = 0;
  let replaced = 0;
  let unreadable = 0;
  for (const item of raw) {
    const incoming = readEncounter(item);
    if (!incoming) {
      unreadable += 1;
      continue;
    }
    const mine = here.get(incoming.id);
    if (!mine) {
      await saveEncounter(incoming);
      added += 1;
    } else if (same(mine, incoming)) {
      skipped += 1;
    } else if (policy === "keep" || (policy === "newest" && incoming.updated <= mine.updated)) {
      skipped += 1;
    } else if (policy === "newest") {
      await saveEncounter(incoming);
      replaced += 1;
    } else {
      await saveEncounter({
        ...incoming,
        id: uuid(),
        name: ui("dm.copyName", { name: incoming.name || ui("dm.unnamed") }),
      });
      added += 1;
    }
  }
  await refreshEncounterCount();
  encountersChanged.value += 1;
  return { added, skipped, replaced, unreadable };
}
