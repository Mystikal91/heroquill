import {
  type PDFDocument,
  type PDFFont,
  type PDFForm,
  type PDFOperator,
  type PDFPage,
  TextAlignment,
  appendBezierCurve,
  beginMarkedContent,
  beginText,
  clip,
  closePath,
  endMarkedContent,
  endPath,
  endText,
  fill,
  lineTo,
  moveText,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  setCharacterSpacing,
  setCharacterSqueeze,
  setFillingColor,
  setFontAndSize,
  showText,
} from "pdf-lib";
import { type FacePart, type Faces, embedFaces } from "./fonts";
import type { Box, FaceKey, Op, Rgb } from "./ops";

/**
 * Draws what `readPage` read on a PDF page. Coordinates come in CSS pixels from the top left
 * corner of the page box; the PDF counts points from the bottom left corner of the paper.
 */

/** Points in a CSS pixel. */
const PT = 0.75;

/** Characters the fonts lack, drawn as shapes: the round and square marks of the lists. */
const SHAPES: Record<string, "disc" | "ring" | "square" | "box"> = {
  "●": "disc",
  "○": "ring",
  "■": "square",
  "□": "box",
};

interface Place {
  page: PDFPage;
  /** Where the page box starts on the paper, in points from the left and from the top. */
  left: number;
  top: number;
  height: number;
}

const colour = (c: Rgb) => rgb(c.r, c.g, c.b);
const X = (p: Place, x: number) => p.left + x * PT;
const Y = (p: Place, y: number) => p.height - p.top - y * PT;

function pathOps(p: Place, points: [number, number][]): PDFOperator[] {
  const [first, ...rest] = points;
  if (!first) return [];
  return [
    moveTo(X(p, first[0]), Y(p, first[1])),
    ...rest.map(([x, y]) => lineTo(X(p, x), Y(p, y))),
    closePath(),
  ];
}

function svgPath(points: [number, number][]): string {
  return `${points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x * PT} ${y * PT}`).join(" ")} Z`;
}

function roundedPath(b: Box, r: number): string {
  const x = b.x * PT;
  const y = b.y * PT;
  const w = b.w * PT;
  const h = b.h * PT;
  const k = Math.min(r * PT, w / 2, h / 2);
  return [
    `M${x + k} ${y}`,
    `L${x + w - k} ${y}`,
    `Q${x + w} ${y} ${x + w} ${y + k}`,
    `L${x + w} ${y + h - k}`,
    `Q${x + w} ${y + h} ${x + w - k} ${y + h}`,
    `L${x + k} ${y + h}`,
    `Q${x} ${y + h} ${x} ${y + h - k}`,
    `L${x} ${y + k}`,
    `Q${x} ${y} ${x + k} ${y}`,
    "Z",
  ].join(" ");
}

/** The part of a face that has a character, the first one when none has it. */
function partFor(parts: FacePart[], cp: number): FacePart | undefined {
  return parts.find((part) => part.has(cp));
}

function drawShape(
  p: Place,
  kind: (typeof SHAPES)[string],
  x: number,
  box: Box,
  size: number,
  color: Rgb,
) {
  const s = size * 0.62;
  const cx = x + s / 2 + size * 0.05;
  const cy = box.y + box.h / 2;
  const options = {
    color: colour(color),
    borderColor: colour(color),
    borderWidth: size * 0.06 * PT,
  };
  if (kind === "disc" || kind === "ring")
    p.page.drawEllipse({
      x: X(p, cx),
      y: Y(p, cy),
      xScale: (s / 2) * PT,
      yScale: (s / 2) * PT,
      ...(kind === "disc"
        ? { color: options.color }
        : { borderColor: options.borderColor, borderWidth: options.borderWidth }),
    });
  else
    p.page.drawRectangle({
      x: X(p, cx - s / 2),
      y: Y(p, cy + s / 2),
      width: s * PT,
      height: s * PT,
      ...(kind === "square"
        ? { color: options.color }
        : { borderColor: options.borderColor, borderWidth: options.borderWidth }),
    });
  return size * 0.8;
}

/**
 * The text with the characters no part of the face has written as plain letters when they are a
 * compatibility form: the ligatures "ﬁ" and "ﬂ" of texts copied from the books, a non-breaking hyphen.
 */
export function drawable(text: string, parts: FacePart[]): string {
  let out = "";
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (SHAPES[ch] || partFor(parts, cp)) {
      out += ch;
      continue;
    }
    const plain = ch.normalize("NFKC");
    out +=
      plain !== ch && [...plain].every((c) => partFor(parts, c.codePointAt(0) ?? 0)) ? plain : ch;
  }
  return out;
}

/** A word: in runs of the part of the face that has its characters, squeezed to the width the browser gave it. */
function drawText(p: Place, op: Extract<Op, { t: "text" }>, faces: Faces) {
  const parts = faces.get(op.face);
  const main = parts?.[0];
  if (!parts || !main) return;
  type Run = { text: string; part?: FacePart; shape?: (typeof SHAPES)[string] };
  const runs: Run[] = [];
  for (const ch of drawable(op.text, parts)) {
    const shape = SHAPES[ch];
    const part = shape ? undefined : partFor(parts, ch.codePointAt(0) ?? 0);
    if (!shape && !part) continue;
    const last = runs[runs.length - 1];
    if (last && !shape && !last.shape && last.part === part) last.text += ch;
    else runs.push(shape ? { text: ch, shape } : { text: ch, ...(part ? { part } : {}) });
  }
  // The width of the word in the PDF's fonts, to fit it to the width the browser drew it at.
  const sizePt = op.size * PT;
  const spacingPt = op.spacing * PT;
  let natural = 0;
  let count = 0;
  for (const run of runs) {
    natural += run.shape
      ? op.size * 0.8 * PT
      : (run.part?.font.widthOfTextAtSize(run.text, sizePt) ?? 0);
    count += [...run.text].length;
  }
  natural += spacingPt * count;
  if (natural <= 0) return;
  // The browser's box ends after the spacing of the last letter too.
  const squeeze = Math.min(1.15, Math.max(0.85, (op.box.w * PT) / natural));
  const baseline =
    op.box.y + (op.box.h - (main.ascent - main.descent) * op.size) / 2 + main.ascent * op.size;
  let x = op.box.x;
  p.page.pushOperators(
    pushGraphicsState(),
    setCharacterSpacing(spacingPt),
    setCharacterSqueeze(squeeze * 100),
  );
  for (const run of runs) {
    if (run.shape) {
      x += drawShape(p, run.shape, x, op.box, op.size, op.color) * squeeze;
      continue;
    }
    const font = run.part?.font;
    if (!font) continue;
    p.page.drawText(run.text, {
      x: X(p, x),
      y: Y(p, baseline),
      size: sizePt,
      font,
      color: colour(op.color),
    });
    x +=
      ((font.widthOfTextAtSize(run.text, sizePt) + spacingPt * [...run.text].length) * squeeze) /
      PT;
  }
  p.page.pushOperators(popGraphicsState());
}

interface FieldPlace {
  form: PDFForm;
  name: () => string;
  faces: Faces;
}

/**
 * How a field shows its value until the person changes it: each word where the browser drew it, in
 * the one font the field has (a PDF reader draws the field anew, in its own way, once it is edited).
 */
function wordsAppearance(
  op: Extract<Op, { t: "field"; kind: "text" }>,
  part: FacePart,
  top: number,
  height: number,
): PDFOperator[] {
  const ops: PDFOperator[] = [beginMarkedContent("Tx"), pushGraphicsState()];
  for (const word of op.words) {
    const text = [...drawable(word.text, [part])]
      .filter((ch) => part.has(ch.codePointAt(0) ?? 0))
      .join("");
    if (!text) continue;
    const sizePt = word.size * PT;
    const spacingPt = word.spacing * PT;
    const natural = part.font.widthOfTextAtSize(text, sizePt) + spacingPt * [...text].length;
    if (natural <= 0) continue;
    const squeeze = Math.min(1.15, Math.max(0.85, (word.box.w * PT) / natural));
    const baseline =
      word.box.y +
      (word.box.h - (part.ascent - part.descent) * word.size) / 2 +
      part.ascent * word.size;
    ops.push(
      beginText(),
      setFillingColor(colour(word.color)),
      setFontAndSize(part.font.name, sizePt),
      setCharacterSpacing(spacingPt),
      setCharacterSqueeze(squeeze * 100),
      moveText((word.box.x - op.box.x) * PT, (height - (baseline - top)) * PT),
      showText(part.font.encodeText(text)),
      endText(),
    );
  }
  ops.push(popGraphicsState(), endMarkedContent());
  return ops;
}

function textField(p: Place, op: Extract<Op, { t: "field"; kind: "text" }>, f: FieldPlace) {
  const parts = f.faces.get(op.face);
  if (!parts?.[0]) return;
  // A field writes its value in one font: the part that has every character of it.
  const cps = [...op.value].map((ch) => ch.codePointAt(0) ?? 0);
  const part = parts.find((each) => cps.every((cp) => each.has(cp))) ?? parts[0];
  const font: PDFFont = part.font;
  const field = f.form.createTextField(f.name());
  if (op.multiline) field.enableMultiline();
  field.setText(op.value);
  field.setAlignment(
    op.align === "center"
      ? TextAlignment.Center
      : op.align === "right"
        ? TextAlignment.Right
        : TextAlignment.Left,
  );
  // At least a line high, so that a short box still takes a value.
  const height = Math.max(op.box.h, op.size * 1.15);
  const top = op.box.y + op.box.h - height;
  field.addToPage(p.page, {
    x: X(p, op.box.x),
    y: Y(p, top + height),
    width: op.box.w * PT,
    height: height * PT,
    textColor: colour(op.color),
    backgroundColor: undefined,
    borderColor: undefined,
    borderWidth: 0,
    font,
  });
  // The size a reader writes a changed value in; a long note in a big frame stays at the size of the text.
  field.setFontSize(Math.max(4, op.multiline ? Math.min(op.size * PT, 9) : op.size * PT));
  field.updateAppearances(font, () => wordsAppearance(op, part, top, height));
}

function checkField(p: Place, op: Extract<Op, { t: "field"; kind: "check" }>, f: FieldPlace) {
  const box = f.form.createCheckBox(f.name());
  const w = op.box.w * PT;
  const h = op.box.h * PT;
  box.addToPage(p.page, {
    x: X(p, op.box.x),
    y: Y(p, op.box.y + op.box.h),
    width: w,
    height: h,
    backgroundColor: undefined,
    borderColor: undefined,
    borderWidth: 0,
  });
  // The outline is on the page; the field draws only the mark, filled as on the printed sheet.
  const r = Math.min(w, h) * (op.shape === "diamond" ? 0.42 : 0.3);
  const cx = w / 2;
  const cy = h / 2;
  const k = 0.5523 * r;
  const mark =
    op.shape === "diamond"
      ? [
          moveTo(cx, cy + r),
          lineTo(cx + r, cy),
          lineTo(cx, cy - r),
          lineTo(cx - r, cy),
          closePath(),
        ]
      : [
          moveTo(cx + r, cy),
          appendBezierCurve(cx + r, cy + k, cx + k, cy + r, cx, cy + r),
          appendBezierCurve(cx - k, cy + r, cx - r, cy + k, cx - r, cy),
          appendBezierCurve(cx - r, cy - k, cx - k, cy - r, cx, cy - r),
          appendBezierCurve(cx + k, cy - r, cx + r, cy - k, cx + r, cy),
          closePath(),
        ];
  box.updateAppearances(() => ({
    normal: {
      on: [
        pushGraphicsState(),
        setFillingColor(colour(op.color)),
        ...mark,
        fill(),
        popGraphicsState(),
      ],
      off: [],
    },
  }));
  if (op.checked) box.check();
}

function draw(p: Place, ops: Op[], faces: Faces, fields: FieldPlace) {
  for (const op of ops) {
    switch (op.t) {
      case "rect":
        if (op.radius)
          p.page.drawSvgPath(roundedPath(op.box, op.radius), {
            x: p.left,
            y: p.height - p.top,
            ...(op.fill ? { color: colour(op.fill) } : {}),
            ...(op.stroke
              ? { borderColor: colour(op.stroke), borderWidth: (op.width ?? 1) * PT }
              : {}),
          });
        else
          p.page.drawRectangle({
            x: X(p, op.box.x),
            y: Y(p, op.box.y + op.box.h),
            width: op.box.w * PT,
            height: op.box.h * PT,
            ...(op.fill ? { color: colour(op.fill) } : {}),
            ...(op.stroke
              ? { borderColor: colour(op.stroke), borderWidth: (op.width ?? 1) * PT }
              : {}),
          });
        break;
      case "line":
        p.page.drawLine({
          start: { x: X(p, op.x1), y: Y(p, op.y1) },
          end: { x: X(p, op.x2), y: Y(p, op.y2) },
          thickness: op.width * PT,
          color: colour(op.color),
          ...(op.dash ? { dashArray: [op.dash * PT, op.dash * PT] } : {}),
        });
        break;
      case "ellipse":
        p.page.drawEllipse({
          x: X(p, op.box.x + op.box.w / 2),
          y: Y(p, op.box.y + op.box.h / 2),
          xScale: (op.box.w / 2) * PT,
          yScale: (op.box.h / 2) * PT,
          ...(op.fill ? { color: colour(op.fill) } : {}),
          ...(op.stroke
            ? { borderColor: colour(op.stroke), borderWidth: (op.width ?? 1) * PT }
            : {}),
        });
        break;
      case "poly":
        p.page.drawSvgPath(svgPath(op.points), {
          x: p.left,
          y: p.height - p.top,
          ...(op.fill ? { color: colour(op.fill) } : {}),
          ...(op.stroke
            ? { borderColor: colour(op.stroke), borderWidth: (op.width ?? 1) * PT }
            : {}),
        });
        break;
      case "text":
        drawText(p, op, faces);
        break;
      case "clip":
        p.page.pushOperators(pushGraphicsState(), ...pathOps(p, op.points), clip(), endPath());
        draw(p, op.ops, faces, fields);
        p.page.pushOperators(popGraphicsState());
        break;
      case "field":
        if (op.kind === "text") textField(p, op, fields);
        else checkField(p, op, fields);
        break;
    }
  }
}

/** The characters each face writes, to know which fonts to embed. */
function needs(pages: Op[][]): Map<FaceKey, Set<number>> {
  const out = new Map<FaceKey, Set<number>>();
  const add = (face: FaceKey, text: string) => {
    let set = out.get(face);
    if (!set) {
      set = new Set();
      out.set(face, set);
    }
    for (const ch of text) set.add(ch.codePointAt(0) ?? 0);
  };
  const visit = (ops: Op[]) => {
    for (const op of ops) {
      if (op.t === "text") add(op.face, op.text);
      else if (op.t === "field" && op.kind === "text") add(op.face, op.value);
      else if (op.t === "clip") visit(op.ops);
    }
  };
  for (const page of pages) visit(page);
  return out;
}

export interface Paper {
  /** Size of the paper and its margins, in points. */
  width: number;
  height: number;
  margin: number;
}

/** Draws the pages on a new PDF: one sheet of paper for each, with its fields. */
export async function renderPages(doc: PDFDocument, pages: Op[][], paper: Paper): Promise<void> {
  const faces = await embedFaces(doc, needs(pages));
  const form = doc.getForm();
  pages.forEach((ops, index) => {
    const page = doc.addPage([paper.width, paper.height]);
    let n = 0;
    const fields: FieldPlace = { form, faces, name: () => `p${index + 1}-f${++n}` };
    draw({ page, left: paper.margin, top: paper.margin, height: paper.height }, ops, faces, fields);
  });
}
