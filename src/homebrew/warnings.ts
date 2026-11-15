import { type Entry, type Pack, brokenReferences } from "../data/schema";
import type { UserPackRecord } from "../storage/packs";
import { entryProblems } from "./entries";

/**
 * What the editor tells the person about an entry as they work: things that will not work (a
 * reference to something that is not there, data the engine cannot read) and things that would
 * make it better (a name, a description). `code` names the message; `text` is a detail.
 */
export interface Warning {
  severity: "error" | "hint";
  code: "noName" | "noDesc" | "noClasses" | "noParent" | "broken" | "problem";
  text?: string;
}

/** What `warningsFor` needs to know about the app's content: the packs that exist beside this one. */
export interface Surroundings {
  packs: Pack[];
}

export function warningsFor(record: UserPackRecord, entry: Entry, around: Surroundings): Warning[] {
  const found: Warning[] = [];
  const name = record.strings[`${entry.id}.name`]?.trim();
  if (!name) found.push({ severity: "hint", code: "noName" });

  for (const problem of entryProblems(entry))
    found.push({ severity: "error", code: "problem", text: problem });

  const others = around.packs.filter((p) => p.manifest.id !== record.id);
  for (const broken of brokenReferences([...others, record.pack]))
    if (broken.from === entry.id)
      found.push({ severity: "error", code: "broken", text: broken.ref });

  if ((entry.kind === "subclass" || entry.kind === "subspecies") && !entry.parent)
    found.push({ severity: "error", code: "noParent" });
  if (entry.kind === "spell" && ((entry.data.classes as unknown[] | undefined) ?? []).length === 0)
    found.push({ severity: "hint", code: "noClasses" });
  if (!record.strings[`${entry.id}.desc`]?.trim() && entry.kind !== "property")
    found.push({ severity: "hint", code: "noDesc" });
  return found;
}
