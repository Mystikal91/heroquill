import { sheet } from "../../app/store";
import { ui } from "../../i18n/ui";
import { damageTitle } from "../damageName";
import { reductionLabel } from "../damageReduction";

/** What the character does to damage, as lines of a name and what it covers: nothing is counted for the person. */
export function damageEffectRows(): [name: string, text: string][] {
  const s = sheet.value;
  if (!s) return [];
  const rows: [string, string][] = [];
  if (s.damageReductions.length > 0)
    rows.push([ui("sheet.damageReduction"), s.damageReductions.map(reductionLabel).join("; ")]);
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

/** The lines of `damageEffectRows` as a list of pairs. */
export function DamageEffectsList({ rows }: { rows: [string, string][] }) {
  return (
    <dl class="damage-effects">
      {rows.map(([name, text]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{text}</dd>
        </div>
      ))}
    </dl>
  );
}
