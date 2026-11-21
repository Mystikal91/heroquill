import { type SearchHit, fold } from "./search";

/** The entries of one kind that share a name: one row of the rules list, with what each of them is. */
export interface HitGroup {
  /** `g:` plus the kind and the folded name; an entry id never starts like this. */
  key: string;
  kind: SearchHit["kind"];
  name: string;
  hits: SearchHit[];
}

export const GROUP_PREFIX = "g:";

/**
 * Puts together the hits of the same kind with the same name (without accents or capitals), in the
 * order the first of each came: "Ability Score Improvement" is one row for the 63 a class lists.
 */
export function groupHits(hits: SearchHit[]): HitGroup[] {
  const groups = new Map<string, HitGroup>();
  for (const hit of hits) {
    const key = `${GROUP_PREFIX}${hit.kind}/${fold(hit.name).trim()}`;
    const group = groups.get(key);
    if (group) group.hits.push(hit);
    else groups.set(key, { key, kind: hit.kind, name: hit.name, hits: [hit] });
  }
  return [...groups.values()];
}

/** What an entry belongs to: a class (and a subclass) or, with none, where it comes from; and the level it comes at. */
export interface Origin {
  who: string;
  level?: number | undefined;
}

/**
 * One line for each owner: "Barbarian (levels 4, 8, 12)". Owners keep the order they first came in and
 * their levels are sorted and counted once.
 */
export function describeOrigins(
  origins: Origin[],
  levelsText: (levels: number[]) => string,
): string[] {
  const byWho = new Map<string, Set<number>>();
  for (const { who, level } of origins) {
    const levels = byWho.get(who) ?? new Set<number>();
    if (level !== undefined) levels.add(level);
    byWho.set(who, levels);
  }
  return [...byWho].map(([who, levels]) =>
    levels.size === 0 ? who : `${who} (${levelsText([...levels].sort((a, b) => a - b))})`,
  );
}
