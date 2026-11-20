import type { VNode } from "preact";
import { printSettings } from "../../app/printSettings";
import { content } from "../../app/store";
import type { Content } from "../../content/browser";
import type { DerivedSheet, SpellcastingResult } from "../../engine/derive";
import { signed, ui } from "../../i18n/ui";
import { type SpellRow, collectSpellRows } from "../spellRows";
import { spellFacts } from "../spells/spellFacts";
import { BlankSpells } from "./BlankPages";
import { type FlowBlock, FlowPages } from "./FlowPages";
import { blank, printedCharacter, printedSheet } from "./printSource";

const levelTitle = (level: number) =>
  level === 0 ? ui("spells.cantrips") : ui("spells.level", { level });

/** A spell as a block of the flow: whole, and cut by paragraph when it is taller than a column. */
function spellBlock(c: Content, ruleset: string, row: SpellRow): FlowBlock {
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

  const head = (
    <>
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
    </>
  );
  const higher = c.text(row.id, "higherLevel");
  const paragraphs: VNode[] = [
    ...(c.text(row.id, "desc")?.split("\n\n") ?? []).map((p, i) => (
      <p key={`${i}-${p.slice(0, 12)}`}>{p}</p>
    )),
    ...(higher
      ? [
          <p key="higher">
            <strong>{ui("spells.higherLevel")}.</strong> {higher}
          </p>,
        ]
      : []),
  ];
  return {
    key: row.id,
    node: (
      <article class="p-spell">
        {head}
        {paragraphs}
      </article>
    ),
    parts: [
      { key: `${row.id}#head`, node: <article class="p-spell p-part">{head}</article> },
      ...paragraphs.map((p, i) => ({
        key: `${row.id}#${i + 1}`,
        node: <article class={`p-spell${i < paragraphs.length - 1 ? " p-part" : ""}`}>{p}</article>,
      })),
    ],
  };
}

/** The columns of the compact table, shared by its head and its rows. */
function CompactRow({ cells, head = false }: { cells: (string | VNode)[]; head?: boolean }) {
  return (
    <div class={`p-spell-row${head ? " head" : ""}`}>
      {cells.map((cell, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the cells are the fixed columns of the table
        <span key={i}>{cell}</span>
      ))}
    </div>
  );
}

function compactBlocks(c: Content, ruleset: string, rows: SpellRow[]): FlowBlock[] {
  return rows.map((row) => {
    const data = c.index.get(row.id)?.data ?? {};
    return {
      key: row.id,
      node: (
        <CompactRow
          cells={[
            <span class={`p-pip${row.alwaysPrepared ? " on" : ""}`} key="pip" />,
            c.name(row.id),
            row.level === 0 ? "0" : String(row.level),
            c.name(`${ruleset}:school/${data.school}`),
            c.text(row.id, "castingTime") ?? "",
            c.text(row.id, "range") ?? "",
            c.text(row.id, "duration") ?? "",
            (data.components as string[] | undefined)?.join(", ") ?? "",
          ]}
        />
      ),
    };
  });
}

const compactHead = () => (
  <CompactRow
    head
    cells={[
      ui("print.prepared"),
      ui("print.name"),
      ui("print.level"),
      ui("print.school"),
      ui("print.time"),
      ui("print.range"),
      ui("print.duration"),
      ui("print.components"),
    ]}
  />
);

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
            <td>
              <span class="p-slot-pips">
                {Array.from({ length: n }, (_, i) => (
                  <span class="p-pip" key={`used-${level}-${i + 1}`} />
                ))}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Every spell the class could pick from, with the character's choices marked, three columns to a page. */
function CasterAvailable({
  c,
  caster,
  heading,
}: {
  c: Content;
  caster: SpellcastingResult;
  heading?: string | undefined;
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
  const levelOf = (id: string) => (c.index.get(id)?.data.level as number) ?? 0;
  const levels = [...new Set(pools.map(levelOf))].sort((a, b) => a - b);
  const blocks: FlowBlock[] = levels.flatMap((level) => [
    {
      key: `level-${level}`,
      keep: true,
      node: <h3 class="p-names-level">{levelTitle(level)}</h3>,
    },
    ...pools
      .filter((id) => levelOf(id) === level)
      .map((id) => ({
        key: id,
        node: (
          <div class={`p-spell-name${prepared.has(id) ? " p-prepared" : ""}`}>
            <span class={`p-pip${marked.has(id) ? " on" : ""}`} />
            {c.name(id)}
          </div>
        ),
      })),
  ]);
  return (
    <FlowPages
      class="p-available"
      columns={3}
      head={<h2 class="p-title">{heading ?? ui("print.availableTitle")}</h2>}
      blocks={blocks}
    />
  );
}

export function SpellPages() {
  const c = content.value;
  const s = printedSheet.value;
  const ch = printedCharacter.value;
  const settings = printSettings.value;
  if (blank.value) return settings.blankSpells ? <BlankSpells /> : null;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  const caster = s.spellcasting;
  const showChosen = settings.spellMode !== "none" && rows.length > 0;
  const showAvailable = settings.includeAvailable && caster;
  if (!showChosen && !showAvailable) return null;
  const levels = [...new Set(rows.map((r) => r.level))];

  const head = (
    <>
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
    </>
  );

  const compact = settings.spellMode === "compact";
  const blocks: FlowBlock[] = compact
    ? compactBlocks(c, ch.ruleset, rows)
    : levels.flatMap((level) => [
        {
          key: `level-${level}`,
          keep: true,
          node: <h3 class="p-level-title">{levelTitle(level)}</h3>,
        },
        ...rows.filter((r) => r.level === level).map((row) => spellBlock(c, ch.ruleset, row)),
      ]);

  return (
    <>
      {showChosen &&
        (compact ? (
          <FlowPages
            class="p-spells"
            columns={1}
            head={head}
            columnHead={compactHead()}
            blocks={blocks}
          />
        ) : (
          <FlowPages class="p-spells" head={head} blocks={blocks} />
        ))}
      {showAvailable && <AvailableList c={c} s={s} />}
    </>
  );
}

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
