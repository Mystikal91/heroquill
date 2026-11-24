import { character, content, shownSheet } from "../app/store";
import type { Content } from "../content/browser";
import { ui } from "../i18n/ui";
import { EditPencil } from "./QuickEdit";
import { BookIcon } from "./icons";
import { Panel, Paragraphs } from "./sheet/parts";
import { type SpellRow, collectSpellRows } from "./spellRows";

function SpellDetails({ c, ruleset, row }: { c: Content; ruleset: string; row: SpellRow }) {
  const data = c.index.get(row.id)?.data ?? {};
  const school = c.name(`${ruleset}:school/${data.school}`);
  const components = (data.components as string[] | undefined)?.join(", ");
  const material = c.text(row.id, "material");
  const meta: [string, string | undefined][] = [
    [ui("spells.castingTime"), c.text(row.id, "castingTime")],
    [ui("spells.range"), c.text(row.id, "range")],
    [ui("spells.components"), components && material ? `${components} (${material})` : components],
    [ui("spells.duration"), c.text(row.id, "duration")],
  ];
  const tags = [
    data.concentration ? ui("spells.concentration") : undefined,
    data.ritual ? ui("spells.ritual") : undefined,
    row.alwaysPrepared ? ui("spells.alwaysPrepared") : undefined,
    row.atWill ? ui("spells.atWill") : undefined,
  ].filter(Boolean);

  return (
    <details>
      <summary>
        {c.name(row.id)}
        <EditPencil id={row.id} />
        <span class="muted">
          {" · "}
          {row.level === 0
            ? ui("spells.cantripSchool", { school })
            : ui("spells.levelSchool", { level: row.level, school })}
          {tags.length > 0 && ` · ${tags.join(" · ")}`}
        </span>
      </summary>
      <dl class="pairs spell-meta">
        {meta.map(([label, value]) =>
          value ? (
            <div class="pair" key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ) : null,
        )}
      </dl>
      <Paragraphs text={c.text(row.id, "desc")} />
      {c.text(row.id, "higherLevel") && (
        <p>
          <strong>{ui("spells.higherLevel")}.</strong> {c.text(row.id, "higherLevel")}
        </p>
      )}
    </details>
  );
}

/** Every spell the character has: picked cantrips, known or prepared spells, and granted ones. */
export function SpellSheet() {
  const c = content.value;
  const s = shownSheet.value;
  if (!c || !s) return null;
  const ruleset = character.value.ruleset;
  const rows = collectSpellRows(c, s);

  if (rows.length === 0) return null;
  const levels = [...new Set(rows.map((r) => r.level))];

  return (
    <Panel title={ui("sheet.spellList")} tint="magic" icon={BookIcon} className="spell-sheet">
      {levels.map((level) => (
        <div key={level}>
          <h4>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</h4>
          {rows
            .filter((r) => r.level === level)
            .map((row) => (
              <SpellDetails key={row.id} c={c} ruleset={ruleset} row={row} />
            ))}
        </div>
      ))}
    </Panel>
  );
}
