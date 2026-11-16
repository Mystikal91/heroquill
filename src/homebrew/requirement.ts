import { evaluateRequirements } from "../engine/requirements";

/**
 * A requirement as a person thinks of it: some possibilities ("or"), each a list of things the
 * character has or has not ("and"). The engine reads the text Aurora writes (`A,!B||C`); this turns
 * that text into the list and back, so the editor can show it in words without changing what it means.
 */
export interface Literal {
  word: string;
  /** `true` when the character must not have it. */
  not: boolean;
}

export type Clause = Literal[];

type Node =
  | { t: "word"; word: string }
  | { t: "not"; of: Node }
  | { t: "and"; of: Node[] }
  | { t: "or"; of: Node[] };

/** More possibilities than this are left as text: nobody reads them as a list. */
const MAX_CLAUSES = 12;

/** The same grammar the engine reads (see `evaluateRequirements`), as a tree. */
function parse(text: string): Node {
  let at = 0;
  const skip = () => {
    while (text[at] === " ") at++;
  };
  const term = (): Node => {
    skip();
    if (text[at] === "!") {
      at++;
      return { t: "not", of: term() };
    }
    if (text[at] === "(") {
      at++;
      const inside = or();
      skip();
      if (text[at] === ")") at++;
      return inside;
    }
    const word = /^(?:\[[^\]]*\]|[^,()|!]+)/.exec(text.slice(at));
    if (!word) {
      at++;
      return { t: "and", of: [] };
    }
    at += word[0].length;
    return { t: "word", word: word[0].trim() };
  };
  const and = (): Node => {
    const parts = [term()];
    skip();
    while (text[at] === ",") {
      at++;
      parts.push(term());
      skip();
    }
    return parts.length === 1 ? (parts[0] as Node) : { t: "and", of: parts };
  };
  const or = (): Node => {
    const parts = [and()];
    skip();
    while (text[at] === "|") {
      at += text.startsWith("||", at) ? 2 : 1;
      parts.push(and());
      skip();
    }
    return parts.length === 1 ? (parts[0] as Node) : { t: "or", of: parts };
  };
  return or();
}

/** The possibilities of a node, negations pushed down to the words (`!(A||B)` is `!A` and `!B`). */
function clausesOf(node: Node, negated: boolean): Clause[] | undefined {
  if (node.t === "word") return [[{ word: node.word, not: negated }]];
  if (node.t === "not") return clausesOf(node.of, !negated);
  // "And" of a list negated is an "or" of negations, and the other way round.
  const isOr = (node.t === "or") !== negated;
  const parts = node.of.map((n) => clausesOf(n, negated));
  if (parts.some((p) => p === undefined)) return undefined;
  const lists = parts as Clause[][];
  if (isOr) {
    const all = lists.flat();
    return all.length > MAX_CLAUSES ? undefined : all;
  }
  let product: Clause[] = [[]];
  for (const list of lists) {
    product = product.flatMap((left) => list.map((right) => [...left, ...right]));
    if (product.length > MAX_CLAUSES) return undefined;
  }
  return product;
}

/** A requirement as a list of possibilities; none when it asks for nothing, `undefined` when it is too tangled to list. */
export function clausesFromText(text: string): Clause[] | undefined {
  if (!text.trim()) return [];
  const found = clausesOf(parse(text), false);
  return found?.filter((clause) => clause.length > 0);
}

/** The text the engine reads for a list of possibilities. */
export function textFromClauses(clauses: Clause[]): string {
  return clauses
    .map((clause) => clause.filter((l) => l.word !== ""))
    .filter((clause) => clause.length > 0)
    .map((clause) => clause.map((l) => `${l.not ? "!" : ""}${l.word}`).join(","))
    .join("||");
}

/** Whether two requirements hold in the same situations, over the words they mention. Only for tests. */
export function sameMeaning(a: string, b: string, words: string[]): boolean {
  for (let mask = 0; mask < 1 << words.length; mask++) {
    const held = (w: string) => (mask & (1 << words.indexOf(w))) !== 0;
    if (evaluateRequirements(a, held) !== evaluateRequirements(b, held)) return false;
  }
  return true;
}
