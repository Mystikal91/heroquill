import { studioMode } from "../../app/studio";
import type { Entry } from "../../data/schema";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { readTable, setTable, setText, updateEntry } from "../../homebrew/entries";
import { syncItemData } from "../../homebrew/sync";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { ClassCasting, SubclassCasting } from "./Casting";
import { FieldControl, SelectBox, TextBox } from "./Controls";
import { EffectList } from "./Effects";
import { LevelStrip } from "./LevelStrip";
import { OwnedList } from "./Owned";
import { fieldLabel } from "./labels";
import { LAYOUTS } from "./layouts";
import { useEdit } from "./scope";

/**
 * The form of any kind of entry, made from its layout and the catalog: the texts, the fields of the
 * data (a beginner's first, the rest in the advanced mode), the effects, and what the entry owns.
 */
export function GenericForm({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { apply: applyChange } = useEdit();
  const id = entry.id;
  const layout = LAYOUTS[entry.kind];
  const advanced = studioMode.value === "advanced";
  const data = entry.data as Record<string, unknown>;
  const specs = DATA_FIELDS[entry.kind];
  const guided = layout.guided(entry);
  const shown = specs.filter((s) => guided.includes(s.key));
  const rest = specs.filter((s) => !guided.includes(s.key));

  const writeText = (field: string, value: string) =>
    applyChange(setText(record, id, field, value), `${id}.${field}`);
  const writeData = (key: string, value: unknown) => {
    const next = { ...data };
    if (value === undefined) delete next[key];
    else next[key] = value;
    const patch = entry.kind === "item" ? syncItemData(next) : next;
    // Replace the whole data: a key taken away must be gone, which a merge cannot say.
    const cleared = Object.fromEntries(
      Object.keys(data)
        .filter((k) => !(k in patch))
        .map((k) => [k, undefined]),
    );
    applyChange(updateEntry(record, id, { data: { ...patch, ...cleared } }), `${id}.data.${key}`);
  };

  const control = (spec: (typeof specs)[number]) => (
    <FieldControl
      key={spec.key}
      label={fieldLabel(spec.key)}
      type={spec.type}
      value={data[spec.key]}
      optional={spec.optional}
      onChange={(v) => writeData(spec.key, v)}
    />
  );

  return (
    <div class="studio-form">
      <JumpBar
        sections={[
          layout.effects && ["sec-effects", ui("studio.effects")],
          layout.owns && [
            "sec-owned",
            ui(layout.owns === "trait" ? "studio.traits" : "studio.features"),
          ],
          advanced && rest.length > 0 && ["sec-more", ui("studio.advancedFields")],
        ]}
      />
      {layout.parent && (
        <SelectBox
          label={ui("studio.parent")}
          value={entry.parent}
          options={entriesOfKind(layout.parent)}
          blank={ui("form.none")}
          onChange={(v) =>
            applyChange(
              updateEntry(record, id, { parent: v as Entry["id"] | undefined }),
              `${id}.parent`,
            )
          }
        />
      )}
      {layout.texts.map(([field, area]) => (
        <TextBox
          key={field}
          label={fieldLabel(field)}
          value={record.strings[`${id}.${field}`] ?? ""}
          area={area}
          rows={area ? 5 : undefined}
          placeholder={field === "desc" ? ui("hint.desc") : undefined}
          onChange={(v) => writeText(field, v)}
        />
      ))}
      {layout.tables?.map(([field, picks]) => (
        <TextBox
          key={field}
          label={fieldLabel(field)}
          hint={ui("studio.tableHint")}
          area
          rows={3}
          value={readTable(record, id, field).join("\n")}
          onChange={(v) =>
            applyChange(setTable(record, id, field, v.split("\n"), picks), `${id}.${field}`)
          }
        />
      ))}

      {shown.map(control)}

      {layout.casting === "class" && <ClassCasting record={record} entry={entry} />}
      {layout.casting === "subclass" && <SubclassCasting record={record} entry={entry} />}

      {layout.effects && (
        <details class="studio-effects-section studio-section" id="sec-effects" open>
          <summary>
            <h4>{ui("studio.effects")}</h4>
          </summary>
          <EffectList
            hidden={layout.owns === "trait" ? ["trait"] : []}
            effects={entry.effects}
            onChange={(effects) =>
              applyChange(updateEntry(record, id, { effects }), `${id}.effects`)
            }
          />
        </details>
      )}

      {layout.owns === "feature" && <LevelStrip record={record} entry={entry} />}
      {layout.owns && <OwnedList record={record} owner={entry} kind={layout.owns} />}

      {advanced && rest.length > 0 && (
        <details class="studio-advanced studio-section" id="sec-more" open>
          <summary>
            <h4>{ui("studio.advancedFields")}</h4>
          </summary>
          {rest.map(control)}
        </details>
      )}
    </div>
  );
}

/** Links to the sections of a long form, for the kinds that have several (a class, a species). */
function JumpBar({ sections }: { sections: (false | undefined | [string, string])[] }) {
  const found = sections.filter((s): s is [string, string] => Array.isArray(s));
  if (found.length < 2) return null;
  return (
    <nav class="studio-jump" aria-label={ui("studio.jump")}>
      <span class="muted">{ui("studio.jump")}</span>
      {found.map(([id, label]) => (
        <button
          type="button"
          key={id}
          onClick={() => {
            const section = document.getElementById(id) as HTMLDetailsElement | null;
            if (!section) return;
            section.open = true;
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
