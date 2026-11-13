import { signal } from "@preact/signals";
import { SEARCH_KINDS, type SearchKind } from "./search";

const KEY = "rulesKind";

function remembered(): SearchKind | undefined {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && (SEARCH_KINDS as readonly string[]).includes(saved)) return saved as SearchKind;
  } catch {
    // Storage may be blocked: the page opens on all kinds.
  }
  return undefined;
}

/** Raised once the monsters are wanted: they are a large pack, loaded only then. */
export const monstersWanted = signal(false);

/** What is typed in the search of the rules page. */
export const rulesQuery = signal("");
/** The kind the page is limited to; the last one is remembered. */
export const rulesKind = signal<SearchKind | undefined>(remembered());
/** The edition whose rules the page shows; without a choice, the open character's. */
export const rulesEdition = signal<"srd51" | "srd52" | undefined>(undefined);
/** Raised to put the cursor in the search field (the button in the header, the slash key). */
export const rulesFocus = signal(0);

monstersWanted.value = rulesKind.value === "monster";

export function showRulesKind(kind: SearchKind | undefined) {
  rulesKind.value = kind;
  if (kind === "monster") monstersWanted.value = true;
  try {
    if (kind) localStorage.setItem(KEY, kind);
    else localStorage.removeItem(KEY);
  } catch {
    // Not remembered: it still works for this visit.
  }
}
