/**
 * How the blocks of a long text (features, spells) are put on pages of a fixed height, column after
 * column. The pages are laid out by the app rather than by the browser's printing, so that every
 * page is one sheet of paper with its footer, the same in every browser and in the PDF.
 */

export interface FlowUnit {
  key: string;
  /** Height in pixels, margins included. */
  height: number;
  /** A title: it stays with the unit that follows it. */
  keep?: boolean;
}

export interface FlowItem extends FlowUnit {
  /** The pieces a block is cut into when it is taller than a whole column. */
  parts?: FlowUnit[];
}

/** Page, then column, then the keys of the units in it. */
export type FlowPlan = string[][][];

/**
 * Fills the columns in order: a unit that does not fit in what is left of a column starts the next one
 * (a column is never left empty: a unit taller than a whole column is put in alone, and the page cuts it).
 * The first page has less room (`first`) than the others (`rest`), since it carries the title.
 */
export function planFlow(
  items: FlowItem[],
  columns: number,
  first: number,
  rest: number,
): FlowPlan {
  const units = items.flatMap((item) =>
    item.parts && item.parts.length > 0 && item.height > rest ? item.parts : [item],
  );
  const pages: FlowPlan = [];
  let column: string[] = [];
  let index = 0;
  const roomOf = (i: number) => (i < columns ? first : rest);
  let room = roomOf(0);
  const close = () => {
    const page = Math.floor(index / columns);
    pages[page] ??= [];
    pages[page].push(column);
    column = [];
    index++;
    room = roomOf(index);
  };
  units.forEach((unit, i) => {
    const next = units[i + 1];
    const need = unit.height + (unit.keep && next ? next.height : 0);
    if (column.length > 0 && need > room) close();
    column.push(unit.key);
    room -= unit.height;
  });
  if (column.length > 0 || pages.length === 0) close();
  return pages;
}
