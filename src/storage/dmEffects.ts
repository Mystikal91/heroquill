import { type SavedEffect, readSavedEffects } from "../engine/savedEffects";
import { dbGet, dbPut } from "./db";

const KEY = "dmEffects";

/** The effects the DM kept to use again, for every campaign of this device. */
export const loadSavedEffects = async (): Promise<SavedEffect[]> =>
  readSavedEffects(await dbGet<unknown>("meta", KEY));

export const storeSavedEffects = (list: readonly SavedEffect[]) => dbPut("meta", list, KEY);
