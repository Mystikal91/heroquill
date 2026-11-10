import type { Entry } from "../data/schema";
import { inRuleset } from "../engine/rulesets";

/** The part of the loaded content a search reads. */
export interface Searchable {
  index: Map<string, Entry>;
  name(id: string): string;
  text(id: string, field: string): string | undefined;
}

/** What can be looked up: the kinds a person would ask the rules about. */
export const SEARCH_KINDS = [
  "spell",
  "item",
  "feat",
  "condition",
  "feature",
  "trait",
  "species",
  "subspecies",
  "class",
  "subclass",
  "background",
  "skill",
  "language",
  "property",
  "deity",
  "monster",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export interface SearchHit {
  id: string;
  kind: SearchKind;
  name: string;
}

/** Lower case without accents, so "furtivita" finds "Furtività". */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const kinds = new Set<string>(SEARCH_KINDS);

/** The folded names of what can be searched, once per loaded content. */
const names = new WeakMap<
  object,
  Map<string, { id: string; kind: SearchKind; name: string; folded: string }[]>
>();

/**
 * What can be searched, for the rules of one edition when `ruleset` is given: its SRD and the packs the person added,
 * never the other edition's SRD (the same spell twice).
 */
function namesOf(c: Searchable, ruleset?: string) {
  let byRuleset = names.get(c);
  if (!byRuleset) {
    byRuleset = new Map();
    names.set(c, byRuleset);
  }
  let list = byRuleset.get(ruleset ?? "");
  if (!list) {
    list = [...c.index.values()]
      .filter((e) => kinds.has(e.kind) && (!ruleset || inRuleset(e.id, ruleset)))
      .map((e) => {
        const name = c.name(e.id);
        return { id: e.id, kind: e.kind as SearchKind, name, folded: fold(name) };
      });
    byRuleset.set(ruleset ?? "", list);
  }
  return list;
}

const MIN_LENGTH = 2;
export const MAX_HITS = 60;

/** The kinds that some entry of the content has, in the order of the list of kinds. */
export function kindsOf(c: Searchable, ruleset?: string): SearchKind[] {
  const present = new Set(namesOf(c, ruleset).map((n) => n.kind));
  return SEARCH_KINDS.filter((k) => present.has(k));
}

/** Every entry of a kind by name, to read through. */
export function browse(c: Searchable, kind: SearchKind, ruleset?: string): SearchHit[] {
  return namesOf(c, ruleset)
    .filter((n) => n.kind === kind)
    .map(({ id, name }) => ({ id, kind, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Entries whose name or text has every word of the query. A name that starts with the query
 * comes first, then a name that has it, then a text that has it. Nothing for a query shorter
 * than two letters.
 */
export function search(
  c: Searchable,
  query: string,
  kind?: SearchKind,
  limit = MAX_HITS,
  ruleset?: string,
): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const whole = words.join(" ");
  if (whole.length < MIN_LENGTH) return [];

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const { id, kind: entryKind, name, folded } of namesOf(c, ruleset)) {
    if (kind && entryKind !== kind) continue;
    let score = 0;
    if (folded === whole) score = 100;
    else if (folded.startsWith(whole)) score = 80;
    else if (words.every((w) => folded.includes(w))) score = 60;
    else {
      const desc = c.text(id, "desc");
      if (!desc) continue;
      const text = fold(desc);
      // A word in the name and another in the text still counts.
      const both = `${folded} ${text}`;
      if (words.every((w) => both.includes(w))) score = 20;
    }
    if (score > 0) scored.push({ hit: { id, kind: entryKind, name }, score });
  }
  // The same name in a few books: one of each kind is enough to show first.
  return scored
    .sort((a, b) => b.score - a.score || a.hit.name.localeCompare(b.hit.name))
    .slice(0, limit)
    .map((s) => s.hit);
}
