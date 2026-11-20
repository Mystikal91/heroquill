// The blank fillable character sheets offered on the website, made by the app itself
// (`npm run site:sheets`, scripts/print-check/blankSheets.ts) and kept in site/sheets/: one for each
// language and edition, on A4, and on US Letter for English too. The build copies them to /sheets/.

const NAMES = {
  en: "dnd-5e-character-sheet",
  it: "scheda-personaggio-dnd-5e",
  fr: "fiche-personnage-dnd-5e",
  de: "dnd-5e-charakterbogen",
  es: "hoja-personaje-dnd-5e",
};

export const EDITIONS = ["2014", "2024"];

/** The ruleset of the app for an edition. */
export const RULESET = { 2014: "srd51", 2024: "srd52" };

/** Every sheet: language, edition, paper and the name of its file. */
export const SHEETS = Object.keys(NAMES).flatMap((lang) =>
  EDITIONS.flatMap((edition) =>
    (lang === "en" ? ["a4", "letter"] : ["a4"]).map((paper) => ({
      lang,
      edition,
      paper,
      file: `heroquill-${NAMES[lang]}-${edition}${paper === "letter" ? "-letter" : ""}.pdf`,
    })),
  ),
);

/** The address of a sheet on the website. */
export const sheetUrl = (sheet) => `/sheets/${sheet.file}`;
