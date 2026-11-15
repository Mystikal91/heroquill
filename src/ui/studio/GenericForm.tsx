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
        <section class="studio-effects-section">
          <h4>{ui("studio.effects")}</h4>
          <EffectList
            hidden={layout.owns === "trait" ? ["trait"] : []}
            effects={entry.effects}
            onChange={(effects) =>
              applyChange(updateEntry(record, id, { effects }), `${id}.effects`)
            }
          />
        </section>
      )}

      {layout.owns && <OwnedList record={record} owner={entry} kind={layout.owns} />}

      {advanced && rest.length > 0 && (
        <section class="studio-advanced">
          <h4>{ui("studio.advancedFields")}</h4>
          {rest.map(control)}
        </section>
      )}
    </div>
  );
}
