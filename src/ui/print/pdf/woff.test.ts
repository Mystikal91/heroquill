import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import { woffToSfnt } from "./woff";

const require = createRequire(import.meta.url);

interface Parsed {
  numGlyphs: number;
  familyName: string;
  hasGlyphForCodePoint(cp: number): boolean;
}

describe("woffToSfnt", () => {
  it.each([
    "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff",
    "@fontsource/cinzel/files/cinzel-latin-ext-700-normal.woff",
  ])("gives back the font a WOFF file holds (%s)", async (file) => {
    const woff = new Uint8Array(readFileSync(require.resolve(file)));
    const sfnt = await woffToSfnt(woff);
    const before = fontkit.create(woff) as unknown as Parsed;
    const after = fontkit.create(sfnt) as unknown as Parsed;
    const signature = (bytes: Uint8Array) =>
      new DataView(bytes.buffer, bytes.byteOffset).getUint32(0);
    expect(signature(woff)).toBe(0x774f4646);
    expect([0x00010000, 0x4f54544f]).toContain(signature(sfnt));
    expect(after.numGlyphs).toBe(before.numGlyphs);
    expect(after.familyName).toBe(before.familyName);
    expect(after.hasGlyphForCodePoint("à".codePointAt(0) ?? 0)).toBe(
      before.hasGlyphForCodePoint("à".codePointAt(0) ?? 0),
    );
  });
});
