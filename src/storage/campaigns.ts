import { type Campaign, readCampaign } from "../engine/campaign";
import { dbDelete, dbGet, dbGetAll, dbPut } from "./db";

const CURRENT_KEY = "currentCampaignId";

export const saveCampaign = (campaign: Campaign) => dbPut("campaigns", campaign);

/** All the campaigns, the one changed last first. Unreadable records are skipped. */
export async function listCampaigns(): Promise<Campaign[]> {
  const records = await dbGetAll<unknown>("campaigns");
  return records
    .map(readCampaign)
    .filter((c): c is Campaign => c !== undefined)
    .sort((a, b) => b.updated - a.updated);
}

export const deleteCampaign = (id: string) => dbDelete("campaigns", id);

export const getCurrentCampaignId = () => dbGet<string>("meta", CURRENT_KEY);
export const setCurrentCampaignId = (id: string) => dbPut("meta", id, CURRENT_KEY);
