import { PDFDocument } from "pdf-lib";
import { readPage } from "./read";
import { type Paper, renderPages } from "./render";

/** Millimetres to points. */
const MM = 72 / 25.4;

const PAPERS: Record<"a4" | "letter", Paper> = {
  a4: { width: 210 * MM, height: 297 * MM, margin: 12 * MM },
  letter: { width: 8.5 * 72, height: 11 * 72, margin: 12 * MM },
};

/**
 * A PDF of the print pages as they are on screen: the same layout, vector lines and real text, with
 * the values of the sheet as form fields that any PDF reader lets the person change. Each `.p-page`
 * of the paper is one sheet (the pages are laid out by the app, see `FlowPages`).
 */
export async function writePdf(
  paperElement: HTMLElement,
  options: { paper: "a4" | "letter"; title: string; lang: string },
): Promise<Uint8Array> {
  await document.fonts?.ready;
  const pages = [...paperElement.querySelectorAll<HTMLElement>(":scope > .p-page")].filter(
    (page) => page.getBoundingClientRect().height > 0,
  );
  const ops = pages.map((page) => readPage(page, options.lang));
  const doc = await PDFDocument.create();
  doc.setTitle(options.title);
  doc.setCreator("Heroquill (heroquill.app)");
  doc.setProducer("Heroquill");
  doc.setLanguage(options.lang);
  await renderPages(doc, ops, PAPERS[options.paper]);
  // The fields already have their appearance in the sheet's fonts; letting pdf-lib redo it would use Helvetica.
  return doc.save({ updateFieldAppearances: false });
}
