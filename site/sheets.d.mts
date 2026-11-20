// Types of sheets.mjs, for the scripts written in TypeScript.
export interface Sheet {
  lang: "en" | "it" | "fr" | "de" | "es";
  edition: "2014" | "2024";
  paper: "a4" | "letter";
  file: string;
}
export const EDITIONS: Sheet["edition"][];
export const RULESET: Record<Sheet["edition"], "srd51" | "srd52">;
export const SHEETS: Sheet[];
export function sheetUrl(sheet: Sheet): string;
