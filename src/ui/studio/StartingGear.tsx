import type { ComponentChildren } from "preact";
import { STARTING_CATEGORIES } from "../../data/startingEquipment";
import { ui } from "../../i18n/ui";
import { entriesOfKind } from "../build/fields";
import { NumberBox, SelectBox, withCurrent } from "./Controls";
import { proficiencyTargets } from "./Effects";
import { optionLabel } from "./labels";

type Part = Record<string, unknown>;
type PartKind = "item" | "category" | "gold";
interface Option {
  items: Part[];
  requires?: string;
}
interface Choice {
  options: Option[];
}

const kindOf = (part: Part): PartKind =>
  "gold" in part ? "gold" : "category" in part ? "category" : "item";

const blankPart = (kind: PartKind): Part =>
  kind === "gold"
    ? { gold: 0 }
    : kind === "category"
      ? { category: STARTING_CATEGORIES[0], count: 1 }
      : { item: "", quantity: 1 };

/** A category of items by name; several joined by "+" read as "a / b". */
const categoryLabel = (id: string) =>
  id
    .split("+")
    .map((one) => optionLabel(one))
    .join(" / ");

const asParts = (value: unknown): Part[] => (Array.isArray(value) ? (value as Part[]) : []);
const asChoices = (value: unknown): Choice[] => (Array.isArray(value) ? (value as Choice[]) : []);

const replaceAt = <T,>(list: T[], at: number, next: T): T[] =>
  list.map((x, i) => (i === at ? next : x));
const removeAt = <T,>(list: T[], at: number): T[] => list.filter((_, i) => i !== at);

/** One thing a character starts with: an item and how many, any of a kind of items, or gold. */
function PartRow({
  part,
  kinds,
  onChange,
  onRemove,
}: {
  part: Part;
  kinds: PartKind[];
  onChange: (next: Part) => void;
  onRemove: () => void;
}) {
  const kind = kindOf(part);
  const num = (key: string) => (typeof part[key] === "number" ? (part[key] as number) : undefined);
  return (
    <div class="studio-gear-row">
      <SelectBox
        label={ui("studio.gear.type")}
        value={kind}
        options={kinds.map((k) => ({ id: k, label: ui(`studio.gear.${k}` as const) }))}
        onChange={(v) => v && v !== kind && onChange(blankPart(v as PartKind))}
      />
      {kind === "item" && (
        <>
          <SelectBox
            label={ui("studio.gear.itemField")}
            value={typeof part.item === "string" && part.item ? part.item : undefined}
            options={withCurrent(entriesOfKind("item"), part.item)}
            blank="—"
            onChange={(v) => onChange({ ...part, item: v ?? "" })}
          />
          <NumberBox
            label={ui("studio.gear.quantity")}
            min={1}
            value={num("quantity")}
            onChange={(v) => onChange({ ...part, quantity: v ?? 1 })}
          />
        </>
      )}
      {kind === "category" && (
        <>
          <SelectBox
            label={ui("studio.gear.categoryField")}
            value={typeof part.category === "string" ? part.category : undefined}
            options={withCurrent(
              STARTING_CATEGORIES.map((id) => ({ id, label: categoryLabel(id) })),
              part.category,
            )}
            onChange={(v) => onChange({ ...part, category: v ?? STARTING_CATEGORIES[0] })}
          />
          <NumberBox
            label={ui("studio.gear.count")}
            min={1}
            value={num("count")}
            onChange={(v) => onChange({ ...part, count: v ?? 1 })}
          />
        </>
      )}
      {kind === "gold" && (
        <>
          <NumberBox
            label={ui("studio.gear.gold")}
            min={0}
            value={num("gold")}
            onChange={(v) => onChange({ gold: v ?? 0 })}
          />
          <span />
        </>
      )}
      <button type="button" class="danger" onClick={onRemove}>
        {ui("form.remove")}
      </button>
    </div>
  );
}

/** A list of things a character starts with, with a button to add one. */
function PartList({
  parts,
  kinds,
  onChange,
}: {
  parts: Part[];
  kinds: PartKind[];
  onChange: (next: Part[]) => void;
}) {
  return (
    <div class="studio-gear-list">
      {parts.map((part, i) => (
        <PartRow
          // biome-ignore lint/suspicious/noArrayIndexKey: the rows have no identity but their place
          key={i}
          part={part}
          kinds={kinds}
          onChange={(next) => onChange(replaceAt(parts, i, next))}
          onRemove={() => onChange(removeAt(parts, i))}
        />
      ))}
      <div class="studio-field">
        <button type="button" onClick={() => onChange([...parts, blankPart("item")])}>
          {ui("studio.gear.addItem")}
        </button>
      </div>
    </div>
  );
}

/** What an option can ask the character to be proficient with: a weapon or an armor, by its name. */
const proficiencyChoices = () => [
  ...(proficiencyTargets("weapon") ?? []).map((o) => ({ ...o, group: ui("hb.kind.weapon") })),
  ...(proficiencyTargets("armor") ?? []).map((o) => ({ ...o, group: ui("hb.kind.armor") })),
];

const letter = (i: number) => String.fromCharCode(65 + i);

/**
 * The starting equipment of a class or a background, as the rules give it: what the character always
 * has, and the choices (take this or that), each option with its items and how many of each.
 */
export function StartingGear({
  fixed,
  choices,
  onFixed,
  onChoices,
}: {
  fixed: unknown;
  choices: unknown;
  onFixed: (next: Part[] | undefined) => void;
  onChoices: (next: Choice[] | undefined) => void;
}) {
  const always = asParts(fixed);
  const picks = asChoices(choices);
  const setChoices = (next: Choice[]) => onChoices(next.length ? next : undefined);
  const setChoice = (i: number, next: Choice) => setChoices(replaceAt(picks, i, next));
  const group = (title: string, hint: string, body: ComponentChildren) => (
    <section class="studio-gear">
      <h4>{title}</h4>
      <p class="muted">{hint}</p>
      {body}
    </section>
  );
  return (
    <>
      {group(
        ui("studio.gear.fixed"),
        ui("studio.gear.fixedHint"),
        <PartList
          parts={always}
          kinds={["item", "gold"]}
          onChange={(next) => onFixed(next.length ? next : undefined)}
        />,
      )}
      {group(
        ui("studio.gear.choices"),
        ui("studio.gear.choicesHint"),
        <>
          {picks.map((choice, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the choices have no identity but their place
            <details class="studio-effect" key={i} open>
              <summary>
                <b>{ui("studio.gear.choice", { n: String(i + 1) })}</b>
                <button
                  type="button"
                  class="danger"
                  onClick={(e) => {
                    e.preventDefault();
                    setChoices(removeAt(picks, i));
                  }}
                >
                  {ui("form.remove")}
                </button>
              </summary>
              {(choice.options ?? []).map((option, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the options have no identity but their place
                <fieldset class="studio-gear-option" key={j}>
                  <legend>{ui("studio.gear.option", { name: letter(j) })}</legend>
                  <PartList
                    parts={asParts(option.items)}
                    kinds={["item", "category", "gold"]}
                    onChange={(items) =>
                      setChoice(i, {
                        ...choice,
                        options: replaceAt(choice.options, j, { ...option, items }),
                      })
                    }
                  />
                  <SelectBox
                    label={ui("studio.gear.requires")}
                    value={option.requires || undefined}
                    options={withCurrent(proficiencyChoices(), option.requires)}
                    blank="—"
                    onChange={(v) => {
                      const { requires: _old, ...others } = option;
                      const next = v ? { ...others, requires: v } : others;
                      setChoice(i, { ...choice, options: replaceAt(choice.options, j, next) });
                    }}
                  />
                  {choice.options.length > 1 && (
                    <button
                      type="button"
                      class="danger"
                      onClick={() =>
                        setChoice(i, { ...choice, options: removeAt(choice.options, j) })
                      }
                    >
                      {ui("form.remove")}
                    </button>
                  )}
                </fieldset>
              ))}
              <div class="studio-field">
                <button
                  type="button"
                  onClick={() =>
                    setChoice(i, {
                      ...choice,
                      options: [...(choice.options ?? []), { items: [blankPart("item")] }],
                    })
                  }
                >
                  {ui("studio.gear.addOption")}
                </button>
              </div>
            </details>
          ))}
          <div class="studio-field">
            <button
              type="button"
              onClick={() =>
                setChoices([
                  ...picks,
                  { options: [{ items: [blankPart("item")] }, { items: [blankPart("item")] }] },
                ])
              }
            >
              {ui("studio.gear.addChoice")}
            </button>
          </div>
        </>,
      )}
    </>
  );
}
