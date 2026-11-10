import { readFileSync } from "node:fs";
import { withOriginRules } from "../data/originRules";
import { type Pack, parsePack } from "../data/schema";
import { indexPacks } from "../engine/derive";
import { srd51Packs } from "./srd51";

/** Loads the committed output of `npm run data:srd52` for tests (the pilot: see `scripts/srd52`). */
export const SRD52_FILES = [
  "abilities",
  "skills",
  "languages",
  "proficiencies",
  "feats",
  "backgrounds",
  "species",
  "traits",
  "classes",
  "subclasses",
  "spells",
  "schools",
  "conditions",
  "features",
  "items",
  "properties",
] as const;

export const loadSrd52Pack = (file: string): Pack =>
  withOriginRules(parsePack(JSON.parse(readFileSync(`data/srd52/${file}.json`, "utf8"))));

export const srd52Packs = SRD52_FILES.map(loadSrd52Pack);
/** Only the 2024 SRD, as a character of that edition with no added packs sees it. */
export const srd52Index = indexPacks(...srd52Packs);
/** Both editions loaded together, as the app loads them. */
export const bothIndex = indexPacks(...srd51Packs, ...srd52Packs);
