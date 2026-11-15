import { PACK_FORMAT_VERSION } from "../storage/packFormat";
import type { UserPackRecord } from "../storage/packs";

/** A new homebrew pack with nothing in it yet. */
export function newHomebrewPack(name: string, now = Date.now()): UserPackRecord {
  const id = `hb${now.toString(36)}`;
  return {
    id,
    name: name.trim() || "My homebrew",
    origin: "homebrew",
    addedAt: now,
    lang: "en",
    formatVersion: PACK_FORMAT_VERSION,
    pack: {
      manifest: {
        id,
        ruleset: "custom",
        version: "1",
        license: "Homebrew content written by its author",
        attribution: "Homebrew content written by the user.",
      },
      entries: [],
    },
    strings: {},
  };
}
