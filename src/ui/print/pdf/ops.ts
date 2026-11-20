/**
 * What the PDF draws, read from the print pages as the browser lays them out (`readPage`), in CSS
 * pixels from the top left corner of the page box. Plain data, so the reading and the drawing
 * (`render.ts`) are apart.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A face of the two families of the sheet, as the fonts are loaded (`fonts.ts`). */
export type FaceKey = "display-600" | "display-700" | "text-400" | "text-400-italic" | "text-600";

export type Op =
  | { t: "rect"; box: Box; fill?: Rgb; stroke?: Rgb; width?: number; radius?: number }
  | {
      t: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: Rgb;
      width: number;
      dash?: number;
    }
  | { t: "ellipse"; box: Box; fill?: Rgb; stroke?: Rgb; width?: number }
  | { t: "poly"; points: [number, number][]; fill?: Rgb; stroke?: Rgb; width?: number }
  | {
      t: "text";
      text: string;
      /** The box of the words as the browser drew them: the baseline is found in it from the font. */
      box: Box;
      face: FaceKey;
      size: number;
      color: Rgb;
      spacing: number;
    }
  | { t: "clip"; points: [number, number][]; ops: Op[] }
  | {
      t: "field";
      kind: "text";
      box: Box;
      value: string;
      face: FaceKey;
      size: number;
      color: Rgb;
      align: "left" | "center" | "right";
      multiline: boolean;
      /** One line that a reader shrinks to fit (the banners). */
      fit: boolean;
      /** The words of the value where the browser drew them, which the field shows until it is changed. */
      words: TextOp[];
    }
  | {
      t: "field";
      kind: "check";
      box: Box;
      checked: boolean;
      shape: "circle" | "diamond";
      color: Rgb;
    };

export interface PageOps {
  ops: Op[];
}

export const rectPoints = (b: Box): [number, number][] => [
  [b.x, b.y],
  [b.x + b.w, b.y],
  [b.x + b.w, b.y + b.h],
  [b.x, b.y + b.h],
];

export type TextOp = Extract<Op, { t: "text" }>;
