import { useEffect, useRef, useState } from "preact/hooks";
import { isHomebrewId } from "../../app/homebrew";
import {
  rulesEdition,
  rulesFocus,
  rulesKind,
  rulesQuery,
  showRulesKind,
} from "../../app/rulesView";
import { type SearchHit, browse, kindsOf, search } from "../../app/search";
import { GROUP_PREFIX, groupHits } from "../../app/searchGroups";
import { character, content, editionsAvailable } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { EntryDetail } from "./EntryDetail";
import { VariantsDetail } from "./Variants";

const STEP = 150;

/** What is shown: the matches of what is typed, or the whole kind to read through. */
function listed(query: string, ruleset: string): { hits: SearchHit[]; searching: boolean } {
  const c = content.value;
  const kind = rulesKind.value;
  if (!c) return { hits: [], searching: false };
  if (query.trim().length >= 2)
    return { hits: search(c, query, kind, 300, ruleset), searching: true };
  return { hits: kind ? browse(c, kind, ruleset) : [], searching: false };
}

/** The rules, to look up by a word or to read through by kind: spells, items, feats, conditions... */
export function RulesPage() {
  const c = content.value;
  const field = useRef<HTMLInputElement>(null);
  const query = rulesQuery.value;
  const [picked, setPicked] = useState<string | undefined>();
  const [shown, setShown] = useState(STEP);
  const focus = rulesFocus.value;

  useEffect(() => {
    if (focus > 0) field.current?.focus();
  }, [focus]);

  if (!c) return null;
  const ruleset = rulesEdition.value ?? character.value.ruleset;
  const both = editionsAvailable.value.length > 1;
  const present = kindsOf(c, ruleset);
  // The monsters are a large pack: their button is there before they are loaded, and loads them.
  const kinds = present.includes("monster") ? present : [...present, "monster" as const];
  const loading = rulesKind.value === "monster" && !c.monsters;
  const { hits, searching } = listed(query, ruleset);
  const groups = groupHits(hits);
  const visible = groups.slice(0, shown);
  const pickedGroup = picked?.startsWith(GROUP_PREFIX)
    ? groups.find((g) => g.key === picked)
    : undefined;
  const showing = picked?.startsWith(GROUP_PREFIX)
    ? pickedGroup !== undefined
    : picked !== undefined;

  return (
    <div class={`rules-page${showing ? " has-detail" : ""}`}>
      <div class="rules-top">
        <input
          ref={field}
          type="search"
          class="search-field"
          value={query}
          placeholder={ui("search.placeholder")}
          aria-label={ui("search.title")}
          autoComplete="off"
          onInput={(e) => {
            rulesQuery.value = e.currentTarget.value;
            setShown(STEP);
          }}
        />
        {both && (
          <fieldset class="segmented rules-edition">
            <legend class="sr-only">{ui("edition.label")}</legend>
            {(["srd51", "srd52"] as const).map((e) => (
              <button
                type="button"
                key={e}
                class={ruleset === e ? "on" : ""}
                aria-pressed={ruleset === e}
                onClick={() => {
                  rulesEdition.value = e;
                  setPicked(undefined);
                  setShown(STEP);
                }}
              >
                {ui(`edition.${e}.name`)}
              </button>
            ))}
          </fieldset>
        )}
        <fieldset class="rules-kinds">
          <legend class="sr-only">{ui("rules.kinds")}</legend>
          <button
            type="button"
            class={`chip${rulesKind.value ? "" : " on"}`}
            aria-pressed={!rulesKind.value}
            onClick={() => {
              showRulesKind(undefined);
              setShown(STEP);
            }}
          >
            {ui("rules.all")}
          </button>
          {kinds.map((k) => (
            <button
              type="button"
              key={k}
              class={`chip${rulesKind.value === k ? " on" : ""}`}
              aria-pressed={rulesKind.value === k}
              onClick={() => {
                showRulesKind(k);
                setShown(STEP);
              }}
            >
              {ui(`search.kind.${k}` as UiKey)}
            </button>
          ))}
        </fieldset>
      </div>

      <div class="rules-body">
        <div class="rules-list">
          {loading ? (
            <p class="muted">{ui("rules.loading")}</p>
          ) : !searching && !rulesKind.value ? (
            <p class="muted">{ui("rules.hint")}</p>
          ) : hits.length === 0 ? (
            <p class="muted">{ui("search.none")}</p>
          ) : (
            <>
              <ul class="search-results">
                {visible.map((group) => {
                  const hit = group.hits[0] as SearchHit;
                  const several = group.hits.length > 1;
                  const key = several ? group.key : hit.id;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        class={picked === key ? "on" : ""}
                        aria-current={picked === key ? "true" : undefined}
                        onClick={() => setPicked(key)}
                      >
                        <span class="search-name">{group.name}</span>
                        {!several && isHomebrewId(hit.id) && (
                          <small class="card-tag">{ui("tag.homebrew")}</small>
                        )}
                        {!rulesKind.value && (
                          <small class="muted">{ui(`search.kind.${hit.kind}` as UiKey)}</small>
                        )}
                        {several && (
                          <small class="muted search-variants">
                            {ui("rules.variants", { n: group.hits.length })}
                          </small>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {groups.length > visible.length && (
                <button type="button" class="secondary" onClick={() => setShown(shown + STEP)}>
                  {ui("rules.more", { n: groups.length - visible.length })}
                </button>
              )}
            </>
          )}
        </div>

        <div class="rules-detail" aria-live="polite">
          {showing && picked ? (
            <>
              <button type="button" class="link rules-back" onClick={() => setPicked(undefined)}>
                {"← "}
                {ui("search.back")}
              </button>
              {pickedGroup ? <VariantsDetail group={pickedGroup} /> : <EntryDetail id={picked} />}
            </>
          ) : (
            <p class="muted rules-pick">{ui("rules.pick")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
