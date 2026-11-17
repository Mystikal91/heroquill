import type { Entry } from "../../data/schema";
import { readClassCasting, readSubclassCasting } from "../../homebrew/casting";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { readTable, setTable, updateEntry } from "../../homebrew/entries";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { ClassCasting, SubclassCasting } from "./Casting";
import { FieldControl, SelectBox, TextBox } from "./Controls";
import { EffectList } from "./Effects";
import { fieldHelp } from "./Help";
import { LevelStrip } from "./LevelStrip";
import { SpellTable, ValuesTable } from "./LevelTables";
import { OwnedList } from "./Owned";
import { useEntryWrites } from "./entryWrites";
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
  const data = entry.data as Record<string, unknown>;
  const specs = DATA_FIELDS[entry.kind];
  const guided = layout.guided(entry);
  const shown = specs.filter((s) => guided.includes(s.key));
  // The level tables of a class or subclass have sections of their own: the raw list is not offered twice.
  const rest = specs.filter(
    (s) => !guided.includes(s.key) && !(layout.casting && s.key === "levels"),
  );
  const casts =
    layout.casting === "class"
      ? readClassCasting(data).kind !== "none"
      : layout.casting === "subclass" && readSubclassCasting(data).enabled;

  const { writeText, writeData } = useEntryWrites(record, entry);

  const control = (spec: (typeof specs)[number]) => (
    <FieldControl
      key={spec.key}
      label={fieldLabel(spec.key)}
      help={fieldHelp(spec.key)}
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
          layout.casting && ["sec-spells", ui("studio.spellsSection")],
          entry.kind === "class" && ["sec-values", ui("studio.valuesSection")],
          layout.effects && ["sec-effects", ui("studio.effects")],
          layout.owns && [
            "sec-owned",
            ui(layout.owns === "trait" ? "studio.traits" : "studio.features"),
          ],
          rest.length > 0 && ["sec-more", ui("studio.advancedFields")],
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

      {layout.casting && (
        <details class="studio-section studio-spells" id="sec-spells" open>
          <summary>
            <h4>{ui("studio.spellsSection")}</h4>
          </summary>
          {layout.casting === "class" && <ClassCasting record={record} entry={entry} />}
          {layout.casting === "subclass" && <SubclassCasting record={record} entry={entry} />}
          {casts && <SpellTable record={record} entry={entry} />}
        </details>
      )}

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

      {entry.kind === "class" && (
        <details class="studio-section studio-values" id="sec-values" open>
          <summary>
            <h4>{ui("studio.valuesSection")}</h4>
          </summary>
          <ValuesTable record={record} entry={entry} />
        </details>
      )}

      {layout.owns === "feature" && <LevelStrip record={record} entry={entry} />}
      {layout.owns && <OwnedList record={record} owner={entry} kind={layout.owns} />}

      {rest.length > 0 && (
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
