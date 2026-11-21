import type { SearchKind } from "../../app/search";
import type { HitGroup, Origin } from "../../app/searchGroups";
import { describeOrigins } from "../../app/searchGroups";
import { content } from "../../app/store";
import type { Content } from "../../content/browser";
import type { Effect } from "../../data/schema";
import { type UiKey, ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { EntryDetail } from "./EntryDetail";

/** Kinds whose detail is more than a text (a spell's casting, a stat block): each variant shows whole. */
const WHOLE = new Set(["spell", "monster", "item"]);

const levelsText = (levels: number[]) =>
  levels.length === 1
    ? ui("rules.level", { n: levels[0] ?? 0 })
    : ui("rules.levels", { n: levels.join(", ") });

/** The kinds of entry that hand out traits and features: what a trait with no class of its own belongs to. */
const GIVERS = new Set(["species", "subspecies", "background", "feat", "class", "subclass"]);

const giversOfTrait = new WeakMap<object, Map<string, string[]>>();

/** For each trait or feature, the ids of the entries whose effects give it (a species, a feat...). */
function giversOf(c: Content, id: string): string[] {
  let map = giversOfTrait.get(c.index);
  if (!map) {
    map = new Map();
    const walk = (owner: string, effects: Effect[]) => {
      for (const effect of effects) {
        if (effect.type === "when") walk(owner, effect.effects);
        else if (effect.type === "trait")
          map?.set(effect.id, [...(map.get(effect.id) ?? []), owner]);
      }
    };
    for (const entry of c.index.values()) if (GIVERS.has(entry.kind)) walk(entry.id, entry.effects);
    giversOfTrait.set(c.index, map);
  }
  return map.get(id) ?? [];
}

/**
 * What an entry belongs to: the class (and subclass) and the level it comes at; a trait, the species or
 * feat that gives it; the SRD's, its edition. Content that says none of this has no owner to name.
 */
export function originsOf(id: string): Origin[] {
  const c = content.value;
  if (!c) return [];
  const data = c.index.get(id)?.data ?? {};
  const owner = typeof data.class === "string" ? data.class : undefined;
  const sub = typeof data.subclass === "string" ? data.subclass : undefined;
  const level = typeof data.level === "number" ? data.level : undefined;
  if (owner) return [{ who: sub ? `${c.name(owner)} · ${c.name(sub)}` : c.name(owner), level }];
  const givers = giversOf(c, id);
  if (givers.length > 0) return givers.map((giver) => ({ who: c.name(giver) }));
  const pack = id.split(":")[0];
  return pack === "srd51" || pack === "srd52" ? [{ who: ui(`edition.${pack}.name`) }] : [];
}

/** "Applies to: ..." for the entries of a variant, or its number when nothing says what it applies to. */
function appliesTo(ids: string[], number: number) {
  const lines = describeOrigins(ids.flatMap(originsOf), levelsText);
  if (lines.length === 0) return <b>{ui("rules.variantN", { n: number })}</b>;
  return (
    <>
      <b>{ui("rules.appliesTo")}</b> {lines.join("; ")}
    </>
  );
}

/** Everything the rules say under one name: the same text once, with all that it applies to. */
export function VariantsDetail({ group }: { group: HitGroup }) {
  const c = content.value;
  if (!c) return null;
  const heading = (
    <>
      <h3>{group.name}</h3>
      <p class="muted">
        {ui(`search.kind.${group.kind as SearchKind}` as UiKey)}
        {" · "}
        {ui("rules.variants", { n: group.hits.length })}
      </p>
    </>
  );

  if (WHOLE.has(group.kind)) {
    return (
      <div class="rule-detail">
        {heading}
        {group.hits.map((hit, i) => (
          <section class="rule-variant" key={hit.id}>
            <p class="rule-applies">{appliesTo([hit.id], i + 1)}</p>
            <EntryDetail id={hit.id} />
          </section>
        ))}
      </div>
    );
  }

  // The same words for several owners are one block: 63 improvements of the ability scores are one text.
  const blocks = new Map<string, { text: string; ids: string[] }>();
  for (const hit of group.hits) {
    const text = c.text(hit.id, "desc") ?? "";
    const block = blocks.get(text) ?? { text, ids: [] };
    block.ids.push(hit.id);
    blocks.set(text, block);
  }
  return (
    <div class="rule-detail">
      {heading}
      {/* A long list is closed, one line each; a short one is open to read. */}
      {[...blocks.values()].map((block, i) => (
        <details class="rule-variant" key={block.ids[0]} open={blocks.size <= 3}>
          <summary class="rule-applies">
            <span>{appliesTo(block.ids, i + 1)}</span>
          </summary>
          <Paragraphs text={block.text} />
        </details>
      ))}
    </div>
  );
}
