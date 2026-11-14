import { printSettings } from "../../app/printSettings";
import { character, content, printSheet } from "../../app/store";
import type { Content } from "../../content/browser";
import type { DerivedSheet, SpellcastingResult } from "../../engine/derive";
import { signed, ui } from "../../i18n/ui";
import { type SpellRow, collectSpellRows } from "../spellRows";
import { spellFacts } from "../spells/spellFacts";

const levelTitle = (level: number) =>
  level === 0 ? ui("spells.cantrips") : ui("spells.level", { level });

function SpellBlock({ c, ruleset, row }: { c: Content; ruleset: string; row: SpellRow }) {
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
  const facts = spellFacts(data, (index) => c.name(`${ruleset}:ability/${index}`));
  const tags = [
    data.concentration ? ui("spells.concentration") : undefined,
    data.ritual ? ui("spells.ritual") : undefined,
    row.alwaysPrepared ? ui("spells.alwaysPrepared") : undefined,
  ].filter(Boolean);

  return (
    <article class="p-spell">
      <h3>{c.name(row.id)}</h3>
      <p class="p-muted">
        {row.level === 0
          ? ui("spells.cantripSchool", { school })
          : ui("spells.levelSchool", { level: row.level, school })}
        {tags.length > 0 && ` · ${tags.join(" · ")}`}
      </p>
      <p class="p-spell-meta">
        {meta
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <span key={label}>
              <strong>{label}:</strong> {value}{" "}
            </span>
          ))}
      </p>
      {facts.length > 0 && (
        <p class="p-spell-meta">
          {facts.map(([label, value]) => (
            <span key={label}>
              <strong>{label}:</strong> {value}{" "}
            </span>
          ))}
        </p>
      )}
      {c
        .text(row.id, "desc")
        ?.split("\n\n")
        .map((p) => (
          <p key={p}>{p}</p>
        ))}
      {c.text(row.id, "higherLevel") && (
        <p>
          <strong>{ui("spells.higherLevel")}.</strong> {c.text(row.id, "higherLevel")}
        </p>
      )}
    </article>
  );
}

function CompactTable({ c, ruleset, rows }: { c: Content; ruleset: string; rows: SpellRow[] }) {
  return (
    <table class="p-spell-table">
      <thead>
        <tr>
          <th>{ui("print.prepared")}</th>
          <th>{ui("print.name")}</th>
          <th>{ui("print.level")}</th>
          <th>{ui("print.school")}</th>
          <th>{ui("print.time")}</th>
          <th>{ui("print.range")}</th>
          <th>{ui("print.duration")}</th>
          <th>{ui("print.components")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const data = c.index.get(row.id)?.data ?? {};
          return (
            <tr key={row.id}>
              <td class="p-center">{row.alwaysPrepared ? "●" : "○"}</td>
              <td>{c.name(row.id)}</td>
              <td class="p-center">{row.level === 0 ? "0" : row.level}</td>
              <td>{c.name(`${ruleset}:school/${data.school}`)}</td>
              <td>{c.text(row.id, "castingTime")}</td>
              <td>{c.text(row.id, "range")}</td>
              <td>{c.text(row.id, "duration")}</td>
              <td>{(data.components as string[] | undefined)?.join(", ")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Slots as a row of boxes per spell level, to tick off during play. */
function SlotBoxes({ slots }: { slots: number[] }) {
  const levels = slots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n > 0);
  if (levels.length === 0) return null;
  return (
    <table class="p-slot-table">
      <thead>
        <tr>
          <th>{ui("print.slotLevel")}</th>
          <th>{ui("print.slotCount")}</th>
          <th>{ui("print.slotUsed")}</th>
        </tr>
      </thead>
      <tbody>
        {levels.map(({ level, n }) => (
          <tr key={level}>
            <td class="p-center">{level}</td>
            <td class="p-center">{n}</td>
            <td>{"□ ".repeat(n).trim()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Every spell the class could pick from, with the character's choices marked. */
function AvailableList({ c, s }: { c: Content; s: DerivedSheet }) {
  return (
    <>
      {s.spellcasters.map((caster) => (
        <CasterAvailable
          key={caster.classId}
          c={c}
          caster={caster}
          heading={s.spellcasters.length > 1 ? c.name(caster.classId) : undefined}
        />
      ))}
    </>
  );
}

function CasterAvailable({
  c,
  caster,
  heading,
}: {
  c: Content;
  caster: SpellcastingResult;
  heading?: string;
}) {
  const lists = caster.lists;
  const pools = [
    ...(lists.cantrips?.pool ?? []),
    ...(lists.known?.pool ?? lists.prepared?.pool ?? []),
  ];
  const marked = new Set([
    ...(lists.cantrips?.chosen ?? []),
    ...(lists.known?.chosen ?? lists.prepared?.chosen ?? []),
  ]);
  const prepared = new Set(lists.preparation === "spellbook" ? (lists.prepared?.chosen ?? []) : []);
  const levels = [...new Set(pools.map((id) => (c.index.get(id)?.data.level as number) ?? 0))].sort(
    (a, b) => a - b,
  );

  return (
    <section class="p-available">
      <h2 class="p-title">{heading ?? ui("print.availableTitle")}</h2>
      {levels.map((level) => (
        <div key={level} class="p-level-group">
          <h3>{levelTitle(level)}</h3>
          <ul class="p-spell-names">
            {pools
              .filter((id) => ((c.index.get(id)?.data.level as number) ?? 0) === level)
              .map((id) => (
                <li key={id} class={prepared.has(id) ? "p-prepared" : ""}>
                  {marked.has(id) ? "■" : "□"} {c.name(id)}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export function SpellPages() {
  const c = content.value;
  const s = printSheet.value;
  const ch = character.value;
  const settings = printSettings.value;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  const caster = s.spellcasting;
  const showChosen = settings.spellMode !== "none" && rows.length > 0;
  const showAvailable = settings.includeAvailable && caster;
  if (!showChosen && !showAvailable) return null;
  const levels = [...new Set(rows.map((r) => r.level))];

  return (
    <>
      {showChosen && (
        <section class="p-page p-spells">
          <h2 class="p-title">{ui("print.page.spells")}</h2>
          {caster && (
            <div class="p-casting">
              {s.spellcasters.map((each) => (
                <dl class="p-fields" key={each.classId}>
                  {s.spellcasters.length > 1 && (
                    <div>
                      <dd>{c.name(each.classId)}</dd>
                      <dt>{ui("form.class")}</dt>
                    </div>
                  )}
                  <div>
                    <dd>{c.name(`${ch.ruleset}:ability/${each.ability}`)}</dd>
                    <dt>{ui("sheet.spellAbility")}</dt>
                  </div>
                  <div>
                    <dd>{each.saveDc}</dd>
                    <dt>{ui("sheet.spellSaveDc")}</dt>
                  </div>
                  <div>
                    <dd>{signed(each.attackBonus)}</dd>
                    <dt>{ui("sheet.spellAttack")}</dt>
                  </div>
                </dl>
              ))}
              <SlotBoxes slots={s.spellSlots} />
              {s.pactSlots && (
                <p class="p-muted">
                  {ui("sheet.pact", { count: s.pactSlots.count, level: s.pactSlots.level })}
                </p>
              )}
            </div>
          )}

          {showChosen && settings.spellMode === "compact" && (
            <CompactTable c={c} ruleset={ch.ruleset} rows={rows} />
          )}
          {showChosen &&
            settings.spellMode === "details" &&
            levels.map((level) => (
              <div key={level} class="p-level-group">
                <h3 class="p-level-title">{levelTitle(level)}</h3>
                <div class="p-spell-columns">
                  {rows
                    .filter((r) => r.level === level)
                    .map((row) => (
                      <SpellBlock key={row.id} c={c} ruleset={ch.ruleset} row={row} />
                    ))}
                </div>
              </div>
            ))}
        </section>
      )}
      {showAvailable && (
        <section class="p-page">
          <AvailableList c={c} s={s} />
        </section>
      )}
    </>
  );
}
