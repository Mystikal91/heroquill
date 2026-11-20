import cinzel600 from "@fontsource/cinzel/files/cinzel-latin-600-normal.woff?url";
import cinzel700 from "@fontsource/cinzel/files/cinzel-latin-700-normal.woff?url";
import cinzel600x from "@fontsource/cinzel/files/cinzel-latin-ext-600-normal.woff?url";
import cinzel700x from "@fontsource/cinzel/files/cinzel-latin-ext-700-normal.woff?url";
import garamond400i from "@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff?url";
import garamond400 from "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff?url";
import garamond600 from "@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff?url";
import garamond400ix from "@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-italic.woff?url";
import garamond400x from "@fontsource/eb-garamond/files/eb-garamond-latin-ext-400-normal.woff?url";
import garamond600x from "@fontsource/eb-garamond/files/eb-garamond-latin-ext-600-normal.woff?url";
import fontkit from "@pdf-lib/fontkit";
import type { PDFDocument, PDFFont } from "pdf-lib";
import type { FaceKey } from "./ops";
import { woffToSfnt } from "./woff";

/**
 * The faces of the sheet, the same files the app shows (as WOFF, the older form the style sheets
 * offer too): each comes in two parts, the Latin letters and the rest of the European ones, and a
 * character is drawn with the part that has it.
 */
const FILES: Record<FaceKey, [latin: string, extended: string]> = {
  "display-600": [cinzel600, cinzel600x],
  "display-700": [cinzel700, cinzel700x],
  "text-400": [garamond400, garamond400x],
  "text-400-italic": [garamond400i, garamond400ix],
  "text-600": [garamond600, garamond600x],
};

/** One part of a face: the font in the PDF and what the browser needs to place its letters. */
export interface FacePart {
  font: PDFFont;
  has(codePoint: number): boolean;
  /** Ascent and descent of the font for a size of 1. */
  ascent: number;
  descent: number;
}

export type Faces = Map<FaceKey, FacePart[]>;

interface FontkitFont {
  ascent: number;
  descent: number;
  unitsPerEm: number;
  hasGlyphForCodePoint(codePoint: number): boolean;
}

const fonts = new Map<string, Promise<Uint8Array>>();

/** A font file as a plain OpenType font, which a PDF can hold (a WOFF file cannot be embedded as it is). */
function load(url: string): Promise<Uint8Array> {
  let pending = fonts.get(url);
  if (!pending) {
    pending = fetch(url).then(async (response) => {
      if (!response.ok) throw new Error(`Font ${url}: ${response.status}`);
      return woffToSfnt(new Uint8Array(await response.arrayBuffer()));
    });
    fonts.set(url, pending);
    // A failed download is tried again next time.
    pending.catch(() => fonts.delete(url));
  }
  return pending;
}

async function embedPart(doc: PDFDocument, url: string): Promise<FacePart> {
  const data = await load(url);
  const metrics = fontkit.create(data) as unknown as FontkitFont;
  // Whole, not cut down to the letters on the pages, so that a person can type any letter in a field.
  // No ligatures: the PDF readers spaced the letters after a ligature too wide.
  const font = await doc.embedFont(data, {
    subset: false,
    features: { liga: false, clig: false, dlig: false },
  });
  return {
    font,
    has: (cp) => metrics.hasGlyphForCodePoint(cp),
    ascent: metrics.ascent / metrics.unitsPerEm,
    descent: metrics.descent / metrics.unitsPerEm,
  };
}

/**
 * Embeds the faces the pages use, given the characters each one writes: the Latin part always, the
 * other part only when a character needs it.
 */
export async function embedFaces(
  doc: PDFDocument,
  needs: Map<FaceKey, Set<number>>,
): Promise<Faces> {
  doc.registerFontkit(fontkit);
  const faces: Faces = new Map();
  for (const [key, codePoints] of needs) {
    const [latinUrl, extendedUrl] = FILES[key];
    const latin = await embedPart(doc, latinUrl);
    const parts = [latin];
    if ([...codePoints].some((cp) => !latin.has(cp))) parts.push(await embedPart(doc, extendedUrl));
    faces.set(key, parts);
  }
  return faces;
}
