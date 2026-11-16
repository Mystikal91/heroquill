import { useState } from "preact/hooks";
import { content } from "../../app/store";
import type { Entry } from "../../data/schema";
import { SAMPLE_CLASSES, canTry, tryOn, withEntry } from "../../homebrew/tryon";
import { type UiKey, ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { NumberBox, SelectBox } from "./Controls";

/** A fact of the comparison, by its name: an ability by the rules' word, the rest by the texts of the editor. */
function factLabel(key: string): string {
  if (key.startsWith("ability:"))
    return content.value?.name(`srd51:ability/${key.slice(8)}`) ?? key;
  if (key === "ac") return ui("monster.ac");
  if (key === "hp") return ui("monster.hp");
  if (key === "speed") return ui("monster.speed");
  if (key === "senses") return ui("monster.senses");
  return ui(`tryon.${key}` as UiKey);
}

/**
 * Puts the entry on a sample character and shows what changes on its sheet: the numbers that
 * differ, what it brings and the proficiencies it adds. Unsaved changes count: the content is the
 * app's plus the entries of this pack as they are now.
 */
export function TryOn({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const [ruleset, setRuleset] = useState<"srd51" | "srd52">("srd51");
  const [classId, setClassId] = useState<string>("fighter");
  const [level, setLevel] = useState(5);
  const [all, setAll] = useState(false);
  const c = content.value;
  if (!c || !canTry(entry)) return null;

  const options = { ruleset, classId: `${ruleset}:class/${classId}`, level };
  const index = new Map(c.index);
  for (const e of record.pack.entries) index.set(e.id, e);
  const needsClass = !withEntry(entry, options);
  const result = needsClass ? undefined : tryOn(entry, index, options);
  const rows = result?.facts.filter((f) => all || f.changed) ?? [];
  const name = (id: string) => c.name(id) ?? id;

  return (
    <details class="studio-tryon">
      <summary>{ui("tryon.title")}</summary>
      <div class="studio-grid">
        <SelectBox
          label={ui("tryon.edition")}
          value={ruleset}
          options={[
            { id: "srd51", label: ui("studio.source.srd51") },
            { id: "srd52", label: ui("studio.source.srd52") },
          ]}
          onChange={(v) => setRuleset(v === "srd52" ? "srd52" : "srd51")}
        />
        <SelectBox
          label={ui("tryon.class")}
          value={classId}
          options={SAMPLE_CLASSES.map((slug) => ({
            id: slug,
            label: c.name(`${ruleset}:class/${slug}`),
          }))}
          onChange={(v) => setClassId(v ?? "fighter")}
        />
        <NumberBox
          label={ui("tryon.level")}
          min={1}
          max={20}
          value={level}
          onChange={(v) => setLevel(Math.min(20, Math.max(1, v ?? 1)))}
        />
      </div>
      {needsClass ? (
        <p class="muted">{ui("tryon.needsParent")}</p>
      ) : rows.length === 0 && (result?.gained.length ?? 0) === 0 ? (
        <p class="muted">{ui("tryon.nothing")}</p>
      ) : (
        <table class="studio-tryon-table">
          <tbody>
            {rows.map((f) => (
              <tr key={f.key} class={f.changed ? "changed" : ""}>
                <th>{factLabel(f.key)}</th>
                <td>{f.before}</td>
                <td aria-hidden="true">→</td>
                <td>
                  <b>{f.after}</b>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result && result.gained.length > 0 && (
        <p class="studio-tryon-list">
          <b>{ui("tryon.gained")}:</b> {result.gained.map(name).join(", ")}
        </p>
      )}
      {result && result.proficiencies.length > 0 && (
        <p class="studio-tryon-list">
          <b>{ui("tryon.proficiencies")}:</b> {result.proficiencies.join(", ")}
        </p>
      )}
      {result && (
        <label class="check studio-check">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.currentTarget.checked)} />
          <span>{ui("tryon.showAll")}</span>
        </label>
      )}
    </details>
  );
}
