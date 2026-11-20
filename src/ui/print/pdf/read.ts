import { type Box, type FaceKey, type Op, type Rgb, type TextOp, rectPoints } from "./ops";

/**
 * Reads a print page as the browser laid it out into what the PDF draws (`Op`). It knows the few
 * things the print style sheet draws in ways a generic reading would miss: the frames with cut
 * corners, the banners, the rules beside a heading and the round or diamond boxes to tick. The rest
 * is backgrounds, borders and words, each word where the browser put it.
 *
 * The values a person may want to change become form fields: the numbers and names of the sheet,
 * the lines to write on, the boxes to tick. The long texts (features, spells, cards) stay text.
 */

/** Elements whose text is a value: each becomes a text field. */
const VALUE_FIELDS = [
  ".p-banner h1",
  ".p-banner h2",
  ".p-fields dd",
  ".p-badge b",
  ".p-oval",
  ".p-ability-mod",
  ".p-checks b",
  ".p-box b",
  ".p-hp-max b",
  ".p-write",
  ".p-table td",
  ".p-prof dd",
  ".p-names li",
  ".p-level-row .names",
  ".p-slot .value",
  ".p-coin",
  ".p-lines li",
  ".p-ruled-area",
  ".p-fit",
].join(", ");

/** Where the text is to read, not to change. */
const STATIC_TEXT = ".p-flow-cols, .p-card, .p-foot";

/** Fields that hold more than a line. */
const MULTILINE = ".p-ruled-area, .p-fit";

const NONE: Rgb = { r: 0, g: 0, b: 0 };

// ---- Colours ----

let canvas: CanvasRenderingContext2D | null | undefined;
const colours = new Map<string, Rgb | null>();

/** A CSS colour as RGB from 0 to 1, or null when it is transparent. Any colour space the browser knows. */
export function parseColor(css: string): Rgb | null {
  const known = colours.get(css);
  if (known !== undefined) return known;
  let result: Rgb | null = null;
  const plain =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(css);
  if (plain) {
    const alpha =
      plain[4] === undefined ? 1 : Number.parseFloat(plain[4]) / (plain[4].endsWith("%") ? 100 : 1);
    result =
      alpha < 0.05
        ? null
        : { r: Number(plain[1]) / 255, g: Number(plain[2]) / 255, b: Number(plain[3]) / 255 };
  } else if (css !== "transparent") {
    canvas ??= document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (canvas) {
      canvas.clearRect(0, 0, 1, 1);
      canvas.fillStyle = "#000";
      canvas.fillStyle = css;
      canvas.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = canvas.getImageData(0, 0, 1, 1).data;
      result = a < 13 ? null : { r: r / 255, g: g / 255, b: b / 255 };
    }
  }
  colours.set(css, result);
  return result;
}

// ---- Faces ----

export function faceOf(cs: CSSStyleDeclaration): FaceKey {
  const weight = Number.parseInt(cs.fontWeight, 10) || 400;
  if (/^\s*"?cinzel/i.test(cs.fontFamily)) return weight >= 650 ? "display-700" : "display-600";
  if (cs.fontStyle === "italic" || cs.fontStyle.startsWith("oblique")) return "text-400-italic";
  return weight >= 550 ? "text-600" : "text-400";
}

const px = (value: string) => Number.parseFloat(value) || 0;

/** The text as the browser shows it, with the ligatures of texts copied from the books ("ﬁ") as letters. */
function transformText(text: string, cs: CSSStyleDeclaration, lang: string): string {
  const plain = text.replace(/[ﬀ-ﬆ]/g, (c) => c.normalize("NFKC"));
  if (cs.textTransform === "uppercase") return plain.toLocaleUpperCase(lang);
  if (cs.textTransform === "lowercase") return plain.toLocaleLowerCase(lang);
  return plain;
}

// ---- The reading ----

interface Context {
  origin: DOMRect;
  /** Inside a field: its words are the field's value, not drawn. */
  inField: boolean;
  lang: string;
  /** What an element that hides its overflow lets be seen: nothing outside it is drawn, or a field. */
  clip?: Box;
}

const inside = (b: Box, clip: Box | undefined) =>
  !clip ||
  (b.x >= clip.x - 0.5 &&
    b.y >= clip.y - 0.5 &&
    b.x + b.w <= clip.x + clip.w + 0.5 &&
    b.y + b.h <= clip.y + clip.h + 0.5);

const outside = (b: Box, clip: Box | undefined) =>
  Boolean(
    clip &&
      (b.y >= clip.y + clip.h ||
        b.y + b.h <= clip.y ||
        b.x >= clip.x + clip.w ||
        b.x + b.w <= clip.x),
  );

const boxOf = (r: DOMRect, origin: DOMRect): Box => ({
  x: r.left - origin.left,
  y: r.top - origin.top,
  w: r.width,
  h: r.height,
});

/** The box inside the borders and the padding, where the text of an element is. */
function contentBox(el: Element, cs: CSSStyleDeclaration, origin: DOMRect): Box {
  const b = boxOf(el.getBoundingClientRect(), origin);
  const left = px(cs.borderLeftWidth) + px(cs.paddingLeft);
  const top = px(cs.borderTopWidth) + px(cs.paddingTop);
  const right = px(cs.borderRightWidth) + px(cs.paddingRight);
  const bottom = px(cs.borderBottomWidth) + px(cs.paddingBottom);
  return {
    x: b.x + left,
    y: b.y + top,
    w: Math.max(0, b.w - left - right),
    h: Math.max(0, b.h - top - bottom),
  };
}

/** The outline of a frame: a rectangle with its corners cut by `n`, half a line inside the box. */
function octagon(b: Box, n: number, inset: number): [number, number][] {
  const x0 = b.x + inset;
  const y0 = b.y + inset;
  const x1 = b.x + b.w - inset;
  const y1 = b.y + b.h - inset;
  const c = Math.max(0, n - inset * 0.4142);
  return [
    [x0 + c, y0],
    [x1 - c, y0],
    [x1, y0 + c],
    [x1, y1 - c],
    [x1 - c, y1],
    [x0 + c, y1],
    [x0, y1 - c],
    [x0, y0 + c],
  ];
}

function frameOps(el: Element, cs: CSSStyleDeclaration, b: Box, out: Op[]) {
  const n = lengthOf(el, cs.getPropertyValue("--p-n")) || 11.3;
  const width = px(cs.borderTopWidth);
  const ink = parseColor(cs.borderTopColor) ?? NONE;
  const fill = parseColor(cs.backgroundColor) ?? undefined;
  const outline = octagon(b, n, width / 2);
  out.push({ t: "poly", points: outline, ...(fill ? { fill } : {}), stroke: ink, width });
  const after = getComputedStyle(el, "::after");
  const line = parseColor(after.borderTopColor);
  const lineWidth = px(after.borderTopWidth);
  if (line && lineWidth > 0) {
    const inset = px(after.top) + lineWidth / 2;
    out.push({
      t: "clip",
      points: octagon(b, n, width),
      ops: [
        {
          t: "rect",
          box: { x: b.x + inset, y: b.y + inset, w: b.w - 2 * inset, h: b.h - 2 * inset },
          stroke: line,
          width: lineWidth,
        },
      ],
    });
  }
}

/** A banner with a swallowtail at each end (`.p-banner`). */
function bannerOps(cs: CSSStyleDeclaration, b: Box, out: Op[]) {
  const tail = Math.min(15.1, b.h / 2);
  const fill = parseColor(cs.backgroundColor);
  const shape: [number, number][] = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w - tail, b.y + b.h / 2],
    [b.x + b.w, b.y + b.h],
    [b.x, b.y + b.h],
    [b.x + tail, b.y + b.h / 2],
  ];
  if (fill) out.push({ t: "poly", points: shape, fill });
  const color = parseColor(cs.borderTopColor);
  const width = px(cs.borderTopWidth);
  if (color && width > 0) {
    out.push({
      t: "line",
      x1: b.x,
      y1: b.y + width / 2,
      x2: b.x + b.w,
      y2: b.y + width / 2,
      color,
      width,
    });
    const y = b.y + b.h - width / 2;
    out.push({ t: "line", x1: b.x, y1: y, x2: b.x + b.w, y2: y, color, width });
  }
}

/** A length of a custom property ("3mm") in pixels, measured by the browser. */
function lengthOf(el: Element, value: string): number {
  const v = value.trim();
  if (!v) return 0;
  const probe = document.createElement("div");
  probe.style.cssText = `position:absolute;visibility:hidden;width:${v}`;
  el.appendChild(probe);
  const w = probe.getBoundingClientRect().width;
  probe.remove();
  return w;
}

function backgroundAndBorders(cs: CSSStyleDeclaration, b: Box, out: Op[]) {
  const fill = parseColor(cs.backgroundColor) ?? undefined;
  const radius = px(cs.borderTopLeftRadius);
  const sides = [
    [cs.borderTopStyle, cs.borderTopWidth, cs.borderTopColor],
    [cs.borderRightStyle, cs.borderRightWidth, cs.borderRightColor],
    [cs.borderBottomStyle, cs.borderBottomWidth, cs.borderBottomColor],
    [cs.borderLeftStyle, cs.borderLeftWidth, cs.borderLeftColor],
  ].map(([style, width, color]) => {
    const w = px(width ?? "");
    const c = style === "none" || style === "hidden" || w === 0 ? null : parseColor(color ?? "");
    return c ? { w, c, dashed: style === "dashed" || style === "dotted" } : null;
  });
  const all = sides.every((s) => s && sides[0] && s.w === sides[0].w);
  const round = cs.borderTopLeftRadius.endsWith("%") || radius >= Math.min(b.w, b.h) / 2 - 0.5;
  if (radius > 0 && round) {
    const stroke = all ? sides[0] : null;
    if (fill || stroke)
      out.push({
        t: "ellipse",
        box: stroke
          ? { x: b.x + stroke.w / 2, y: b.y + stroke.w / 2, w: b.w - stroke.w, h: b.h - stroke.w }
          : b,
        ...(fill ? { fill } : {}),
        ...(stroke ? { stroke: stroke.c, width: stroke.w } : {}),
      });
    return;
  }
  if (radius > 0 && all && sides[0]) {
    const s = sides[0];
    out.push({
      t: "rect",
      box: { x: b.x + s.w / 2, y: b.y + s.w / 2, w: b.w - s.w, h: b.h - s.w },
      ...(fill ? { fill } : {}),
      stroke: s.c,
      width: s.w,
      radius,
    });
    return;
  }
  if (fill) out.push({ t: "rect", box: b, fill, ...(radius > 0 ? { radius } : {}) });
  const [top, right, bottom, left] = sides;
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    s: NonNullable<(typeof sides)[0]>,
  ) =>
    out.push({
      t: "line",
      x1,
      y1,
      x2,
      y2,
      color: s.c,
      width: s.w,
      ...(s.dashed ? { dash: s.w * 3 } : {}),
    });
  if (top) line(b.x, b.y + top.w / 2, b.x + b.w, b.y + top.w / 2, top);
  if (bottom) line(b.x, b.y + b.h - bottom.w / 2, b.x + b.w, b.y + b.h - bottom.w / 2, bottom);
  if (left) line(b.x + left.w / 2, b.y, b.x + left.w / 2, b.y + b.h, left);
  if (right) line(b.x + b.w - right.w / 2, b.y, b.x + b.w - right.w / 2, b.y + b.h, right);
}

/** The two rules beside the words of a heading (`.p-h::before` and `::after`). */
function headingRules(el: Element, cs: CSSStyleDeclaration, origin: DOMRect, out: Op[]) {
  const before = getComputedStyle(el, "::before");
  const color = parseColor(before.backgroundColor);
  const height = px(before.height);
  if (!color || height <= 0) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect();
  if (text.width === 0) return;
  const inner = contentBox(el, cs, origin);
  const gap = px(cs.columnGap);
  const y = text.top - origin.top + text.height / 2;
  const left = text.left - origin.left - gap;
  const right = text.right - origin.left + gap;
  if (left > inner.x)
    out.push({ t: "line", x1: inner.x, y1: y, x2: left, y2: y, color, width: height });
  if (right < inner.x + inner.w)
    out.push({ t: "line", x1: right, y1: y, x2: inner.x + inner.w, y2: y, color, width: height });
}

/** The words of a text node, each where the browser drew it. */
function textOps(node: Text, cs: CSSStyleDeclaration, ctx: Context, out: Op[]) {
  const data = node.data;
  const color = parseColor(cs.color);
  if (!color || !data.trim()) return;
  const face = faceOf(cs);
  const size = px(cs.fontSize);
  const spacing = cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing);
  const range = document.createRange();
  const push = (text: string, r: DOMRect) => {
    if (r.width === 0 && r.height === 0) return;
    out.push({
      t: "text",
      text: transformText(text, cs, ctx.lang),
      box: boxOf(r, ctx.origin),
      face,
      size,
      color,
      spacing,
    });
  };
  for (const match of data.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    const word = match[0];
    range.setStart(node, start);
    range.setEnd(node, start + word.length);
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    if (rects.length === 1 && rects[0]) {
      push(word, rects[0]);
      continue;
    }
    // A word cut over two lines: each character on its own.
    for (let i = 0; i < word.length; i++) {
      range.setStart(node, start + i);
      range.setEnd(node, start + i + 1);
      const r = range.getBoundingClientRect();
      if (r.width > 0) push(word[i] ?? "", r);
    }
  }
}

function alignOf(cs: CSSStyleDeclaration): "left" | "center" | "right" {
  if (cs.textAlign === "center") return "center";
  if (cs.textAlign === "right" || cs.textAlign === "end") return "right";
  return "left";
}

function fieldOp(el: HTMLElement, cs: CSSStyleDeclaration, ctx: Context): Op {
  const box = contentBox(el, cs, ctx.origin);
  const full = el.dataset.value ?? el.textContent ?? "";
  const value = transformText(full.replace(/\s+$/g, "").replace(/^\s+/g, ""), cs, ctx.lang);
  const lineHeight = cs.lineHeight === "normal" ? px(cs.fontSize) * 1.25 : px(cs.lineHeight);
  const multiline = el.matches(MULTILINE) || box.h > lineHeight * 1.7;
  // The words as the browser placed them: the field shows its value that way until it is changed.
  const words: Op[] = [];
  const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = texts.nextNode(); node; node = texts.nextNode()) {
    const parent = node.parentElement;
    if (parent) textOps(node as Text, getComputedStyle(parent), ctx, words);
  }
  return {
    t: "field",
    kind: "text",
    box,
    value,
    face: faceOf(cs),
    size: px(cs.fontSize),
    color: parseColor(cs.color) ?? NONE,
    align: alignOf(cs),
    multiline,
    words: words.filter((w): w is TextOp => w.t === "text"),
  };
}

/** A box to tick (`.p-pip`): its outline is drawn, the mark inside is the field. */
function pipOps(el: HTMLElement, cs: CSSStyleDeclaration, ctx: Context, out: Op[]) {
  const b = boxOf(el.getBoundingClientRect(), ctx.origin);
  const color = parseColor(cs.borderTopColor) ?? NONE;
  const width = px(cs.borderTopWidth);
  const diamond = cs.transform !== "none" && cs.transform !== "";
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const half = b.w / 2 - width / 2;
  if (diamond)
    out.push({
      t: "poly",
      points: [
        [cx, cy - half],
        [cx + half, cy],
        [cx, cy + half],
        [cx - half, cy],
      ],
      stroke: color,
      width,
    });
  else
    out.push({
      t: "ellipse",
      box: { x: cx - half, y: cy - half, w: half * 2, h: half * 2 },
      stroke: color,
      width,
    });
  out.push({
    t: "field",
    kind: "check",
    box: b,
    checked: el.classList.contains("on"),
    shape: diamond ? "diamond" : "circle",
    color: parseColor(cs.backgroundColor) ?? color,
  });
}

function walk(el: HTMLElement, ctx: Context, out: Op[]) {
  const cs = getComputedStyle(el);
  if (cs.display === "none" || cs.visibility === "hidden") return;
  if (el.matches(".p-measure, .no-print")) return;
  const rect = el.getBoundingClientRect();
  const b = boxOf(rect, ctx.origin);
  if (b.w === 0 && b.h === 0 && cs.display !== "contents") return;
  // Cut off by a frame that hides what does not fit (the lines to write on): not on the page.
  if (cs.display !== "contents" && outside(b, ctx.clip)) return;

  if (el.classList.contains("p-pip")) {
    if (inside(b, ctx.clip)) pipOps(el, cs, ctx, out);
    return;
  }
  if (el.classList.contains("p-frame")) frameOps(el, cs, b, out);
  else if (el.classList.contains("p-banner")) bannerOps(cs, b, out);
  else backgroundAndBorders(cs, b, out);
  if (el.classList.contains("p-h")) headingRules(el, cs, ctx.origin, out);

  let inner = ctx;
  if (
    !ctx.inField &&
    el.matches(VALUE_FIELDS) &&
    !el.closest(STATIC_TEXT) &&
    !el.querySelector(VALUE_FIELDS) &&
    inside(b, ctx.clip)
  ) {
    out.push(fieldOp(el, cs, ctx));
    inner = { ...ctx, inField: true };
  }

  const clips = cs.overflow === "hidden" || cs.overflow === "clip" || cs.overflowY === "hidden";
  const area = {
    x: b.x + px(cs.borderLeftWidth),
    y: b.y + px(cs.borderTopWidth),
    w: b.w - px(cs.borderLeftWidth) - px(cs.borderRightWidth),
    h: b.h - px(cs.borderTopWidth) - px(cs.borderBottomWidth),
  };
  if (clips) inner = { ...inner, clip: intersect(area, ctx.clip) };
  const children: Op[] = clips ? [] : out;
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!inner.inField) textOps(child as Text, cs, inner, children);
    } else if (child instanceof HTMLElement) walk(child, inner, children);
  }
  if (clips && children.length > 0)
    out.push({ t: "clip", points: rectPoints(area), ops: children });
}

function intersect(a: Box, b: Box | undefined): Box {
  if (!b) return a;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x),
    h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y),
  };
}

/** What one print page draws, relative to its own top left corner. */
export function readPage(page: HTMLElement, lang: string): Op[] {
  const out: Op[] = [];
  walk(page, { origin: page.getBoundingClientRect(), inField: false, lang }, out);
  return out;
}
