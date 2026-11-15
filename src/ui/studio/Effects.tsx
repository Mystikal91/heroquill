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
import { ChipPicker, FieldControl } from "./Controls";
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

/** One line that says what an effect does, for its card to show while it is closed. */
export function summarize(effect: Effect): string {
  const { type: _type, ...rest } = effect as Effect & Record<string, unknown>;
  if (effect.type === "when") return `${effect.requires} (${effect.effects.length})`;
  return Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
    .map(([k, v]) => `${effectFieldLabel(k)}: ${show(v)}`.trim())
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
  const fields = effectFields(type);
  const optional = fields.filter((f) => f.optional);
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
    return (
      <FieldControl
        key={spec.key}
        label={effectFieldLabel(spec.key)}
        type={spec.type}
        value={values[spec.key]}
        optional={spec.optional}
        onChange={(next) => {
          const copy = { ...values };
          if (next === undefined) delete copy[spec.key];
          else copy[spec.key] = next;
          onChange(copy as unknown as Effect);
        }}
      />
    );
  };
  return (
    <details class="studio-effect" open>
      <summary>
        <b>{effectName(type)}</b>
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
      <div class="studio-grid">{fields.filter((f) => !f.optional).map(control)}</div>
      {optional.length > 0 && (
        <details
          class="studio-more"
          open={advanced || optional.some((f) => values[f.key] !== undefined)}
        >
          <summary>{ui("studio.moreOptions")}</summary>
          <div class="studio-grid">{optional.map(control)}</div>
        </details>
      )}
      {advanced && <small class="muted">{EFFECT_META[type].doc}</small>}
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
    (t) => !hidden.includes(t) && (advanced || EFFECT_META[t].level === "guided"),
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
          const type = e.currentTarget.value as EffectType;
          if (type) onChange([...effects, blankEffect(type)]);
        }}
      >
        <option value="">{ui("studio.addEffect")}</option>
        {GROUPS.map((group) => {
          const inGroup = choices.filter((t) => EFFECT_META[t].group === group);
          return inGroup.length === 0 ? null : (
            <optgroup key={group} label={ui(`fx.group.${group}` as UiKey)}>
              {inGroup.map((t) => (
                <option key={t} value={t}>
                  {effectName(t)}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}
