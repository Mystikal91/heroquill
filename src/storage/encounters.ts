import { type Encounter, readEncounter } from "../engine/encounter";
import { dbDelete, dbGet, dbGetAll, dbPut } from "./db";

const CURRENT_KEY = "currentEncounterId";

/** Stores an encounter. */
export const saveEncounter = (encounter: Encounter) => dbPut("encounters", encounter);

/** One encounter; undefined when it is missing or unreadable. */
export async function loadEncounter(id: string): Promise<Encounter | undefined> {
  return readEncounter(await dbGet<unknown>("encounters", id));
}

/** All the encounters, the one changed last first. Unreadable records are skipped. */
export async function listEncounters(): Promise<Encounter[]> {
  const records = await dbGetAll<unknown>("encounters");
  return records
    .map(readEncounter)
    .filter((e): e is Encounter => e !== undefined)
    .sort((a, b) => b.updated - a.updated);
}

export const deleteEncounter = (id: string) => dbDelete("encounters", id);

export const getCurrentEncounterId = () => dbGet<string>("meta", CURRENT_KEY);
export const setCurrentEncounterId = (id: string) => dbPut("meta", id, CURRENT_KEY);
