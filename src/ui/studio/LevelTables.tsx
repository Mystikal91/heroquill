import { useState } from "preact/hooks";
import type { Entry } from "../../data/schema";
import { applyClassCasting, readClassCasting } from "../../homebrew/casting";
import { updateEntry } from "../../homebrew/entries";
import {
  type LevelRow,
  addColumn,
  fillDown,
  improvementsAt,
  levelRows,
  removeColumn,
  setImprovements,
  setSlot,
  setSpellCount,
  setValue,
  slotsOf,
  valueAt,
  valueColumns,
} from "../../homebrew/levelTables";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { humanize } from "./labels";
import { useEdit } from "./scope";

/** A column by its name: what a person typed as it is, a key of the data (`rageCount`) made readable. */
export const columnLabel = (key: string): string => (/\s/.test(key) ? key : humanize(key));

/** A small box for a whole number: one cell of a table. Empty is "nothing" (and not a zero). */
function Cell({
  label,
  value,
  max,
  onChange,
  onFill,
}: {
  label: string;
  value: number | undefined;
  max: number;
  onChange: (value: number | undefined) => void;
  /** A button that repeats this value on the levels below. */
  onFill?: (() => void) | undefined;
}) {
  return (
    <span class="studio-cell">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        value={value ?? ""}
        aria-label={label}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
      />
      {onFill && (
        <button
          type="button"
          class="studio-fill"
          title={ui("studio.tbl.fill")}
          aria-label={`${ui("studio.tbl.fill")} (${label})`}
          onClick={onFill}
        >
          ↓
        </button>
      )}
    </span>
  );
}

/** What the tables write into: the levels of the entry. */
function useRows(record: UserPackRecord, entry: Entry) {
  const { apply } = useEdit();
  const data = entry.data as Record<string, unknown>;
  const rows = levelRows(data);
  const write = (next: LevelRow[]) =>
    apply(updateEntry(record, entry.id, { data: { levels: next } }), `${entry.id}.levels`);
  return { rows, write, data, apply };
}

/**
 * The spell columns of a class or subclass level by level: cantrips, spells known, and the slots of
 * each spell level. They start from the rules for the way the class casts, and each cell can be changed.
 */
export function SpellTable({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { rows, write, data, apply } = useRows(record, entry);
  const isClass = entry.kind === "class";
  const from = isClass ? 1 : 3;
  const shown = Array.from({ length: 20 - from + 1 }, (_, i) => from + i);
  const row = (level: number) => rows.find((r) => r.level === level);
  const casting = isClass ? readClassCasting(data) : undefined;
  const slotless = casting?.kind === "points";

  return (
    <div class="studio-table-block">
      <p class="muted">{ui("studio.tbl.spellHint")}</p>
      <div class="studio-table-wrap">
        <table class="studio-table">
          <caption class="sr-only">{ui("studio.tbl.spellTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{ui("hb.f.level")}</th>
              <th scope="col">{ui("studio.tbl.cantrips")}</th>
              <th scope="col">{ui("studio.tbl.known")}</th>
              {!slotless &&
                Array.from({ length: 9 }, (_, i) => (
                  <th
                    scope="col"
                    key={`slot-${i + 1}`}
                    title={ui("studio.tbl.slotOf", { n: i + 1 })}
                  >
                    {i + 1}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((level) => {
              const r = row(level);
              const slots = slotsOf(r);
              return (
                <tr key={level}>
                  <th scope="row">{level}</th>
                  <td>
                    <Cell
                      label={`${ui("studio.tbl.cantrips")} ${level}`}
                      value={typeof r?.cantripsKnown === "number" ? r.cantripsKnown : undefined}
                      max={99}
                      onChange={(v) => write(setSpellCount(rows, level, "cantripsKnown", v))}
                    />
                  </td>
                  <td>
                    <Cell
                      label={`${ui("studio.tbl.known")} ${level}`}
                      value={typeof r?.spellsKnown === "number" ? r.spellsKnown : undefined}
                      max={99}
                      onChange={(v) => write(setSpellCount(rows, level, "spellsKnown", v))}
                    />
                  </td>
                  {(slotless ? [] : slots).map((n, i) => (
                    <td key={`slot-${i + 1}`}>
                      <Cell
                        label={`${ui("studio.tbl.slotOf", { n: i + 1 })}, ${ui("hb.f.level")} ${level}`}
                        value={n === 0 && !r?.spellSlots ? undefined : n}
                        max={99}
                        onChange={(v) => write(setSlot(rows, level, i + 1, v))}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {casting && casting.kind !== "none" && (
        <button
          type="button"
          class="link"
          onClick={() => {
            const next = applyClassCasting(data, casting);
            apply(
              updateEntry(record, entry.id, {
                data: { spellcasting: next.spellcasting, levels: next.levels },
              }),
              `${entry.id}.casting`,
            );
          }}
        >
          {ui("studio.tbl.reset")}
        </button>
      )}
    </div>
  );
}

/**
 * The values of a class level by level that are not spells: the ability score improvements, and any
 * column the person adds (ki points, number of rages, dice of an ability). A feature takes one of them
 * as the number of its uses.
 */
export function ValuesTable({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { rows, write } = useRows(record, entry);
  const [name, setName] = useState("");
  const columns = valueColumns(rows);
  const levels = Array.from({ length: 20 }, (_, i) => i + 1);

  const add = () => {
    const key = name.trim();
    if (!key || columns.includes(key)) return;
    write(addColumn(rows, key));
    setName("");
  };
  return (
    <div class="studio-table-block">
      <p class="muted">{ui("studio.tbl.valuesHint")}</p>
      <div class="studio-table-wrap">
        <table class="studio-table">
          <caption class="sr-only">{ui("studio.tbl.valuesTitle")}</caption>
          <thead>
            <tr>
              <th scope="col">{ui("hb.f.level")}</th>
              <th scope="col">{ui("studio.tbl.asi")}</th>
              {columns.map((key) => (
                <th scope="col" key={key}>
                  <span class="studio-col-head">
                    {columnLabel(key)}
                    <button
                      type="button"
                      class="studio-col-remove"
                      title={ui("studio.tbl.removeColumn", { name: columnLabel(key) })}
                      aria-label={ui("studio.tbl.removeColumn", { name: columnLabel(key) })}
                      onClick={() => write(removeColumn(rows, key))}
                    >
                      ×
                    </button>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr key={level}>
                <th scope="row">{level}</th>
                <td>
                  <Cell
                    label={`${ui("studio.tbl.asi")} ${level}`}
                    value={improvementsAt(rows, level)}
                    max={20}
                    onChange={(v) => write(setImprovements(rows, level, v))}
                  />
                </td>
                {columns.map((key) => (
                  <td key={key}>
                    <Cell
                      label={`${columnLabel(key)}, ${ui("hb.f.level")} ${level}`}
                      value={valueAt(rows, level, key)}
                      max={999}
                      onChange={(v) => write(setValue(rows, level, key, v))}
                      onFill={level < 20 ? () => write(fillDown(rows, key, level)) : undefined}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div class="studio-damage-new">
        <input
          type="text"
          value={name}
          placeholder={ui("studio.tbl.newColumn")}
          aria-label={ui("studio.tbl.newColumn")}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          disabled={!name.trim() || columns.includes(name.trim())}
          onClick={add}
        >
          {ui("studio.tbl.addColumn")}
        </button>
      </div>
      <p class="muted">{ui("studio.tbl.useHint")}</p>
    </div>
  );
}
