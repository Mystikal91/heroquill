import { content } from "../app/store";
import { wordEntry } from "../engine/words";

/** `psi-points` -> `Psi points`: what a reserve is called while its pack gives it no name. */
const readable = (slug: string) => {
  const words = slug.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The name a pack gave to one of its reserves ("Psi points"), in the language in use. */
export const reserveName = (slug: string): string =>
  (() => {
    const c = content.value;
    const entry = c && wordEntry(c.index, "reserve", slug);
    return entry && c ? c.name(entry.id) : readable(slug);
  })();
