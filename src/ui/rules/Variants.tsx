import type { SearchKind } from "../../app/search";
import type { HitGroup, Origin } from "../../app/searchGroups";
import { describeOrigins } from "../../app/searchGroups";
import { content } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { EntryDetail } from "./EntryDetail";

/** Kinds whose detail is more than a text (a spell's casting, a stat block): each variant shows whole. */
const WHOLE = new Set(["spell", "monster", "item"]);

const levelsText = (levels: number[]) =>
  levels.length === 1
    ? ui("rules.level", { n: levels[0] ?? 0 })
    : ui("rules.levels", { n: levels.join(", ") });

/** The class (and subclass) an entry belongs to and the level it comes at; with none, where it comes from. */
function originOf(id: string): Origin {
  const c = content.value;
  const data = c?.index.get(id)?.data ?? {};
  const owner = typeof data.class === "string" ? data.class : undefined;
  const sub = typeof data.subclass === "string" ? data.subclass : undefined;
  const level = typeof data.level === "number" ? data.level : undefined;
  if (c && owner) {
    const who = sub ? `${c.name(owner)} · ${c.name(sub)}` : c.name(owner);
    return { who, level };
  }
  const pack = id.split(":")[0] ?? id;
  const edition = pack === "srd51" || pack === "srd52" ? ui(`edition.${pack}.name`) : pack;
  return { who: edition };
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
        {group.hits.map((hit) => (
          <section class="rule-variant" key={hit.id}>
            <p class="rule-applies">
              <b>{ui("rules.appliesTo")}</b>{" "}
              {describeOrigins([originOf(hit.id)], levelsText).join("; ")}
            </p>
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
      {[...blocks.values()].map((block) => (
        <details class="rule-variant" key={block.ids[0]} open={blocks.size <= 3}>
          <summary class="rule-applies">
            <span>
              <b>{ui("rules.appliesTo")}</b>{" "}
              {describeOrigins(block.ids.map(originOf), levelsText).join("; ")}
            </span>
          </summary>
          <Paragraphs text={block.text} />
        </details>
      ))}
    </div>
  );
}
