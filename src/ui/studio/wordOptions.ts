import { content } from "../../app/store";
import type { Entry } from "../../data/schema";
import { type WordKind, wordOfEntry } from "../../engine/words";
import { ownWords, wordLabel } from "../../homebrew/words";
import type { UserPackRecord } from "../../storage/packs";

/**
 * The reserves, kinds of damage or components a form can offer, each by the word the data uses: those of
 * the open pack (read from the pack itself, so one just added shows at once), then those of the other
 * packs the app holds.
 */
export function wordOptions(
  kind: WordKind,
  pack: UserPackRecord | undefined,
  language: string,
): { id: string; label: string }[] {
  // A component with no code yet cannot be ticked in a spell.
  const hasCode = (e: Entry) =>
    kind !== "component" || String((e.data as { code?: unknown }).code ?? "").trim() !== "";
  const own = (pack ? ownWords(pack, kind) : []).filter(hasCode);
  const seen = new Set(own.map(wordOfEntry));
  const out = own.map((e) => ({
    id: wordOfEntry(e),
    label: pack ? wordLabel(pack, e, language) : "",
  }));
  const c = content.value;
  if (c)
    for (const e of c.index.values()) {
      if (e.kind !== kind || !hasCode(e)) continue;
      const word = wordOfEntry(e);
      if (seen.has(word)) continue;
      seen.add(word);
      out.push({ id: word, label: c.name(e.id) });
    }
  return out;
}
