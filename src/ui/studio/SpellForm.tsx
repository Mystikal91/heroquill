import { studioMode } from "../../app/studio";
import type { Entry } from "../../data/schema";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { setText, updateEntry } from "../../homebrew/entries";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { CheckBox, FieldControl, ManyBox, SelectBox, TextBox } from "./Controls";
import { fieldLabel } from "./labels";
import { useEdit } from "./scope";

/** The fields of a spell the guided form draws itself; the advanced mode adds all the others. */
const CURATED = new Set(["level", "school", "components", "ritual", "concentration", "classes"]);

const LEVELS = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  label: i === 0 ? ui("spells.cantrip") : String(i),
}));

/** The form of a spell: it edits the entry itself, so nothing it does not show is lost. */
export function SpellForm({
  record,
  entry,
  hideClasses = false,
}: {
  record: UserPackRecord;
  entry: Entry;
  /** The classes are already settled by where the form is opened. */
  hideClasses?: boolean;
}) {
  const { apply: applyChange } = useEdit();
  const id = entry.id;
  const data = entry.data as Record<string, unknown>;
  const text = (field: string) => record.strings[`${id}.${field}`] ?? "";
  const writeText = (field: string, value: string) =>
    applyChange(setText(record, id, field, value), `${id}.${field}`);
  const writeData = (key: string, value: unknown) =>
    applyChange(updateEntry(record, id, { data: { [key]: value } }), `${id}.data.${key}`);

  const components = Array.isArray(data.components) ? (data.components as string[]) : [];
  const schools = entriesOfKind("school").map((e) => ({
    id: e.id.split("/")[1] ?? e.id,
    label: e.label,
  }));
  const classes = entriesOfKind("class");
  const advanced = studioMode.value === "advanced";
  const extra = DATA_FIELDS.spell.filter((f) => !CURATED.has(f.key));

  return (
    <div class="studio-form">
      <div class="studio-grid">
        <SelectBox
          label={ui("hb.f.level")}
          value={String(data.level ?? 0)}
          options={LEVELS}
          onChange={(v) => writeData("level", Number(v ?? 0))}
        />
        <SelectBox
          label={ui("hb.f.school")}
          value={typeof data.school === "string" ? data.school : "evocation"}
          options={schools}
          onChange={(v) => writeData("school", v ?? "evocation")}
        />
      </div>
      <div class="studio-grid">
        <TextBox
          label={ui("hb.f.castingTime")}
          value={text("castingTime")}
          placeholder={ui("hint.castingTime")}
          onChange={(v) => writeText("castingTime", v)}
        />
        <TextBox
          label={ui("hb.f.range")}
          value={text("range")}
          placeholder={ui("hint.range")}
          onChange={(v) => writeText("range", v)}
        />
        <TextBox
          label={ui("hb.f.duration")}
          value={text("duration")}
          placeholder={ui("hint.duration")}
          onChange={(v) => writeText("duration", v)}
        />
      </div>
      <div class="studio-checks">
        {(
          [
            ["V", "hb.f.compV"],
            ["S", "hb.f.compS"],
            ["M", "hb.f.compM"],
          ] as const
        ).map(([letter, key]) => (
          <CheckBox
            key={letter}
            label={ui(key)}
            checked={components.includes(letter)}
            onChange={(on) =>
              writeData(
                "components",
                ["V", "S", "M"].filter((l) => (l === letter ? on : components.includes(l))),
              )
            }
          />
        ))}
        <CheckBox
          label={ui("hb.f.ritual")}
          checked={data.ritual === true}
          onChange={(on) => writeData("ritual", on)}
        />
        <CheckBox
          label={ui("hb.f.concentration")}
          checked={data.concentration === true}
          onChange={(on) => writeData("concentration", on)}
        />
      </div>
      {components.includes("M") && (
        <TextBox
          label={ui("hb.f.material")}
          value={text("material")}
          onChange={(v) => writeText("material", v)}
        />
      )}
      {!hideClasses && (
        <ManyBox
          label={ui("hb.f.classes")}
          value={Array.isArray(data.classes) ? (data.classes as string[]) : []}
          options={classes}
          onChange={(v) => writeData("classes", v)}
        />
      )}
      <TextBox
        label={ui("hb.f.desc")}
        placeholder={ui("hint.desc")}
        value={text("desc")}
        area
        rows={7}
        onChange={(v) => writeText("desc", v)}
      />
      <TextBox
        label={ui("hb.f.higherLevel")}
        value={text("higherLevel")}
        area
        rows={3}
        onChange={(v) => writeText("higherLevel", v)}
      />

      {advanced && (
        <section class="studio-advanced">
          <h4>{ui("studio.advancedFields")}</h4>
          {extra.map((spec) => (
            <FieldControl
              key={spec.key}
              label={fieldLabel(spec.key)}
              type={spec.type}
              value={data[spec.key]}
              optional={spec.optional}
              onChange={(v) => writeData(spec.key, v)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
