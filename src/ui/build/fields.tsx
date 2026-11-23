import { character, content } from "../../app/store";
import { userPacks } from "../../app/userPacks";
import { inRuleset, isBackgroundOf2024, subclassOf } from "../../engine/rulesets";
import { ui } from "../../i18n/ui";

/** Entries of one kind from the active ruleset, sorted by their display name. */
export function entriesOfKind(kind: string, parent?: string) {
  const c = content.value;
  if (!c) return [];
  return (
    [...c.index.values()]
      // The active ruleset's entries, plus packs the user added (any id that is not another SRD's).
      .filter((e) => e.kind === kind && inRuleset(e.id, character.value.ruleset))
      // A background of the 2024 books gives the ability increases and takes those of a 2014 species away:
      // it is not offered to a 2014 character (one it already has stays, so the choice is not lost).
      .filter(
        (e) =>
          character.value.ruleset !== "srd51" ||
          !isBackgroundOf2024(e) ||
          e.id === character.value.choices.background,
      )
      .filter(
        (e) =>
          parent === undefined ||
          e.parent === parent ||
          (kind === "subclass" && subclassOf(e, parent)),
      )
      // A subclass written for the 2014 class and offered on the 2024 one says so.
      .map((e) => ({
        id: e.id,
        label:
          kind === "subclass" && parent !== undefined && e.parent !== parent
            ? `${c.name(e.id)} (2014)`
            : c.name(e.id),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((option, _, all) =>
        // The same name twice (a subspecies of two books, imported apart) says where each is from.
        all.filter((other) => other.label === option.label).length > 1
          ? { ...option, label: `${option.label} (${bookOf(option.id)})` }
          : option,
      )
  );
}

/** The book an imported entry comes from, or the pack that holds it. */
function bookOf(id: string): string {
  const record = userPacks.value.find((p) => p.id === id.split(":")[0]);
  return record?.books?.[id] ?? record?.name ?? id.split(":")[0] ?? id;
}

interface SelectProps {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label class="field">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.currentTarget as HTMLSelectElement).value || undefined)}
      >
        <option value="">{ui("form.none")}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function parseWhole(value: string, fallback: number) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
