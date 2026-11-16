import { useEffect, useRef, useState } from "preact/hooks";
import { copyFromRules } from "../../app/arrange";
import { monstersWanted } from "../../app/rulesView";
import { type SearchKind, browse, kindsOf, search } from "../../app/search";
import { content } from "../../app/store";
import { userPacks } from "../../app/userPacks";
import { type UiKey, ui } from "../../i18n/ui";

/** Where an entry comes from, in a word: its rules, or the pack that holds it. */
function sourceOf(id: string): string {
  const pack = id.split(":")[0] ?? "";
  if (pack === "srd51") return ui("studio.source.srd51");
  if (pack === "srd52") return ui("studio.source.srd52");
  return userPacks.value.find((p) => p.id === pack)?.name ?? pack;
}

const kindLabel = (kind: SearchKind) => ui(`search.kind.${kind}` as UiKey);

/**
 * A window to start an entry from one that exists: look it up among the rules and the packs, press
 * Use as a base, and a copy opens in the open pack, ready to be changed. A blank page is the hardest
 * way to begin; a variant of Fireball is the easiest.
 */
export function StartFromDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<SearchKind | "">("");
  const [busy, setBusy] = useState(false);
  const c = content.value;

  useEffect(() => {
    // The creatures are a large pack that loads only when they are wanted.
    monstersWanted.value = true;
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  const kinds = c ? kindsOf(c) : [];
  const hits = !c
    ? []
    : query.trim().length >= 2
      ? search(c, query, kind || undefined)
      : kind
        ? browse(c, kind).slice(0, 60)
        : [];

  const use = async (id: string) => {
    if (busy) return;
    setBusy(true);
    await copyFromRules([id]);
    onClose();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog studio-start"
      aria-labelledby="studio-start-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="spell-dialog-body">
        <button type="button" class="close" onClick={onClose}>
          {ui("credits.back")}
        </button>
        <h3 id="studio-start-title">{ui("studio.startFromTitle")}</h3>
        <p class="muted">{ui("studio.startFromHint")}</p>
        <input
          type="search"
          class="studio-search"
          value={query}
          // biome-ignore lint/a11y/noAutofocus: the window opens to type in it
          autoFocus
          placeholder={ui("studio.search")}
          aria-label={ui("studio.search")}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
        <fieldset class="studio-kinds" aria-label={ui("studio.kinds")}>
          {["", ...kinds].map((k) => (
            <button
              type="button"
              key={k || "all"}
              class={kind === k ? "studio-kind on" : "studio-kind"}
              onClick={() => setKind(k as SearchKind | "")}
            >
              {k ? kindLabel(k as SearchKind) : ui("studio.all")}
            </button>
          ))}
        </fieldset>
        {hits.length === 0 ? (
          <p class="muted">
            {ui(query.trim().length >= 2 ? "studio.noMatch" : "studio.startFromEmpty")}
          </p>
        ) : (
          <ul class="plain studio-start-list">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button type="button" disabled={busy} onClick={() => void use(hit.id)}>
                  <b>{hit.name}</b>
                  <span class="muted">
                    {kindLabel(hit.kind)} · {sourceOf(hit.id)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
