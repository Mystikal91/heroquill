import en from "../../../locales/en/ui.json";
import { content } from "../../app/store";
import { studioMode } from "../../app/studio";
import { ABILITIES, type Effect } from "../../data/schema";
import { blankEffect } from "../../homebrew/blanks";
import {
  EFFECT_META,
  EFFECT_TYPES,
  type EffectGroup,
  type EffectType,
  effectFields,
} from "../../homebrew/catalog";
import { type UiKey, ui } from "../../i18n/ui";
import { entriesOfKind } from "../build/fields";
import { ChipPicker, FieldControl, type Option, SelectBox, withCurrent } from "./Controls";
import { RequirementBuilder, describeRequirement } from "./Requirement";
import { TermControl, isPlainTerm, termText } from "./Term";
import { effectFieldLabel, humanize, optionLabel } from "./labels";

const GROUPS: EffectGroup[] = [
  "scores",
  "proficiency",
  "body",
  "combat",
  "magic",
  "resources",
  "structure",
];

/** The name of an effect type: the text the editor has for it, or the type made readable. */
export function effectName(type: string): string {
  const key = `fx.${type}`;
  return key in en ? ui(key as UiKey) : humanize(type);
}

/** A value of an effect in words: an id by its name, an ability by its name, a number as it is. */
function show(value: unknown): string {
  if (typeof value === "string") {
    if (/^[a-z0-9]+:[a-z]+\/[a-z0-9-]+$/.test(value)) return content.value?.name(value) ?? value;
    // A proficiency as the rules write it (`skill:acrobatics`, `weapon:simple-weapons`): by its name.
    const proficiency = /^(skill|save|weapon|armor|tool):([a-z0-9-]+)$/.exec(value);
    if (proficiency) {
      const [, category = "", target = ""] = proficiency;
      const id =
        category === "skill"
          ? `srd51:skill/${target}`
          : category === "save"
            ? `srd51:ability/${target}`
            : `srd51:proficiency/${target}`;
      const named = content.value?.index.has(id) ? content.value.name(id) : undefined;
      return named ?? optionLabel(target);
    }
    return optionLabel(value);
  }
  if (Array.isArray(value)) return value.map(show).join(", ");
  if (value && typeof value === "object") return "";
  return String(value);
}

/** A line that says what an effect is for: in words for the common ones, the developer's line in the advanced mode. */
function helpFor(type: EffectType, advanced: boolean): string {
  const key = `fxhelp.${type}`;
  if (key in en) return ui(key as UiKey);
  return advanced ? EFFECT_META[type].doc : "";
}

/** One line that says what an effect does, for its card to show while it is closed. */
export function summarize(effect: Effect): string {
  const { type: _type, ...rest } = effect as Effect & Record<string, unknown>;
  if (effect.type === "when")
    return `${describeRequirement(effect.requires)} (${effect.effects.length})`;
  return Object.entries(rest)
    .filter(
      ([k, v]) =>
        k !== "pool" && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    )
    .map(([k, v]) => {
      // What a proficiency is in, by its name in the language.
      const named =
        effect.type === "proficiency" && k === "target"
          ? proficiencyTargets(effect.category)?.find((o) => o.id === v)?.label
          : undefined;
      return `${effectFieldLabel(k)}: ${named ?? (k === "term" ? termText(v) : show(v))}`.trim();
    })
    .filter((line) => !line.endsWith(":"))
    .join(" · ");
}

/**
 * What a pick of a `choice` can be, by what it grants: the skills, the languages, the spells... as
 * the entries of the content, so that "choose two skills" is ticking skills and not writing words.
 * Undefined for what has no short list (a feat, a size): those keep the generic list.
 */
function choiceOptions(grants: string): { id: string; label: string }[] | undefined {
  const c = content.value;
  if (!c) return undefined;
  const slug = (id: string) => id.split("/")[1] ?? id;
  switch (grants) {
    case "proficiency":
    case "expertise": {
      const skills = entriesOfKind("skill").map((e) => ({
        id: `skill:${slug(e.id)}`,
        label: e.label,
      }));
      if (grants === "expertise") return skills;
      const others = entriesOfKind("proficiency").flatMap((e) => {
        const data = c.index.get(e.id)?.data as { category?: string; target?: string } | undefined;
        return data?.category && data.target && data.category !== "skill"
          ? [{ id: `${data.category}:${data.target}`, label: e.label }]
          : [];
      });
      return [...skills, ...others];
    }
    case "language":
      return entriesOfKind("language").map((e) => ({ id: slug(e.id), label: e.label }));
    case "spell":
      return entriesOfKind("spell");
    case "trait":
      return entriesOfKind("trait");
    case "abilityBonus":
      return ABILITIES.map((id) => ({ id, label: optionLabel(id) }));
    default:
      return undefined;
  }
}

/** The proficiencies that stand for a whole group, in the order they are listed. */
const PROFICIENCY_GROUPS: Record<string, string[]> = {
  armor: ["all-armor", "light-armor", "medium-armor", "heavy-armor", "shields"],
  weapon: ["simple-weapons", "martial-weapons"],
};

/** What a proficiency of a category can be in, by name: the skills, the abilities, the languages, the kinds of weapon... */
function proficiencyTargets(category: string): Option[] | undefined {
  const c = content.value;
  if (!c) return undefined;
  const slug = (id: string) => id.split("/")[1] ?? id;
  switch (category) {
    case "skill":
      return entriesOfKind("skill").map((e) => ({ id: slug(e.id), label: e.label }));
    case "save":
      return ABILITIES.map((id) => ({ id, label: optionLabel(id) }));
    case "language":
      return entriesOfKind("language").map((e) => ({ id: slug(e.id), label: e.label }));
    case "weapon":
    case "armor":
    case "tool": {
      const all = entriesOfKind("proficiency").flatMap((e) => {
        const data = c.index.get(e.id)?.data as { category?: string; target?: string } | undefined;
        return data?.category === category && data.target
          ? [{ id: data.target, label: e.label }]
          : [];
      });
      // Weapons and armor come in groups (light armor, simple weapons) and one by one: the groups first, apart.
      if (category === "tool") return all;
      const groups = PROFICIENCY_GROUPS[category] ?? [];
      return [
        ...groups.flatMap((id) => {
          const o = all.find((x) => x.id === id);
          return o ? [{ ...o, group: ui("studio.profGroups") }] : [];
        }),
        ...all
          .filter((o) => !groups.includes(o.id))
          .map((o) => ({ ...o, group: ui("studio.profSingles") })),
      ];
    }
    default:
      return undefined;
  }
}

/** Effects the schema has but the sheet never reads: not offered, so no one writes one that does nothing. */
const UNUSED = new Set<string>(["resource"]);

function EffectCard({
  effect,
  onChange,
  onRemove,
}: {
  effect: Effect;
  onChange: (next: Effect) => void;
  onRemove: () => void;
}) {
  const type = effect.type as EffectType;
  const values = effect as unknown as Record<string, unknown>;
  const advanced = studioMode.value === "advanced";
  const points = effect.type === "uses" && effect.pool === true;
  const fields = effectFields(type).filter((f) => !(type === "uses" && f.key === "pool"));
  const optional = fields.filter((f) => f.optional);
  const Flags = ({ specs }: { specs: typeof fields }) =>
    specs.length === 0 ? null : <div class="studio-checks">{specs.map(control)}</div>;
  const control = (spec: (typeof fields)[number]) => {
    const options =
      type === "choice" && spec.key === "from" ? choiceOptions(String(values.grants)) : undefined;
    if (options)
      return (
        <ChipPicker
          key={spec.key}
          label={effectFieldLabel(spec.key)}
          value={Array.isArray(values.from) ? (values.from as string[]) : []}
          options={options}
          onChange={(next) => onChange({ ...values, from: next } as unknown as Effect)}
        />
      );
    // The requirement of "only when": sentences with names, not the words the engine reads.
    if (type === "when" && spec.key === "requires")
      return (
        <RequirementBuilder
          key={spec.key}
          value={String(values.requires ?? "")}
          raw={advanced}
          onChange={(text) => onChange({ ...values, requires: text } as unknown as Effect)}
        />
      );
    // How many: a number, or something of the character, in words.
    if (spec.key === "term" && isPlainTerm(values.term))
      return (
        <TermControl
          key={spec.key}
          label={effectFieldLabel(spec.key)}
          value={values.term}
          onChange={(next) => onChange({ ...values, term: next } as unknown as Effect)}
        />
      );
    // What a proficiency is in: a menu of the names of its category, not a word to write.
    if (type === "proficiency" && spec.key === "target") {
      const list = proficiencyTargets(String(values.category ?? ""));
      if (list)
        return (
          <SelectBox
            key={spec.key}
            label={effectFieldLabel(spec.key)}
            value={typeof values.target === "string" && values.target ? values.target : undefined}
            options={withCurrent(list, values.target)}
            blank={ui("form.none")}
            onChange={(next) => onChange({ ...values, target: next ?? "" } as unknown as Effect)}
          />
        );
    }
    // What a bonus to speed adds is a distance; the other bonuses are plain numbers.
    const fieldType =
      effect.type === "modifier" &&
      spec.key === "value" &&
      values.target === "speed" &&
      spec.type.type === "number"
        ? { ...spec.type, unit: "distance" as const }
        : spec.type;
    return (
      <FieldControl
        key={spec.key}
        label={effectFieldLabel(spec.key)}
        type={fieldType}
        value={values[spec.key]}
        optional={spec.optional}
        onChange={(next) => {
          const copy = { ...values };
          if (next === undefined) delete copy[spec.key];
          else copy[spec.key] = next;
          // A new category has other things to be proficient in: the old one no longer fits.
          if (type === "proficiency" && spec.key === "category") copy.target = "";
          onChange(copy as unknown as Effect);
        }}
      />
    );
  };
  return (
    <details class="studio-effect" open>
      <summary>
        <b>{points ? ui("fx.points") : effectName(type)}</b>
        <span class="muted">{summarize(effect)}</span>
        <button
          type="button"
          class="danger"
          onClick={(e) => {
            e.preventDefault();
            onRemove();
          }}
        >
          {ui("form.remove")}
        </button>
      </summary>
      <div class={type === "when" ? "studio-grid studio-grid-one" : "studio-grid"}>
        {fields.filter((f) => !f.optional && f.type.type !== "boolean").map(control)}
      </div>
      <Flags specs={fields.filter((f) => !f.optional && f.type.type === "boolean")} />
      {optional.length > 0 && (
        <details
          class="studio-more"
          open={advanced || optional.some((f) => values[f.key] !== undefined)}
        >
          <summary>{ui("studio.moreOptions")}</summary>
          <div class="studio-grid">
            {optional.filter((f) => f.type.type !== "boolean").map(control)}
          </div>
          <Flags specs={optional.filter((f) => f.type.type === "boolean")} />
        </details>
      )}
      <small class="muted">{points ? ui("fxhelp.points") : helpFor(type, advanced)}</small>
    </details>
  );
}

/** The effects of an entry: a card for each, and a menu to add another. */
export function EffectList({
  effects,
  onChange,
  hidden = [],
}: {
  effects: Effect[];
  onChange: (effects: Effect[]) => void;
  /** Types of effect another part of the form manages: not listed, not offered, but kept. */
  hidden?: string[];
}) {
  const advanced = studioMode.value === "advanced";
  const choices = EFFECT_TYPES.filter(
    (t) => !hidden.includes(t) && !UNUSED.has(t) && (advanced || EFFECT_META[t].level === "guided"),
  );
  const shown = effects
    .map((effect, i) => ({ effect, i }))
    .filter(({ effect }) => !hidden.includes(effect.type));
  return (
    <div class="studio-effects">
      {shown.length === 0 && <p class="muted">{ui("studio.noEffects")}</p>}
      {shown.map(({ effect, i }) => (
        <EffectCard
          key={i}
          effect={effect}
          onChange={(next) => onChange(effects.map((e, j) => (j === i ? next : e)))}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))}
        />
      ))}
      <select
        class="studio-add-effect"
        value=""
        aria-label={ui("studio.addEffect")}
        onChange={(e) => {
          const picked = e.currentTarget.value;
          // Points to spend are the uses of a feature counted as a number (the ki of a monk).
          if (picked === "points")
            onChange([...effects, { ...blankEffect("uses"), pool: true } as Effect]);
          else if (picked) onChange([...effects, blankEffect(picked as EffectType)]);
        }}
      >
        <option value="">{ui("studio.addEffect")}</option>
        {GROUPS.map((group) => {
          const inGroup = choices.filter((t) => EFFECT_META[t].group === group);
          return inGroup.length === 0 ? null : (
            <optgroup key={group} label={ui(`fx.group.${group}` as UiKey)}>
              {inGroup.flatMap((t) => [
                <option key={t} value={t}>
                  {effectName(t)}
                </option>,
                ...(t === "uses"
                  ? [
                      <option key="points" value="points">
                        {ui("fx.points")}
                      </option>,
                    ]
                  : []),
              ])}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
