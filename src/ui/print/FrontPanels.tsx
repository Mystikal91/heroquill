import { character, content, printSheet } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData, subclassData } from "../../data/progression";
import type { ClassLevel } from "../../engine/character";
import { ui } from "../../i18n/ui";
import { recoveryLabel, resourceLabel } from "../play/ResourceControl";

/** Up to this many uses are boxes to tick; more (ki points, hit points to heal) is a number to write. */
const MAX_BOXES = 8;

/** Names of the features gained at each level reached, from the class and its subclass. */
function featureRows(c: Content, cl: ClassLevel): [number, string[]][] {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, ids: string[]) => {
    if (level <= cl.level && ids.length > 0)
      byLevel.set(level, [...(byLevel.get(level) ?? []), ...ids]);
  };
  const entry = c.index.get(cl.classId);
  if (entry) for (const row of classData(entry).levels) add(row.level, row.features);
  const sub = cl.subclassId ? c.index.get(cl.subclassId) : undefined;
  if (sub) for (const row of subclassData(sub).levels) add(row.level, row.features);
  return [...byLevel.entries()].sort(([a], [b]) => a - b);
}

/**
 * The panels of the sheet's right column that can go to a second page when the front is too full
 * (see `frontSpill`): the species traits and feats, the class features and the limited uses. Each
 * reads what it needs itself, so the front and its continuation draw the same thing.
 */
export function TraitsPanels({ featsFirst = false }: { featsFirst?: boolean }) {
  const c = content.value;
  const s = printSheet.value;
  if (!c || !s) return null;
  const name = c.name;
  const feats = s.feats.filter((id) => !s.hiddenFeatures.includes(id));
  const traitsPanel = s.traits.length > 0 && (
    <section class="p-frame p-panel" data-panel="traits">
      <h3 class="p-h">{ui("sheet.speciesTraits")}</h3>
      <ul class="p-names">
        {s.traits.map((id) => (
          <li key={id}>{name(id)}</li>
        ))}
      </ul>
    </section>
  );
  const featsPanel = feats.length > 0 && (
    <section class="p-frame p-panel" data-panel="traits">
      <h3 class="p-h">{ui("sheet.feats")}</h3>
      <ul class="p-names">
        {feats.map((id) => (
          <li key={id}>{name(id)}</li>
        ))}
      </ul>
    </section>
  );
  // The 2024 sheet puts the feats first: the background gives one, and it says as much as a species trait.
  return featsFirst ? (
    <>
      {featsPanel}
      {traitsPanel}
    </>
  ) : (
    <>
      {traitsPanel}
      {featsPanel}
    </>
  );
}

export function ClassFeaturesPanels() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const name = c.name;
  return (
    <>
      {ch.classes.map((cl) => (
        <section class="p-frame p-panel" data-panel="features" key={cl.classId}>
          <h3 class="p-h">{ui("sheet.classFeatures")}</h3>
          {featureRows(c, cl).map(([level, ids]) => (
            <div class="p-level-row" key={level}>
              <span class="p-level">{level}</span>
              <span class="names">{ids.map((id) => name(id)).join(", ")}</span>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}

export function UsesPanel() {
  const s = printSheet.value;
  if (!s) return null;
  const uses = s.resources.filter((r) => !r.unlimited);
  if (uses.length === 0) return null;
  return (
    <section class="p-frame p-panel" data-panel="uses">
      <h3 class="p-h">{ui("print.resources")}</h3>
      <ul class="p-uses">
        {uses.map((r) => (
          <li key={r.id}>
            <span class="p-use-name">
              {resourceLabel(r)}
              <small>{recoveryLabel(r)}</small>
            </span>
            {r.pool || r.max > MAX_BOXES ? (
              <span class="p-use-count">
                {r.max}
                <span class="p-write small" />
              </span>
            ) : (
              <span class="p-use-boxes">
                {Array.from({ length: r.max }, (_, i) => (
                  <span class="p-pip" key={`${r.id}-${i + 1}`} />
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
