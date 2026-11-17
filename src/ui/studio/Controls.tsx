import { useEffect, useRef, useState } from "preact/hooks";
import en from "../../../locales/en/ui.json";
import { tintOf } from "../../app/playStates";
import { content } from "../../app/store";
import { studioLanguage } from "../../app/studio";
import type { FieldSpec, FieldType } from "../../homebrew/catalog";
import { addDamageType, damageLabel, ownDamageTypes } from "../../homebrew/damage";
import { packColumns } from "../../homebrew/levelTables";
import { addReserve, ownReserves, reserveLabel } from "../../homebrew/reserves";
import { type UiKey, ui } from "../../i18n/ui";
import { feetFrom, feetTo, poundsTo } from "../../i18n/units";
import { damageSlug } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { EffectList, proficiencyTargets } from "./Effects";
import { HelpMark, Helped, NoHelp, fieldHelp } from "./Help";
import { columnLabel } from "./LevelTables";
import { moved, useReorder } from "./Reorder";
import { LONG_LIST, SearchSelect } from "./SearchSelect";
import { fieldLabel, humanize, optionLabel } from "./labels";
import { useEdit, useMetric, usePack } from "./scope";

export { humanize };

export interface Option {
  id: string;
  label: string;
  /** A heading to list the option under, when the menu has more than one kind of option. */
  group?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The options in the order they come, gathered under their headings (those without one stay as they are). */
function groupsOf(options: Option[]): { group: string | undefined; items: Option[] }[] {
  const out: { group: string | undefined; items: Option[] }[] = [];
  for (const o of options) {
    const at = out.find((g) => g.group === o.group);
    if (at) at.items.push(o);
    else out.push({ group: o.group, items: [o] });
  }
  return out;
}

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
        <span>
          {label}
          <HelpMark />
        </span>
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
      <span>
        {label}
        <HelpMark />
      </span>
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
  unit,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number | undefined;
  max?: number | undefined;
  placeholder?: string;
  /** The number is a distance (feet) or a weight (pounds): shown and typed in the units of the pack. */
  unit?: "distance" | "weight" | undefined;
}) {
  const metric = useMetric();
  // While the person types, what they typed stays as it is: converting back and forth would round it under their fingers.
  const [typed, setTyped] = useState<string | undefined>(undefined);
  const suffix =
    unit === "distance" ? (metric ? "m" : "ft") : unit === "weight" ? (metric ? "kg" : "lb") : "";
  const shown = (v: number) => {
    const n = unit === "distance" ? feetTo(v, metric) : unit === "weight" ? poundsTo(v, metric) : v;
    return Math.round(n * 100) / 100;
  };
  const stored = (v: number) =>
    unit === "distance"
      ? Math.round(feetFrom(v, metric))
      : unit === "weight"
        ? Math.round((metric ? v / 0.5 : v) * 100) / 100
        : v;
  return (
    <label class="field studio-field">
      <span>{suffix ? `${label} (${suffix})` : label}</span>
      <input
        type="number"
        step={unit ? "any" : undefined}
        min={unit ? undefined : min}
        max={unit ? undefined : max}
        value={typed ?? (value === undefined ? "" : shown(value))}
        placeholder={placeholder}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          setTyped(raw);
          onChange(raw === "" || Number.isNaN(Number(raw)) ? undefined : stored(Number(raw)));
        }}
        onBlur={() => setTyped(undefined)}
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
  if (options.length > LONG_LIST)
    return (
      <SearchSelect
        label={label}
        shown={options.find((o) => o.id === value)?.label ?? blank ?? ""}
        options={options}
        {...(blank !== undefined && { blank })}
        onPick={onChange}
      />
    );
  return (
    <label class="field studio-field">
      <span>
        {label}
        <HelpMark />
      </span>
      <select value={value ?? ""} onChange={(e) => onChange(e.currentTarget.value || undefined)}>
        {blank !== undefined && <option value="">{blank}</option>}
        {groupsOf(options).map(({ group, items }) =>
          group === undefined ? (
            items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))
          ) : (
            <optgroup key={group} label={group}>
              {items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ),
        )}
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
      <span>
        {label}
        <HelpMark />
      </span>
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
      <legend>
        {label}
        <HelpMark />
      </legend>
      <NoHelp>
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
      </NoHelp>
    </fieldset>
  );
}

/** The kinds of damage of the rules, as their ids. */
export const DAMAGE_KINDS = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "psychic",
  "radiant",
  "slashing",
  "thunder",
];

/** The colours of a glow that have a name; the person can pick any other with the colour box. */
const GLOW_COLORS: Record<string, string> = {
  red: "#d6463c",
  orange: "#eb8728",
  yellow: "#e6c83c",
  green: "#50b45a",
  teal: "#32afaa",
  blue: "#4678e1",
  violet: "#8c5ad7",
  pink: "#e86aa3",
  grey: "#969ba5",
  black: "#000000",
};

/** A colour: ten with a name to tap, and a box that opens the colour picker of the device for any other. */
function ColorPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
}) {
  const current = typeof value === "string" ? value : "";
  const hex = current in GLOW_COLORS ? (GLOW_COLORS[current] ?? "#888888") : current;
  const picked = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#888888";
  const custom = /^#[0-9a-f]{6}$/i.test(current);
  const tint = tintOf(current);
  return (
    <fieldset class="studio-many studio-colors">
      <legend>
        {label}
        <HelpMark />
      </legend>
      <div class="studio-swatches">
        {Object.entries(GLOW_COLORS).map(([id, color]) => (
          <button
            type="button"
            key={id}
            class="studio-swatch"
            style={{ background: color }}
            aria-label={optionLabel(id)}
            aria-pressed={current === id}
            title={optionLabel(id)}
            onClick={() => onChange(current === id ? undefined : id)}
          />
        ))}
        <label class="studio-swatch-free" title={ui("studio.colorFree")}>
          <span
            class="studio-swatch"
            data-custom={custom ? "on" : undefined}
            style={custom ? { background: picked } : undefined}
          />
          <input
            type="color"
            value={picked}
            aria-label={ui("studio.colorFree")}
            onInput={(e) => onChange(e.currentTarget.value)}
          />
          <span>{ui("studio.colorFree")}</span>
        </label>
      </div>
      {tint && (
        <div class="studio-glow-preview" style={{ "--aura": tint }}>
          {ui("studio.glowPreview")}
        </div>
      )}
    </fieldset>
  );
}

/**
 * A kind of damage: a menu with the thirteen of the rules, those the pack adds, and a way to
 * add one more without leaving the form.
 */
function DamagePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
}) {
  const scope = useEdit();
  const pack = usePack();
  const [adding, setAdding] = useState(false);
  const latest = useRef(onChange);
  latest.current = onChange;
  const [name, setName] = useState("");
  const own = pack ? ownDamageTypes(pack) : [];
  const language = studioLanguage.value ?? pack?.lang ?? "en";
  const options = withCurrent(
    [
      ...DAMAGE_KINDS.map((id) => ({ id, label: optionLabel(id) })),
      ...own.map((id) => ({ id, label: pack ? damageLabel(pack, id, language) : id })),
    ],
    value,
  );
  const add = () => {
    if (!pack) return;
    // The name a person wrote is kept as a text of the pack, so it can be translated.
    const id = damageSlug(name);
    if (!id) return;
    const made = DAMAGE_KINDS.includes(id) ? undefined : addDamageType(pack, name);
    if (made && made.record !== pack) scope.apply(made.record, "pack.damage");
    // The pack changes first; the value is written once the form has seen it, or it would write the old pack back.
    setTimeout(() => latest.current(id), 0);
    setName("");
    setAdding(false);
  };
  return (
    <div class="studio-damage-pick">
      <SelectBox
        label={label}
        value={typeof value === "string" ? value : undefined}
        options={options}
        blank={ui("form.none")}
        onChange={onChange}
      />
      {pack &&
        (adding ? (
          <div class="studio-damage-new">
            <input
              type="text"
              value={name}
              // biome-ignore lint/a11y/noAutofocus: it opens because the person asked for a new kind
              autoFocus
              placeholder={ui("studio.damageNew")}
              aria-label={ui("studio.damageNew")}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button type="button" disabled={!damageSlug(name)} onClick={add}>
              {ui("studio.add")}
            </button>
            <button type="button" class="link" onClick={() => setAdding(false)}>
              {ui("hb.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" class="link" onClick={() => setAdding(true)}>
            {ui("studio.damageAdd")}
          </button>
        ))}
    </div>
  );
}

/**
 * A reserve of points the pack declares ("Psi points"): picked from a menu, with a way to declare
 * a new one without leaving the form. Empty means the points are the entry's own.
 */
function ReservePick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
}) {
  const scope = useEdit();
  const pack = usePack();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const latest = useRef(onChange);
  latest.current = onChange;
  const language = studioLanguage.value ?? pack?.lang ?? "en";
  const own = pack ? ownReserves(pack) : [];
  const add = () => {
    if (!pack) return;
    const made = addReserve(pack, name);
    if (!made) return;
    if (made.record !== pack) scope.apply(made.record, "pack.reserve");
    // The pack changes first; the value is written once the form has seen it.
    setTimeout(() => latest.current(made.slug), 0);
    setName("");
    setAdding(false);
  };
  return (
    <div class="studio-damage-pick">
      <SelectBox
        label={label}
        value={typeof value === "string" && value !== "" ? value : undefined}
        options={withCurrent(
          own.map((id) => ({ id, label: pack ? reserveLabel(pack, id, language) : id })),
          value,
        )}
        blank={ui("studio.reserveOwn")}
        onChange={onChange}
      />
      {pack &&
        (adding ? (
          <div class="studio-damage-new">
            <input
              type="text"
              value={name}
              // biome-ignore lint/a11y/noAutofocus: it opens because the person asked for a new reserve
              autoFocus
              placeholder={ui("studio.reserveNew")}
              aria-label={ui("studio.reserveNew")}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <button type="button" disabled={!damageSlug(name)} onClick={add}>
              {ui("studio.add")}
            </button>
            <button type="button" class="link" onClick={() => setAdding(false)}>
              {ui("hb.cancel")}
            </button>
          </div>
        ) : (
          <button type="button" class="link" onClick={() => setAdding(true)}>
            {ui("studio.reserveAdd")}
          </button>
        ))}
    </div>
  );
}

/**
 * A column of the table of values of a class ("Punti ki"): picked from those the classes of the open
 * pack have, with a line that says where to make one when there is none yet.
 */
function ColumnPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
}) {
  const pack = usePack();
  const columns = packColumns(pack?.pack.entries ?? []);
  return (
    <>
      <SelectBox
        label={label}
        value={typeof value === "string" && value !== "" ? value : undefined}
        options={withCurrent(
          columns.map((id) => ({ id, label: columnLabel(id) })),
          value,
        )}
        blank={ui("form.none")}
        onChange={onChange}
      />
      {columns.length === 0 && <small class="muted">{ui("studio.noColumns")}</small>}
    </>
  );
}

/** The options of a menu, with the value already written kept in it when the list does not know it. */
export function withCurrent(options: Option[], value: unknown): Option[] {
  return typeof value === "string" && value !== "" && !options.some((o) => o.id === value)
    ? [...options, { id: value, label: value }]
    : options;
}

/** Entries the person can point at, for a field that names some kinds of entry. */
function refOptions(kinds: readonly string[] | undefined, mastery?: boolean): Option[] {
  const all = (kinds ?? []).flatMap((kind) => entriesOfKind(kind));
  if (mastery === undefined) return all;
  const index = content.value?.index;
  const isMastery = (id: string) => index?.get(id)?.data.mastery === true;
  // The masteries are a rule of 2024: they are offered whatever the edition of the open sheet.
  if (mastery)
    return [...(index?.values() ?? [])]
      .filter((e) => e.kind === "property" && e.data.mastery === true)
      .map((e) => ({ id: e.id, label: content.value?.name(e.id) ?? e.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  return all.filter((o) => !isMastery(o.id));
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
      <legend>
        {label}
        <HelpMark />
      </legend>
      {options.length > LONG_LIST ? (
        <SearchSelect
          shown={ui("studio.add")}
          options={options.filter((o) => !value.includes(o.id))}
          onPick={(id) => {
            if (id && !value.includes(id)) onChange([...value, id]);
          }}
        />
      ) : (
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
      )}
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
      <span>
        {label}
        <HelpMark />
      </span>
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
  help,
  ...props
}: {
  /** For a box that is a row of a list: the button that takes the row away, at the top of the box. */
  onRemove?: (() => void) | undefined;
  label: string;
  type: FieldType;
  value: unknown;
  /** `undefined` takes the value away. */
  onChange: (value: unknown) => void;
  optional?: boolean;
  /** What the field is for, in a line: shown under a "?" that sits by the label. */
  help?: string | undefined;
}) {
  return (
    <Helped help={help}>
      <PlainFieldControl {...props} />
    </Helped>
  );
}

function PlainFieldControl({
  label,
  type,
  value,
  onChange,
  optional = true,
  onRemove,
}: {
  label: string;
  type: FieldType;
  value: unknown;
  onChange: (value: unknown) => void;
  optional?: boolean;
  onRemove?: (() => void) | undefined;
}) {
  switch (type.type) {
    case "text":
      if (type.type === "text" && type.pick === "color")
        return <ColorPick label={label} value={value} onChange={onChange} />;
      if (type.type === "text" && type.options)
        return (
          <SelectBox
            label={label}
            value={typeof value === "string" && value !== "" ? value : undefined}
            options={withCurrent(
              type.options.map((id) => ({ id, label: optionLabel(id) })),
              value,
            )}
            blank={optional ? ui("form.none") : undefined}
            onChange={(v) => onChange(v === undefined || v === "" ? undefined : v)}
          />
        );
      if (type.type === "text" && type.pick === "reserve")
        return <ReservePick label={label} value={value} onChange={onChange} />;
      if (type.type === "text" && type.pick === "column")
        return <ColumnPick label={label} value={value} onChange={onChange} />;
      if (type.type === "text" && type.pick === "damage")
        return <DamagePick label={label} value={value} onChange={onChange} />;
      return (
        <TextBox
          label={label}
          value={typeof value === "string" ? value : ""}
          onChange={(v) => onChange(v === "" && optional ? undefined : v)}
        />
      );
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
          unit={type.unit}
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
      const options = withCurrent(refOptions(type.kinds, type.mastery), value);
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
          onRemove={onRemove}
        />
      );
    case "record":
      return <RecordControl label={label} type={type} value={value} onChange={onChange} />;
    case "union": {
      const branches = branchesOf(type);
      if (branches) return <UnionControl branches={branches} value={value} onChange={onChange} />;
      return <JsonBox label={label} value={value} onChange={onChange} />;
    }
    case "effects":
      return (
        <fieldset class="studio-many">
          <legend>
            {label}
            <HelpMark />
          </legend>
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
  const reorder = useReorder(items.length, (from, to) => set(moved(items, from, to)));
  if (of.type === "choice")
    return (
      <ManyBox
        label={label}
        value={items.filter((x): x is string => typeof x === "string")}
        options={of.options.map((id) => ({ id, label: optionLabel(id) }))}
        onChange={set}
      />
    );
  if (of.type === "text" && (of.pick === "weaponProf" || of.pick === "armorProf")) {
    const category = of.pick === "weaponProf" ? "weapon" : "armor";
    return (
      <ChipPicker
        label={label}
        value={items.filter((x): x is string => typeof x === "string")}
        options={(proficiencyTargets(category) ?? []).map((o) => ({
          ...o,
          id: `${category}:${o.id}`,
        }))}
        onChange={set}
      />
    );
  }
  if (of.type === "ref")
    return (
      <ChipPicker
        label={label}
        value={items.filter((x): x is string => typeof x === "string")}
        options={refOptions(of.kinds, of.mastery)}
        onChange={set}
      />
    );
  const addItem = (from: Element | null) => {
    set([...items, blankOf(of)]);
    focusNewItem(from, ":scope > .studio-row");
  };
  // Nothing in the list yet: a button, like the other parts that are not there until asked for.
  if (items.length === 0)
    return (
      <div class="studio-field">
        <button type="button" onClick={() => set([blankOf(of)])}>
          {ui("studio.addNamed", { name: label })}
        </button>
      </div>
    );
  const boxes = of.type === "object";
  return (
    <fieldset class="studio-many" onKeyDown={(e) => enterAdds(e, () => addItem(e.currentTarget))}>
      <legend>
        {label}
        <HelpMark />
      </legend>
      {items.map((item, i) => (
        <div
          class={`studio-row${items.length > 1 ? " has-handle" : ""}${boxes ? " is-box" : ""}`}
          // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own
          key={i}
          {...reorder.item(i)}
        >
          {reorder.handle(i)}
          <FieldControl
            label={`${i + 1}`}
            type={of}
            value={item}
            optional={false}
            onChange={(next) => set(items.map((x, j) => (j === i ? next : x)))}
            onRemove={boxes ? () => set(items.filter((_, j) => j !== i)) : undefined}
          />
          {!boxes && (
            <button
              type="button"
              class="danger"
              onClick={() => set(items.filter((_, j) => j !== i))}
            >
              {ui("form.remove")}
            </button>
          )}
        </div>
      ))}
      <button type="button" onClick={(e) => addItem(e.currentTarget.closest("fieldset"))}>
        {ui("studio.addRow")}
      </button>
    </fieldset>
  );
}

/**
 * Puts the cursor on the first field of the last item of a group, once it has been drawn: after
 * "add a row" the person types at once, without reaching for the mouse.
 */
export function focusNewItem(group: Element | null | undefined, item: string): void {
  setTimeout(() => {
    const items = group?.querySelectorAll(item);
    const last = items?.[items.length - 1];
    last
      ?.querySelector<HTMLElement>(
        "input:not([type=checkbox]):not([type=hidden]):not([type=search]), textarea, select, .studio-select-button",
      )
      ?.focus();
  }, 60);
}

/** Enter in the last row of a list adds the next one, as in any list of a form. */
function enterAdds(e: KeyboardEvent, add: () => void) {
  const target = e.target as HTMLElement;
  if (e.key !== "Enter" || target.tagName !== "INPUT") return;
  const row = target.closest(".studio-row");
  const rows = (e.currentTarget as HTMLElement).querySelectorAll(":scope > .studio-row");
  if (!row || rows[rows.length - 1] !== row) return;
  e.preventDefault();
  add();
}

/** A fresh value for a row of a list: empty, of the right shape. */
function blankOf(type: FieldType): unknown {
  switch (type.type) {
    case "union": {
      const branches = branchesOf(type);
      return branches?.[0] ? blankBranch(branches[0]) : "";
    }
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
  onRemove,
}: {
  label: string;
  fields: FieldSpec[];
  value: unknown;
  onChange: (value: unknown) => void;
  optional: boolean;
  onRemove?: (() => void) | undefined;
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
  const shown = fields;
  const flags = shown.filter((f) => f.type.type === "boolean");
  const short = shown.filter(
    (f) => !flags.includes(f) && (isShort(f.type) || f.type.type === "number"),
  );
  const long = shown.filter((f) => !short.includes(f) && !flags.includes(f));
  return (
    <fieldset class="studio-many">
      <legend>
        {label}
        <HelpMark />
      </legend>
      {(optional || onRemove) && (
        <button
          type="button"
          class="danger studio-drop"
          onClick={() => (onRemove ? onRemove() : onChange(undefined))}
        >
          {ui("form.remove")}
        </button>
      )}
      <div class="studio-grid">
        {short.map((f) => (
          <FieldControl
            key={f.key}
            label={fieldLabel(f.key)}
            help={fieldHelp(f.key)}
            type={f.type}
            value={here[f.key]}
            optional={f.optional}
            onChange={(next) => set(f.key, next)}
          />
        ))}
      </div>
      {flags.length > 0 && (
        <div class="studio-checks">
          {flags.map((f) => (
            <FieldControl
              key={f.key}
              label={fieldLabel(f.key)}
              help={fieldHelp(f.key)}
              type={f.type}
              value={here[f.key]}
              optional={f.optional}
              onChange={(next) => set(f.key, next)}
            />
          ))}
        </div>
      )}
      {long.map((f) => (
        <FieldControl
          key={f.key}
          label={fieldLabel(f.key)}
          help={fieldHelp(f.key)}
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
  // A table by level is read from the lowest level up, and its keys are a level each.
  const keys = type.levels
    ? Object.keys(record).sort((a, b) => Number(a) - Number(b))
    : Object.keys(record);
  const levelKeys = type.levels
    ? Array.from({ length: type.levels === "slot" ? 9 : 20 }, (_, i) => String(i + 1))
    : type.keys;
  const keyName = (k: string) =>
    type.levels && /^\d+$/.test(k) ? `${ui("hb.f.level")} ${k}` : optionLabel(k);
  const set = (next: Record<string, unknown>) =>
    onChange(Object.keys(next).length === 0 ? undefined : next);
  const rename = (from: string, to: string) => {
    if (!to || (to !== from && to in record)) return;
    set(Object.fromEntries(Object.entries(record).map(([k, v]) => [k === from ? to : k, v])));
  };
  const addRow = (from: Element | null) => {
    const free = levelKeys?.find((k) => !(k in record));
    if (levelKeys && free === undefined) return;
    let name = free ?? "new";
    for (let n = 2; name in record; n++) name = `new${n}`;
    set({ ...record, [name]: blankOf(type.of) });
    focusNewItem(from, ":scope > .studio-row");
  };
  // Nothing in it yet: a button that opens it with its first row.
  if (keys.length === 0)
    return (
      <div class="studio-field">
        <button type="button" onClick={() => addRow(null)}>
          {ui("studio.addNamed", { name: label })}
        </button>
      </div>
    );
  return (
    <fieldset class="studio-many" onKeyDown={(e) => enterAdds(e, () => addRow(e.currentTarget))}>
      <legend>
        {label}
        <HelpMark />
      </legend>
      {type.levels && (
        <small class="muted">
          {ui(type.levels === "slot" ? "studio.levelsHint.slot" : "studio.levelsHint.character")}
        </small>
      )}
      {keys.map((key) => (
        <div class="studio-row" key={key}>
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is inside, in one of two forms */}
          <label class="field studio-field">
            <span>{ui(type.levels ? "hb.f.level" : "studio.key")}</span>
            {levelKeys ? (
              <select value={key} onChange={(e) => rename(key, e.currentTarget.value)}>
                {(levelKeys.includes(key) ? levelKeys : [...levelKeys, key])
                  .filter((k) => k === key || !(k in record))
                  .map((k) => (
                    <option key={k} value={k}>
                      {keyName(k)}
                    </option>
                  ))}
              </select>
            ) : (
              <input
                type="text"
                value={key}
                onChange={(e) => rename(key, e.currentTarget.value.trim())}
              />
            )}
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
      <button type="button" onClick={(e) => addRow(e.currentTarget.closest("fieldset"))}>
        {ui("studio.addRow")}
      </button>
    </fieldset>
  );
}

type ObjectType = Extract<FieldType, { type: "object" }>;

/** The branches of a union of objects, when that is all it is. */
function branchesOf(type: FieldType): ObjectType[] | undefined {
  if (type.type !== "union") return undefined;
  const all = type.of.filter((t): t is ObjectType => t.type === "object");
  return all.length === type.of.length ? all : undefined;
}

/** What names a branch: the word its `type` field is fixed to, or else its first field. */
function branchId(branch: ObjectType): string {
  const fixed = branch.fields.find((f) => f.type.type === "literal");
  return fixed && fixed.type.type === "literal"
    ? String(fixed.type.value)
    : (branch.fields[0]?.key ?? "");
}

/** The branch a value is: the one whose fixed word it carries, else the one that has its fields. */
function branchOfValue(branches: ObjectType[], value: unknown): ObjectType {
  const object = isObject(value) ? value : {};
  const found = branches.find((b) => {
    const fixed = b.fields.find((f) => f.type.type === "literal");
    if (fixed && fixed.type.type === "literal") return object[fixed.key] === fixed.type.value;
    return (
      Object.keys(object).length > 0 &&
      Object.keys(object).every((k) => b.fields.some((f) => f.key === k))
    );
  });
  return found ?? (branches[0] as ObjectType);
}

/** A fresh value of a branch: its fixed words, and an empty or zero value for the rest. */
function blankBranch(branch: ObjectType): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of branch.fields) {
    if (f.type.type === "literal") out[f.key] = f.type.value;
    else if (!f.optional) out[f.key] = blankOf(f.type);
  }
  return out;
}

/** One thing of several kinds (a requirement: a level, a feature, a spell, a score): the kind, then what that kind asks. */
function UnionControl({
  branches,
  value,
  onChange,
}: {
  branches: ObjectType[];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const object = isObject(value) ? value : {};
  const now = branchOfValue(branches, value);
  const id = branchId(now);
  return (
    <div class="studio-union">
      <SelectBox
        label={ui("studio.need.kind")}
        value={id}
        options={branches.map((b) => ({ id: branchId(b), label: unionLabel(branchId(b)) }))}
        onChange={(v) => {
          const next = branches.find((b) => branchId(b) === v);
          if (next && next !== now) onChange(blankBranch(next));
        }}
      />
      {now.fields
        .filter((f) => f.type.type !== "literal")
        .map((f) => (
          <FieldControl
            key={f.key}
            label={fieldLabel(f.key)}
            type={f.type}
            value={object[f.key]}
            optional={f.optional}
            onChange={(v) => {
              const { [f.key]: _old, ...others } = object;
              onChange(v === undefined ? others : { ...others, [f.key]: v });
            }}
          />
        ))}
    </div>
  );
}

const unionLabel = (id: string) => {
  const key = `studio.need.${id}`;
  return key in en ? ui(key as UiKey) : humanize(id);
};
