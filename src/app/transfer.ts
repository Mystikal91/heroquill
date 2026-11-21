import { parseCharacter } from "../engine/characterSchema";
import {
  type Bundle,
  type PackLink,
  type Section,
  type Sources,
  buildBundle,
  linksOf,
  onlySections,
  serializeBundle,
  transferFileName,
} from "../storage/bundle";
import { listCampaigns } from "../storage/campaigns";
import { dbEntries, dbPut } from "../storage/db";
import { listEncounters } from "../storage/encounters";
import { type UserPackRecord, parseUserPack } from "../storage/packs";
import {
  autoSettings,
  cachedCount,
  forgetEngines,
  loadTranslationCache,
  saveAutoSettings,
} from "../translate/auto";
import { encounterCount } from "./encounterCount";
import { LANGUAGES } from "./language";
import { language } from "./language";
import { printSettings } from "./printSettings";
import { parsePrintSettings } from "./printSettings.logic";
import { restoreCampaigns, restoreEncounters } from "./restoreEncounters";
import { type ConflictPolicy, allCharacters, characters, restoreCharacters } from "./store";
import { theme } from "./theme";
import { parseTheme } from "./theme.logic";
import { UNIT_SETTINGS, type UnitSetting, unitSetting } from "./units";
import {
  addUserPack,
  importAuroraAddresses,
  keepEditions,
  packFromAddress,
  userPacks,
} from "./userPacks";

/** What the app holds now, to put in a file. Reads every character, so it takes a moment. */
export async function currentSources(): Promise<Sources> {
  const auto = autoSettings.value;
  const all = await allCharacters();
  return {
    characters: all,
    characterTimes: Object.fromEntries(
      characters.value
        .filter((s) => all.some((c) => c.id === s.id))
        .map((s) => [s.id, s.updatedAt]),
    ),
    encounters: await listEncounters(),
    campaigns: await listCampaigns(),
    packs: userPacks.value,
    settings: {
      language: language.value,
      theme: theme.value,
      units: unitSetting.value,
      print: printSettings.value,
      translate: {
        enabled: auto.enabled,
        relay: auto.relay,
        descriptionsOnly: auto.descriptionsOnly,
      },
    },
    deeplKey: auto.key,
    translations: await dbEntries<string>("translations"),
  };
}

/** How much there is of each part, and which packs cannot travel, for the export window. */
export function currentCounts(): { counts: Record<Section, number>; files: string[] } {
  const { links, files } = linksOf(userPacks.value);
  return {
    counts: {
      characters: characters.value.length,
      encounters: encounterCount.value,
      homebrew: userPacks.value.filter((p) => p.origin === "homebrew").length,
      edits: userPacks.value.filter((p) => p.origin === "edits").length,
      links: links.length,
      settings: 1,
      deeplKey: autoSettings.value.key ? 1 : 0,
      translations: cachedCount.value,
    },
    files,
  };
}

/** The text and the name of the file for the chosen parts, protected when there is a passphrase. */
export async function exportTransfer(
  include: ReadonlySet<Section>,
  passphrase: string,
): Promise<{ text: string; name: string }> {
  const bundle = buildBundle(await currentSources(), include);
  return { text: await serializeBundle(bundle, passphrase || undefined), name: transferFileName() };
}

export interface TransferReport {
  characters?: { added: number; skipped: number; replaced: number };
  encounters?: { added: number; skipped: number; replaced: number };
  packs?: number;
  edits?: number;
  settings?: boolean;
  deeplKey?: boolean;
  translations?: number;
  /** Packs of Aurora to download again, not yet downloaded. */
  links: PackLink[];
  /** Parts of the file that could not be read. */
  unreadable: number;
}

async function pack(
  raw: unknown,
  origin: "homebrew" | "edits",
): Promise<UserPackRecord | undefined> {
  try {
    return parseUserPack({ ...(raw as object), origin });
  } catch {
    return undefined;
  }
}

/** Puts the chosen parts of a transfer file into the app. Nothing is downloaded yet. */
export async function applyTransfer(
  bundle: Bundle,
  include: ReadonlySet<Section>,
  /** What to do with a character that is here with other content. */
  conflicts: ConflictPolicy = "copy",
): Promise<TransferReport> {
  const chosen = onlySections(bundle, include);
  const report: TransferReport = { links: [], unreadable: 0 };

  if (chosen.characters) {
    const list = chosen.characters.flatMap((raw) => {
      try {
        return [parseCharacter(raw)];
      } catch {
        report.unreadable += 1;
        return [];
      }
    });
    report.characters = await restoreCharacters(list, conflicts, chosen.characterTimes);
  }

  if (chosen.encounters) {
    await restoreCampaigns(chosen.campaigns ?? [], conflicts);
    const done = await restoreEncounters(chosen.encounters, conflicts);
    report.unreadable += done.unreadable;
    report.encounters = { added: done.added, skipped: done.skipped, replaced: done.replaced };
  }

  if (chosen.homebrew) {
    let done = 0;
    for (const raw of chosen.homebrew) {
      const record = await pack(raw, "homebrew");
      if (!record) {
        report.unreadable += 1;
        continue;
      }
      const here = userPacks.value.find((p) => p.id === record.id);
      await addUserPack({ ...record, addedAt: here?.addedAt ?? record.addedAt });
      done += 1;
    }
    report.packs = done;
  }

  if (chosen.edits) {
    let done = 0;
    for (const raw of chosen.edits) {
      const record = await pack(raw, "edits");
      if (!record) {
        report.unreadable += 1;
        continue;
      }
      const here = userPacks.value.find((p) => p.id === record.id);
      // The texts of both devices are kept; where both rewrote one, the file wins.
      await addUserPack({
        ...record,
        strings: { ...here?.strings, ...record.strings },
        addedAt: here?.addedAt ?? record.addedAt,
      });
      done += 1;
    }
    report.edits = done;
  }

  const settings = chosen.settings;
  if (settings) {
    if (LANGUAGES.some((l) => l.code === settings.language))
      language.value = settings.language as (typeof LANGUAGES)[number]["code"];
    if (settings.theme) theme.value = parseTheme(JSON.stringify(settings.theme));
    if (UNIT_SETTINGS.includes(settings.units as UnitSetting))
      unitSetting.value = settings.units as UnitSetting;
    if (settings.print) printSettings.value = parsePrintSettings(JSON.stringify(settings.print));
    if (settings.translate)
      saveAutoSettings({
        ...autoSettings.value,
        enabled: settings.translate.enabled === true,
        relay: settings.translate.relay || autoSettings.value.relay,
        descriptionsOnly: settings.translate.descriptionsOnly !== false,
      });
    report.settings = true;
  }

  if (chosen.deeplKey) {
    saveAutoSettings({ ...autoSettings.value, key: chosen.deeplKey });
    report.deeplKey = true;
  }

  if (chosen.translations) {
    for (const [key, text] of chosen.translations)
      if (typeof key === "string" && typeof text === "string")
        await dbPut("translations", text, key);
    // Texts that come in a file are taken as DeepL's, whatever was kept here for the same key.
    forgetEngines(chosen.translations.map(([key]) => key));
    await loadTranslationCache();
    report.translations = chosen.translations.length;
  }

  // The addresses are listed, not followed: downloading is the person's next step.
  report.links = (chosen.links ?? []).filter((l) => !packFromAddress(l.url));
  return report;
}

/** Downloads the packs of Aurora again, one after the other, from their addresses. */
export async function downloadLinks(links: PackLink[]): Promise<void> {
  const before = keepEditions.value;
  try {
    for (const link of links) {
      keepEditions.value = link.keepEditions ?? false;
      // The pack keeps the id it had, so the characters that use it find their entries.
      await importAuroraAddresses(link.urls ?? [link.url], undefined, link.id);
    }
  } finally {
    keepEditions.value = before;
  }
}
