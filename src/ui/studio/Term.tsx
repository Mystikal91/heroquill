import { ABILITIES, type Ability } from "../../data/schema";
import { ui } from "../../i18n/ui";
import { NumberBox, SelectBox } from "./Controls";
import { optionLabel } from "./labels";

type Mode = "number" | "proficiency" | "level" | "mod" | "score";

const isAbility = (v: unknown): v is Ability =>
  typeof v === "string" && (ABILITIES as readonly string[]).includes(v);

/** How a number of a feature is made, when it is one of the plain ways: a fixed number, or something of the character. */
function modeOf(value: unknown): Mode | undefined {
  if (typeof value === "number") return "number";
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (v.of === "proficiency" || v.of === "level") return v.of;
    if (isAbility(v.mod)) return "mod";
    if (isAbility(v.score)) return "score";
  }
  return undefined;
}

/** Whether the editor has words for this number; the rest (a text, a level in one class) keeps the generic box. */
export const isPlainTerm = (value: unknown): boolean => modeOf(value) !== undefined;

/**
 * A number of a feature written in words: "a fixed number", "your proficiency bonus", "your
 * level", "the modifier of an ability". The engine's own form (`{ mod: "cha" }`) is what is saved.
 */
export function TermControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const mode = modeOf(value) ?? "number";
  const ability = isAbility((value as Record<string, unknown> | undefined)?.mod)
    ? ((value as { mod: Ability }).mod as string)
    : isAbility((value as Record<string, unknown> | undefined)?.score)
      ? ((value as { score: Ability }).score as string)
      : "cha";
  const choose = (next: Mode, of = ability) => {
    if (next === "number") onChange(1);
    else if (next === "proficiency" || next === "level") onChange({ of: next });
    else onChange({ [next]: of });
  };
  const modes: { id: Mode; label: string }[] = [
    { id: "number", label: ui("term.number") },
    { id: "proficiency", label: ui("term.proficiency") },
    { id: "level", label: ui("term.level") },
    { id: "mod", label: ui("term.mod") },
    { id: "score", label: ui("term.score") },
  ];
  return (
    <>
      <SelectBox
        label={label}
        value={mode}
        options={modes}
        onChange={(next) => choose((next ?? "number") as Mode)}
      />
      {mode === "number" && (
        <NumberBox
          label={ui("studio.value")}
          value={typeof value === "number" ? value : 1}
          min={0}
          onChange={(n) => onChange(n ?? 0)}
        />
      )}
      {(mode === "mod" || mode === "score") && (
        <SelectBox
          label={ui("fx.f.ability")}
          value={ability}
          options={ABILITIES.map((id) => ({ id, label: optionLabel(id) }))}
          onChange={(next) => choose(mode, next ?? "cha")}
        />
      )}
    </>
  );
}

/** A number of a feature in a few words, for the summary of its card. */
export function termText(value: unknown): string {
  if (typeof value === "number") return String(value);
  const mode = modeOf(value);
  if (mode === "proficiency" || mode === "level") return ui(`term.${mode}`);
  if (mode === "mod" || mode === "score") {
    const ability = (value as Record<string, string>)[mode] ?? "";
    return `${ui(`term.${mode}`)}: ${optionLabel(ability)}`;
  }
  return "";
}
