import { content } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData, subclassData } from "../../data/progression";
import { ui } from "../../i18n/ui";
import { collectSpellRows } from "../spellRows";
import { FitText } from "./FitText";
import { Sheet } from "./PageFoot";
import { printedCharacter, printedSheet } from "./printSource";

const SPELL_CARDS_PER_PAGE = 12;
const FEATURE_CARDS_PER_PAGE = 15;

function chunk<T>(items: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) pages.push(items.slice(i, i + size));
  return pages;
}

function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <span>
      <span class={`p-pip${on ? " on" : ""}`} />
      {label}
    </span>
  );
}

/** Spell cards, twelve to a page: the spell's numbers on top and its text below. */
export function SpellCards() {
  const c = content.value;
  const s = printedSheet.value;
  const ch = printedCharacter.value;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  if (rows.length === 0) return null;
  // Only casters who prepare spells get the "prepared" marker on their cards.
  const preparedList = s.spellcasters.some((caster) => caster.lists.prepared)
    ? s.spellcasters.flatMap((caster) => caster.lists.prepared?.chosen ?? [])
    : undefined;

  return (
    <>
      {chunk(rows, SPELL_CARDS_PER_PAGE).map((page) => (
        <Sheet key={page[0]?.id}>
          <div class="p-cards spells">
            {page.map((row) => {
              const data = c.index.get(row.id)?.data ?? {};
              const components = (data.components as string[] | undefined) ?? [];
              const dc = (data.dc as { dcType?: { index?: string } } | undefined)?.dcType?.index;
              const school = c.name(`${ch.ruleset}:school/${data.school}`);
              const material = c.text(row.id, "material");
              const desc = [c.text(row.id, "desc"), c.text(row.id, "higherLevel")]
                .filter(Boolean)
                .join("\n\n");
              return (
                <article class="p-frame p-card" key={row.id}>
                  <div class="p-card-head">
                    <span class="p-level">{row.level === 0 ? "C" : row.level}</span>
                    <h3>
                      {c.name(row.id)}
                      <small>{school}</small>
                    </h3>
                  </div>
                  <dl class="p-card-fields">
                    <div>
                      <dd>{c.text(row.id, "range")}</dd>
                      <dt>{ui("spells.range")}</dt>
                    </div>
                    <div>
                      <dd>{c.text(row.id, "castingTime")}</dd>
                      <dt>{ui("spells.castingTime")}</dt>
                    </div>
                    <div>
                      <dd>{dc ? c.text(`${ch.ruleset}:ability/${dc}`, "abbreviation") : "—"}</dd>
                      <dt>{ui("print.cardSave")}</dt>
                    </div>
                    <div style="grid-column: span 2">
                      <dd>{c.text(row.id, "duration")}</dd>
                      <dt>{ui("spells.duration")}</dt>
                    </div>
                    <div>
                      <dd>{components.join(" ")}</dd>
                      <dt>{ui("spells.components")}</dt>
                    </div>
                  </dl>
                  <div class="p-card-marks">
                    <Mark on={Boolean(data.concentration)} label={ui("print.cardConcentration")} />
                    <Mark on={Boolean(data.ritual)} label={ui("print.cardRitual")} />
                    {preparedList && row.level > 0 && (
                      <Mark
                        on={row.alwaysPrepared || preparedList.includes(row.id)}
                        label={ui("print.cardPrepared")}
                      />
                    )}
                  </div>
                  <FitText text={material ? `${desc}\n\n${material}` : desc} />
                </article>
              );
            })}
          </div>
        </Sheet>
      ))}
    </>
  );
}

interface FeatureCard {
  id: string;
  /** The level that grants it, or undefined for species traits. */
  level?: number;
  source: string;
}

function featureCards(c: Content, s: NonNullable<typeof printedSheet.value>): FeatureCard[] {
  const ch = printedCharacter.value;
  const cards: FeatureCard[] = s.traits.map((id) => ({ id, source: ui("print.cardSpecies") }));
  for (const id of s.feats)
    if (!s.hiddenFeatures.includes(id)) cards.push({ id, source: ui("print.cardFeat") });
  for (const cl of ch.classes) {
    const entry = c.index.get(cl.classId);
    const sub = cl.subclassId ? c.index.get(cl.subclassId) : undefined;
    const rows = [
      ...(entry ? classData(entry).levels : []),
      ...(sub ? subclassData(sub).levels : []),
    ].filter((row) => row.level <= cl.level);
    for (const row of rows.sort((a, b) => a.level - b.level)) {
      for (const id of row.features) {
        cards.push({ id, level: row.level, source: c.name(cl.classId) });
      }
    }
  }
  return cards;
}

/** Feature cards, fifteen to a page, for class features and species traits. */
export function FeatureCards() {
  const c = content.value;
  const s = printedSheet.value;
  if (!c || !s) return null;
  const cards = featureCards(c, s);
  if (cards.length === 0) return null;

  return (
    <>
      {chunk(cards, FEATURE_CARDS_PER_PAGE).map((page) => (
        <Sheet key={page[0]?.id}>
          <div class="p-cards features">
            {page.map((card) => (
              <article class="p-frame p-card" key={`${card.source}-${card.id}`}>
                <div class="p-card-head">
                  <span class="p-level">{card.level ?? "•"}</span>
                  <h3>
                    {c.name(card.id)}
                    <small>{card.source}</small>
                  </h3>
                </div>
                <FitText text={c.text(card.id, "desc") ?? ""} />
              </article>
            ))}
          </div>
        </Sheet>
      ))}
    </>
  );
}
