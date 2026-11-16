import { studioMode } from "../../app/studio";
import type { Entry } from "../../data/schema";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { setText, updateEntry } from "../../homebrew/entries";
import { ownReserves } from "../../homebrew/reserves";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { CheckBox, FieldControl, ManyBox, NumberBox, SelectBox, TextBox } from "./Controls";
import { fieldLabel } from "./labels";
import { useEdit, usePack } from "./scope";

/** The fields of a spell the guided form draws itself; the advanced mode adds all the others. */
const CURATED = new Set([
  "level",
  "school",
  "components",
  "ritual",
  "concentration",
  "classes",
  "pointCost",
]);

const LEVELS = Array.from({ length: 10 }, (_, i) => ({
  id: String(i),
  label: i === 0 ? ui("spells.cantrip") : String(i),
}));

interface Props {
  record: UserPackRecord;
  entry: Entry;
}

/** What the parts of a spell form read and write: they edit the entry itself, so nothing they do not show is lost. */
function useSpell(record: UserPackRecord, entry: Entry) {
  const { apply: applyChange } = useEdit();
  const id = entry.id;
  const data = entry.data as Record<string, unknown>;
  return {
    data,
    text: (field: string) => record.strings[`${id}.${field}`] ?? "",
    writeText: (field: string, value: string) =>
      applyChange(setText(record, id, field, value), `${id}.${field}`),
    writeData: (key: string, value: unknown) =>
      applyChange(updateEntry(record, id, { data: { [key]: value } }), `${id}.data.${key}`),
  };
}

/** The level and the school of a spell. */
export function SpellLevelSchool({ record, entry }: Props) {
  const { data, writeData } = useSpell(record, entry);
  const schools = entriesOfKind("school").map((e) => ({
    id: e.id.split("/")[1] ?? e.id,
    label: e.label,
  }));
  return (
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
  );
}

/** How a spell is cast: the time, the range, the duration, the components. */
export function SpellCasting({ record, entry }: Props) {
  const { data, text, writeText, writeData } = useSpell(record, entry);
  const pack = usePack();
  // The components of the rules, then those the pack declares (a psionic book's A and O).
  const own = pack?.meta?.components ?? [];
  const codes = ["V", "S", "M", ...own];
  const components = Array.isArray(data.components) ? (data.components as string[]) : [];
  return (
    <>
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
                codes.filter((l) => (l === letter ? on : components.includes(l))),
              )
            }
          />
        ))}
        {own.map((letter) => (
          <CheckBox
            key={letter}
            label={letter}
            checked={components.includes(letter)}
            onChange={(on) =>
              writeData(
                "components",
                codes.filter((l) => (l === letter ? on : components.includes(l))),
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
      {ownReserves(pack ?? ({} as UserPackRecord)).length > 0 && (
        <NumberBox
          label={fieldLabel("pointCost")}
          min={0}
          value={typeof data.pointCost === "number" ? data.pointCost : undefined}
          onChange={(v) => writeData("pointCost", v)}
        />
      )}
      {components.includes("M") && (
        <TextBox
          label={ui("hb.f.material")}
          value={text("material")}
          onChange={(v) => writeText("material", v)}
        />
      )}
    </>
  );
}

/** The classes whose spell list a spell is on. */
export function SpellClasses({ record, entry }: Props) {
  const { data, writeData } = useSpell(record, entry);
  return (
    <ManyBox
      label={ui("hb.f.classes")}
      value={Array.isArray(data.classes) ? (data.classes as string[]) : []}
      options={entriesOfKind("class")}
      onChange={(v) => writeData("classes", v)}
    />
  );
}

/** What a spell does, and what it does at a higher level. */
export function SpellTexts({ record, entry }: Props) {
  const { text, writeText } = useSpell(record, entry);
  return (
    <>
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
    </>
  );
}

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
  const { data, writeData } = useSpell(record, entry);
  const advanced = studioMode.value === "advanced";
  const extra = DATA_FIELDS.spell.filter((f) => !CURATED.has(f.key));

  return (
    <div class="studio-form">
      <SpellLevelSchool record={record} entry={entry} />
      <SpellCasting record={record} entry={entry} />
      {!hideClasses && <SpellClasses record={record} entry={entry} />}
      <SpellTexts record={record} entry={entry} />

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
