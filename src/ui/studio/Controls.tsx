import { useEffect, useRef, useState } from "preact/hooks";
import { studioMode } from "../../app/studio";
import type { FieldSpec, FieldType } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import { entriesOfKind } from "../build/fields";
import { EffectList } from "./Effects";
import { fieldLabel, humanize, optionLabel } from "./labels";

export { humanize };

export interface Option {
  id: string;
  label: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** One text box, with its label above. */
export function TextBox({
  label,
  value,
  onChange,
  area,
  rows = 4,
  placeholder,
  hint,
  onCommit,
  focusOnMount,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Called when the box is left. */
  onCommit?: () => void;
  /** Takes the focus when it first appears (a new entry waits for its name). */
  focusOnMount?: boolean;
  area?: boolean;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  const note = hint && <small class="muted">{hint}</small>;
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusOnMount) box.current?.focus();
  }, [focusOnMount]);
  if (area)
    return (
      <label class="field studio-field">
        <span>{label}</span>
        <textarea
          rows={rows}
          value={value}
          placeholder={placeholder}
          onInput={(e) => onChange(e.currentTarget.value)}
          onBlur={onCommit}
        />
        {note}
      </label>
    );
  return (
    <label class="field studio-field">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        ref={box}
        placeholder={placeholder}
        onInput={(e) => onChange(e.currentTarget.value)}
        onBlur={onCommit}
      />
      {note}
    </label>
  );
}

export function NumberBox({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number | undefined;
  max?: number | undefined;
  placeholder?: string;
}) {
  return (
    <label class="field studio-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          onChange(raw === "" || Number.isNaN(Number(raw)) ? undefined : Number(raw));
        }}
      />
    </label>
  );
}

export function SelectBox({
  label,
  value,
  options,
  onChange,
  blank,
}: {
  label: string;
  value: string | undefined;
  options: Option[];
  onChange: (value: string | undefined) => void;
  /** The text of the empty choice, when there is one. */
  blank?: string;
}) {
  return (
    <label class="field studio-field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.currentTarget.value || undefined)}>
        {blank !== undefined && <option value="">{blank}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label class="check studio-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

/** A group of checkboxes for picking some of a short list. */
export function ManyBox({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
}) {
  const picked = new Set(value);
  return (
    <fieldset class="studio-many">
      <legend>{label}</legend>
      <div class="studio-checks">
        {options.map((o) => (
          <CheckBox
            key={o.id}
            label={o.label}
            checked={picked.has(o.id)}
            onChange={(on) => {
              const next = new Set(picked);
              if (on) next.add(o.id);
              else next.delete(o.id);
              // Keep the order of the options, not the order of the clicks.
              onChange(options.map((x) => x.id).filter((id) => next.has(id)));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Entries the person can point at, for a field that names some kinds of entry. */
function refOptions(kinds: readonly string[] | undefined): Option[] {
  return (kinds ?? []).flatMap((kind) => entriesOfKind(kind));
}

/** A list of picks from a long list (spells, items): chosen ones as chips, one more added from a menu. */
export function ChipPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string[];
  options: Option[];
  onChange: (value: string[]) => void;
}) {
  const name = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  return (
    <fieldset class="studio-many">
      <legend>{label}</legend>
      <div class="studio-chips">
        {value.map((id) => (
          <span class="studio-chip" key={id}>
            {name(id)}
            <button
              type="button"
              aria-label={`${ui("form.remove")}: ${name(id)}`}
              onClick={() => onChange(value.filter((x) => x !== id))}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <select
        value=""
        onChange={(e) => {
          const id = e.currentTarget.value;
          if (id && !value.includes(id)) onChange([...value, id]);
        }}
      >
        <option value="">{ui("studio.add")}</option>
        {options
          .filter((o) => !value.includes(o.id))
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
      </select>
    </fieldset>
  );
}

/** Any value, written as JSON: the way out for what the editor has no control for yet. */
function JsonBox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(value === undefined ? "" : JSON.stringify(value, null, 2));
  const [bad, setBad] = useState(false);
  return (
    <label class="field studio-field">
      <span>{label}</span>
      <textarea
        rows={4}
        class="studio-json"
        value={text}
        aria-invalid={bad}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          setText(raw);
          if (raw.trim() === "") {
            setBad(false);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(raw));
            setBad(false);
          } catch {
            setBad(true);
          }
        }}
      />
      {bad && <small class="studio-bad">{ui("studio.notJson")}</small>}
    </label>
  );
}

const isShort = (type: FieldType): boolean =>
  type.type === "choice" || type.type === "slug" || type.type === "boolean";

/**
 * The control for any field the catalog describes. It is what the advanced mode is made of: a field
 * added to the catalog gets a control here without anyone drawing one.
 */
export function FieldControl({
  label,
  type,
  value,
  onChange,
  optional = true,
}: {
  label: string;
  type: FieldType;
  value: unknown;
  /** `undefined` takes the value away. */
  onChange: (value: unknown) => void;
  optional?: boolean;
}) {
  switch (type.type) {
    case "text":
    case "dice":
      return (
        <TextBox
          label={label}
          value={typeof value === "string" ? value : ""}
          placeholder={type.type === "dice" ? "1d8" : undefined}
          onChange={(v) => onChange(v === "" && optional ? undefined : v)}
        />
      );
    case "number":
      return (
        <NumberBox
          label={label}
          value={typeof value === "number" ? value : undefined}
          min={type.min}
          max={type.max}
          onChange={onChange}
        />
      );
    case "boolean":
      return (
        <CheckBox
          label={label}
          checked={value === true}
          onChange={(on) => onChange(on ? true : optional ? undefined : false)}
        />
      );
    case "choice":
      return (
        <SelectBox
          label={label}
          value={typeof value === "string" ? value : undefined}
          options={type.options.map((id) => ({ id, label: optionLabel(id) }))}
          blank={optional ? ui("form.none") : undefined}
          onChange={onChange}
        />
      );
    case "literal":
      return null;
    case "ref": {
      const options = refOptions(type.kinds);
      return (
        <SelectBox
          label={label}
          value={typeof value === "string" ? value : undefined}
          options={options}
          blank={ui("form.none")}
          onChange={onChange}
        />
      );
    }
    case "slug": {
      const options = entriesOfKind(type.kind).map((e) => ({
        id: e.id.split("/")[1] ?? e.id,
        label: e.label,
      }));
      return (
        <SelectBox
          label={label}
          value={typeof value === "string" ? value : undefined}
          options={options}
          blank={ui("form.none")}
          onChange={onChange}
        />
      );
    }
    case "list":
      return <ListControl label={label} of={type.of} value={value} onChange={onChange} />;
    case "object":
      return (
        <ObjectControl
          label={label}
          fields={type.fields}
          value={value}
          onChange={onChange}
          optional={optional}
        />
      );
    case "record":
      return <RecordControl label={label} type={type} value={value} onChange={onChange} />;
    case "effects":
      return (
        <fieldset class="studio-many">
          <legend>{label}</legend>
          <EffectList effects={Array.isArray(value) ? value : []} onChange={onChange} />
        </fieldset>
      );
    default:
      return <JsonBox label={label} value={value} onChange={onChange} />;
  }
}

function ListControl({
  label,
  of,
  value,
  onChange,
}: {
  label: string;
  of: FieldType;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const items = Array.isArray(value) ? value : [];
  const set = (next: unknown[]) => onChange(next.length === 0 ? undefined : next);
  if (of.type === "choice")
    return (
      <ManyBox
        label={label}
        value={items.filter((x): x is string => typeof x === "string")}
        options={of.options.map((id) => ({ id, label: id }))}
        onChange={set}
      />
    );
  if (of.type === "ref")
    return (
      <ChipPicker
        label={label}
        value={items.filter((x): x is string => typeof x === "string")}
        options={refOptions(of.kinds)}
        onChange={set}
      />
    );
  return (
    <fieldset class="studio-many">
      <legend>{label}</legend>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own
        <div class="studio-row" key={i}>
          <FieldControl
            label={`${i + 1}`}
            type={of}
            value={item}
            optional={false}
            onChange={(next) => set(items.map((x, j) => (j === i ? next : x)))}
          />
          <button type="button" class="danger" onClick={() => set(items.filter((_, j) => j !== i))}>
            {ui("form.remove")}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set([...items, blankOf(of)])}>
        {ui("studio.addRow")}
      </button>
    </fieldset>
  );
}

/** A fresh value for a row of a list: empty, of the right shape. */
function blankOf(type: FieldType): unknown {
  switch (type.type) {
    case "object":
      return {};
    case "list":
      return [];
    case "record":
      return {};
    case "number":
      return 0;
    case "boolean":
      return false;
    case "choice":
      return type.options[0];
    default:
      return "";
  }
}

function ObjectControl({
  label,
  fields,
  value,
  onChange,
  optional,
}: {
  label: string;
  fields: FieldSpec[];
  value: unknown;
  onChange: (value: unknown) => void;
  optional: boolean;
}) {
  const object = isObject(value) ? value : undefined;
  if (!object && optional)
    return (
      <div class="studio-field">
        <button type="button" onClick={() => onChange({})}>
          {ui("studio.addNamed", { name: label })}
        </button>
      </div>
    );
  const here = object ?? {};
  const set = (key: string, next: unknown) => {
    const copy = { ...here };
    if (next === undefined) delete copy[key];
    else copy[key] = next;
    // An object with nothing in it is no object, unless a field of it must be there.
    onChange(Object.keys(copy).length === 0 && optional ? undefined : copy);
  };
  // A beginner sees the guided fields of an object; the advanced mode shows all of them.
  const shown = fields.filter((f) => studioMode.value === "advanced" || f.level === "guided");
  const short = shown.filter((f) => isShort(f.type) || f.type.type === "number");
  const long = shown.filter((f) => !short.includes(f));
  return (
    <fieldset class="studio-many">
      <legend>{label}</legend>
      {optional && (
        <button type="button" class="danger studio-drop" onClick={() => onChange(undefined)}>
          {ui("form.remove")}
        </button>
      )}
      <div class="studio-grid">
        {short.map((f) => (
          <FieldControl
            key={f.key}
            label={fieldLabel(f.key)}
            type={f.type}
            value={here[f.key]}
            optional={f.optional}
            onChange={(next) => set(f.key, next)}
          />
        ))}
      </div>
      {long.map((f) => (
        <FieldControl
          key={f.key}
          label={fieldLabel(f.key)}
          type={f.type}
          value={here[f.key]}
          optional={f.optional}
          onChange={(next) => set(f.key, next)}
        />
      ))}
    </fieldset>
  );
}

function RecordControl({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: Extract<FieldType, { type: "record" }>;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const record = isObject(value) ? value : {};
  const keys = Object.keys(record);
  const set = (next: Record<string, unknown>) =>
    onChange(Object.keys(next).length === 0 ? undefined : next);
  const rename = (from: string, to: string) => {
    if (!to || (to !== from && to in record)) return;
    set(Object.fromEntries(Object.entries(record).map(([k, v]) => [k === from ? to : k, v])));
  };
  return (
    <fieldset class="studio-many">
      <legend>{label}</legend>
      {keys.map((key) => (
        <div class="studio-row" key={key}>
          <label class="field studio-field">
            <span>{ui("studio.key")}</span>
            <input
              type="text"
              value={key}
              onChange={(e) => rename(key, e.currentTarget.value.trim())}
            />
          </label>
          <FieldControl
            label={ui("studio.value")}
            type={type.of}
            value={record[key]}
            optional={false}
            onChange={(next) => set({ ...record, [key]: next ?? blankOf(type.of) })}
          />
          <button
            type="button"
            class="danger"
            onClick={() =>
              set(Object.fromEntries(Object.entries(record).filter(([k]) => k !== key)))
            }
          >
            {ui("form.remove")}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const free = type.keys?.find((k) => !(k in record));
          let name = free ?? "new";
          for (let n = 2; name in record; n++) name = `new${n}`;
          set({ ...record, [name]: blankOf(type.of) });
        }}
      >
        {ui("studio.addRow")}
      </button>
    </fieldset>
  );
}
