import { sheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { damageTitle } from "../damageName";
import { reductionRow } from "../damageReduction";

/** What the character does to damage, as lines of a name and what it covers: nothing is counted for the person. */
export function damageEffectRows(): [name: string, text: string][] {
  const s = sheet.value;
  if (!s) return [];
  const rows: [string, string][] = [];
  for (const reduction of s.damageReductions) rows.push(reductionRow(reduction));
  const kinds = [
    ["vulnerability", "sheet.vulnerabilities"],
    ["immunity", "sheet.immunities"],
    ["resistance", "sheet.resistances"],
  ] as const;
  for (const [kind, label] of kinds)
    if (s.defenses[kind].length > 0)
      rows.push([ui(label), s.defenses[kind].map(damageTitle).join(", ")]);
  return rows;
}

/** The lines of `damageEffectRows`, in the rows the other numbers of the dialog and the sheet use. */
export function DamageEffectsList({ rows }: { rows: [string, string][] }) {
  return (
    <ul class="explain-lines damage-effects">
      {rows.map(([name, value], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of lines that is rebuilt as a whole
        <li key={i}>
          <span>{name}</span>
          <b>{value}</b>
        </li>
      ))}
    </ul>
  );
}
