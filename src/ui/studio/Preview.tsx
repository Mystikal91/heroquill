import { content } from "../../app/store";
import type { Entry } from "../../data/schema";
import { type Warning, warningsFor } from "../../homebrew/warnings";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { EntryDetail } from "../rules/EntryDetail";
import { Paragraphs } from "../sheet/parts";
import { spellFacts } from "../spells/spellFacts";
import { kindName } from "./names";

/** A spell as the rules page shows it, from the entry as it is being written (saved or not). */
function SpellPreview({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const c = content.value;
  const data = entry.data as Record<string, unknown>;
  const text = (field: string) => record.strings[`${entry.id}.${field}`] ?? "";
  const schoolSlug = typeof data.school === "string" ? data.school : "";
  const school = c?.name(`srd51:school/${schoolSlug}`) ?? schoolSlug;
  const level = typeof data.level === "number" ? data.level : 0;
  const components = Array.isArray(data.components) ? (data.components as string[]) : [];
  const material = text("material");
  const rows: [string, string | undefined][] = [
    [ui("spells.castingTime"), text("castingTime")],
    [ui("spells.range"), text("range")],
    [
      ui("spells.components"),
      components.length && material
        ? `${components.join(", ")} (${material})`
        : components.join(", "),
    ],
    [ui("spells.duration"), text("duration")],
    ...spellFacts(data, (index) => c?.name(`srd51:ability/${index}`) ?? index),
  ];
  const tags = [
    data.concentration ? ui("spells.concentration") : undefined,
    data.ritual ? ui("spells.ritual") : undefined,
  ].filter(Boolean);
  return (
    <div class="rule-detail">
      <h3>{text("name") || ui("studio.unnamed")}</h3>
      <p class="muted">
        {level === 0
          ? ui("spells.cantripSchool", { school })
          : ui("spells.levelSchool", { level, school })}
        {tags.length > 0 && ` · ${tags.join(" · ")}`}
      </p>
      <dl class="spell-info-meta">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={`${label}:${value}`}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <Paragraphs text={text("desc")} />
      {text("higherLevel") && (
        <p>
          <b>{ui("hb.f.higherLevel")}.</b> {text("higherLevel")}
        </p>
      )}
    </div>
  );
}

/** Any other entry: the page of the rules when the app already has it, else its name and text. */
function PlainPreview({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  if (content.value?.index.has(entry.id)) return <EntryDetail id={entry.id} />;
  return (
    <div class="rule-detail">
      <h3>{record.strings[`${entry.id}.name`] || ui("studio.unnamed")}</h3>
      <p class="muted">{kindName(entry)}</p>
      <Paragraphs text={record.strings[`${entry.id}.desc`] ?? ""} />
    </div>
  );
}

export function Warnings({ list }: { list: Warning[] }) {
  if (list.length === 0) return <p class="studio-ok">{ui("studio.allGood")}</p>;
  return (
    <ul class="studio-warnings">
      {list.map((w) => (
        <li key={`${w.code}:${w.text ?? ""}`} class={w.severity}>
          {w.code === "problem" ? w.text : ui(`studio.w.${w.code}`, { ref: w.text ?? "" })}
        </li>
      ))}
    </ul>
  );
}

/** The right-hand side of the studio: how the entry reads, and what to fix. */
export function Preview({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const list = warningsFor(record, entry, { packs: content.value?.packs ?? [] });
  return (
    <aside class="studio-preview">
      <h3>{ui("studio.preview")}</h3>
      <div class="studio-preview-card">
        {entry.kind === "spell" ? (
          <SpellPreview record={record} entry={entry} />
        ) : (
          <PlainPreview record={record} entry={entry} />
        )}
      </div>
      <h3>{ui("studio.check")}</h3>
      <Warnings list={list} />
    </aside>
  );
}
