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
import { character, content, editionsAvailable } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { EntryDetail } from "./EntryDetail";

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
  const visible = hits.slice(0, shown);

  return (
    <div class={`rules-page${picked ? " has-detail" : ""}`}>
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
            <>
              <p class="muted">{ui("rules.hint")}</p>
              {/* The way in: each kind with how many entries it has. */}
              <ul class="rules-start">
                {present.map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      onClick={() => {
                        showRulesKind(k);
                        setShown(STEP);
                      }}
                    >
                      <b>{ui(`search.kind.${k}` as UiKey)}</b>
                      <small>{browse(c, k, ruleset).length}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : hits.length === 0 ? (
            <p class="muted">{ui("search.none")}</p>
          ) : (
            <>
              <ul class="search-results">
                {visible.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      class={picked === hit.id ? "on" : ""}
                      aria-current={picked === hit.id ? "true" : undefined}
                      onClick={() => setPicked(hit.id)}
                    >
                      <span class="search-name">{hit.name}</span>
                      {isHomebrewId(hit.id) && <small class="card-tag">{ui("tag.homebrew")}</small>}
                      {!rulesKind.value && (
                        <small class="muted">{ui(`search.kind.${hit.kind}` as UiKey)}</small>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
              {hits.length > visible.length && (
                <button type="button" class="secondary" onClick={() => setShown(shown + STEP)}>
                  {ui("rules.more", { n: hits.length - visible.length })}
                </button>
              )}
            </>
          )}
        </div>

        <div class="rules-detail" aria-live="polite">
          {picked ? (
            <>
              <button type="button" class="link rules-back" onClick={() => setPicked(undefined)}>
                {"← "}
                {ui("search.back")}
              </button>
              <EntryDetail id={picked} />
            </>
          ) : (
            <p class="muted rules-pick">{ui("rules.pick")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
