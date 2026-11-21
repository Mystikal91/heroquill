import { signal } from "@preact/signals";
import { dbGetAll } from "../storage/db";

/**
 * How many fights of the Dungeon Master mode are saved, for the window that moves data to another
 * device (it counts what is there without opening the DM page). Kept up to date by the DM mode and
 * after a transfer.
 */
export const encounterCount = signal(0);

/** Raised when something other than the DM page changed the saved fights (a transfer), so the page reads them again. */
export const encountersChanged = signal(0);

export async function refreshEncounterCount(): Promise<void> {
  try {
    encounterCount.value = (await dbGetAll<unknown>("encounters")).length;
  } catch {
    // No database (a private window): there is nothing to count.
  }
}
