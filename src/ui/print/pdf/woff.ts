/**
 * A WOFF font back into the plain OpenType (sfnt) font it was made from: WOFF only compresses each
 * table with zlib, so the tables are inflated and written out with a new table directory.
 * https://www.w3.org/TR/WOFF/
 */

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const pad4 = (n: number) => (n + 3) & ~3;

export async function woffToSfnt(woff: Uint8Array): Promise<Uint8Array> {
  const view = new DataView(woff.buffer, woff.byteOffset, woff.byteLength);
  if (view.getUint32(0) !== 0x774f4646) return woff; // not "wOFF": already a plain font
  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = 44 + i * 20;
    const tag = view.getUint32(at);
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    const checksum = view.getUint32(at + 16);
    const raw = woff.subarray(offset, offset + compLength);
    const data = compLength < origLength ? await inflate(raw) : raw;
    if (data.length !== origLength)
      throw new Error("A table of the font did not inflate to its size");
    tables.push({ tag, checksum, data });
  }
  // The directory is sorted by tag, as the format asks.
  tables.sort((a, b) => a.tag - b.tag);
  const headerSize = 12 + 16 * numTables;
  const size = tables.reduce((sum, t) => sum + pad4(t.data.length), headerSize);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  let entrySelector = 0;
  while (2 ** (entrySelector + 1) <= numTables) entrySelector++;
  const searchRange = 2 ** entrySelector * 16;
  dv.setUint32(0, flavor);
  dv.setUint16(4, numTables);
  dv.setUint16(6, searchRange);
  dv.setUint16(8, entrySelector);
  dv.setUint16(10, numTables * 16 - searchRange);
  let offset = headerSize;
  tables.forEach((t, i) => {
    const at = 12 + i * 16;
    dv.setUint32(at, t.tag);
    dv.setUint32(at + 4, t.checksum);
    dv.setUint32(at + 8, offset);
    dv.setUint32(at + 12, t.data.length);
    out.set(t.data, offset);
    offset += pad4(t.data.length);
  });
  return out;
}
