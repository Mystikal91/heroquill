import type { Character } from "../engine/character";
import type { Encounter } from "../engine/encounter";
import { type Sealed, isSealed, seal, unseal } from "./crypto";
import { type UserPackRecord, addressesOf } from "./packs";

export const TRANSFER_FORMAT = "dnd-character-maker-transfer";

/** The parts of a transfer file the person can leave in or out. */
export const SECTIONS = [
  "characters",
  "encounters",
  "homebrew",
  "edits",
  "links",
  "settings",
  "deeplKey",
  "translations",
] as const;
export type Section = (typeof SECTIONS)[number];

/** What is on by default when exporting: everything except the key and the saved translations. */
export const DEFAULT_SECTIONS: Section[] = [
  "characters",
  "encounters",
  "homebrew",
  "edits",
  "links",
  "settings",
];

/** The look and behaviour settings of the app, as the other device will apply them. */
export interface TransferSettings {
  language?: string;
  theme?: unknown;
  units?: string;
  print?: unknown;
  translate?: { enabled: boolean; relay: string; descriptionsOnly: boolean };
}

/** An imported pack that can be downloaded again, with how it was imported. */
export interface PackLink {
  /** The id the pack had, so that the entries characters use keep their names. */
  id?: string;
  name: string;
  url: string;
  /** All the addresses of a pack that was made from several indexes read together. */
  urls?: string[];
  keepEditions?: boolean;
}

export interface Bundle {
  format: typeof TRANSFER_FORMAT;
  version: 1;
  exportedAt: string;
  characters?: unknown[];
  /** When each character last changed (by id, in milliseconds), to tell which copy is newer. */
  characterTimes?: Record<string, number>;
  /** The fights of the Dungeon Master mode, whole. */
  encounters?: unknown[];
  /** Homebrew packs, whole. */
  homebrew?: unknown[];
  /** The quick edits of each language, whole. */
  edits?: unknown[];
  /** Packs of other tools travel as addresses only: their content is downloaded again. */
  links?: PackLink[];
  /** Names of packs made from files, which cannot travel. Only to tell the person. */
  files?: string[];
  settings?: TransferSettings;
  deeplKey?: string;
  translations?: [string, string][];
}

/** What the app has now, to take from. */
export interface Sources {
  characters: Character[];
  characterTimes?: Record<string, number>;
  /** The fights of the Dungeon Master mode. */
  encounters?: Encounter[];
  packs: UserPackRecord[];
  settings: TransferSettings;
  deeplKey: string;
  translations: [string, string][];
}

/** The packs that are imported from Aurora, split into those with an address and the rest. */
export function linksOf(packs: UserPackRecord[]): { links: PackLink[]; files: string[] } {
  const links: PackLink[] = [];
  const files: string[] = [];
  for (const record of packs.filter((p) => p.origin === "personal")) {
    if (record.source?.url)
      links.push({
        id: record.id,
        name: record.name,
        url: record.source.url,
        ...(addressesOf(record).length > 1 && { urls: addressesOf(record) }),
        ...(record.keepEditions !== undefined && { keepEditions: record.keepEditions }),
      });
    else files.push(record.name);
  }
  return { links, files };
}

/** The transfer file with only the sections asked for. */
export function buildBundle(
  sources: Sources,
  include: ReadonlySet<Section>,
  now = new Date(),
): Bundle {
  const has = (section: Section) => include.has(section);
  const { links, files } = linksOf(sources.packs);
  return {
    format: TRANSFER_FORMAT,
    version: 1,
    exportedAt: now.toISOString(),
    ...(has("characters") && { characters: sources.characters }),
    ...(has("characters") && sources.characterTimes && { characterTimes: sources.characterTimes }),
    ...(has("encounters") && { encounters: sources.encounters ?? [] }),
    ...(has("homebrew") && { homebrew: sources.packs.filter((p) => p.origin === "homebrew") }),
    ...(has("edits") && { edits: sources.packs.filter((p) => p.origin === "edits") }),
    ...(has("links") && { links, files }),
    ...(has("settings") && { settings: sources.settings }),
    ...(has("deeplKey") && sources.deeplKey && { deeplKey: sources.deeplKey }),
    ...(has("translations") && { translations: sources.translations }),
  };
}

/** How much of each section a file holds; a section that is absent counts zero. */
export function describeBundle(bundle: Bundle): Record<Section, number> {
  return {
    characters: bundle.characters?.length ?? 0,
    encounters: bundle.encounters?.length ?? 0,
    homebrew: bundle.homebrew?.length ?? 0,
    edits: bundle.edits?.length ?? 0,
    links: bundle.links?.length ?? 0,
    settings: bundle.settings ? 1 : 0,
    deeplKey: bundle.deeplKey ? 1 : 0,
    translations: bundle.translations?.length ?? 0,
  };
}

/** The same file with only the chosen sections left. */
export function onlySections(bundle: Bundle, include: ReadonlySet<Section>): Bundle {
  const out: Bundle = { ...bundle };
  if (!include.has("characters")) {
    out.characters = undefined;
    out.characterTimes = undefined;
  }
  if (!include.has("encounters")) out.encounters = undefined;
  if (!include.has("homebrew")) out.homebrew = undefined;
  if (!include.has("edits")) out.edits = undefined;
  if (!include.has("links")) {
    out.links = undefined;
    out.files = undefined;
  }
  if (!include.has("settings")) out.settings = undefined;
  if (!include.has("deeplKey")) out.deeplKey = undefined;
  if (!include.has("translations")) out.translations = undefined;
  return out;
}

export class TransferParseError extends Error {}

export type Opened = { kind: "plain"; bundle: Bundle } | { kind: "sealed"; sealed: Sealed };

const isBundle = (raw: unknown): raw is Bundle =>
  typeof raw === "object" &&
  raw !== null &&
  (raw as { format?: unknown }).format === TRANSFER_FORMAT;

/** Tells what a file is: a transfer file, a protected one, or neither (undefined). */
export function openTransfer(text: string): Opened | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (isSealed(raw)) return { kind: "sealed", sealed: raw };
  if (isBundle(raw)) return { kind: "plain", bundle: raw };
  return undefined;
}

/** Opens a protected file; throws `WrongPassphrase`, or `TransferParseError` for odd contents. */
export async function openSealed(sealed: Sealed, passphrase: string): Promise<Bundle> {
  const text = await unseal(sealed, passphrase);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new TransferParseError("The file does not hold a transfer");
  }
  if (!isBundle(raw)) throw new TransferParseError("The file does not hold a transfer");
  return raw;
}

/** The text of a file: plain, or protected when there is a passphrase. */
export async function serializeBundle(bundle: Bundle, passphrase?: string): Promise<string> {
  const plain = `${JSON.stringify(bundle, null, 2)}\n`;
  if (!passphrase) return plain;
  return `${JSON.stringify(await seal(plain, passphrase), null, 2)}\n`;
}

export const transferFileName = (now = new Date()) =>
  `dnd-transfer-${now.toISOString().slice(0, 10)}.dndtransfer.json`;
