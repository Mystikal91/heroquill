import { character, content, sheet } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData } from "../../data/progression";
import type { ClassLevel } from "../../engine/character";
import { subclassDataOn } from "../../engine/subclass";
import { ui } from "../../i18n/ui";
import { sourceLabel } from "../SourceTag";
import { FeaturesIcon } from "../play/icons";
import { Panel, RulesText } from "./parts";

/** Features of one class (and its subclass) grouped by the level that grants them. */
function featuresByLevel(
  c: Content,
  cl: ClassLevel,
  hidden: readonly string[],
): Map<number, string[]> {
  const byLevel = new Map<number, string[]>();
  const add = (level: number, ids: string[]) => {
    const shown = ids.filter((id) => !hidden.includes(id));
    if (shown.length > 0) byLevel.set(level, [...(byLevel.get(level) ?? []), ...shown]);
  };
  const entry = c.index.get(cl.classId);
  if (entry) for (const row of classData(entry).levels) add(row.level, row.features);
  const sub = cl.subclassId ? c.index.get(cl.subclassId) : undefined;
  if (sub) for (const row of subclassDataOn(sub, cl.classId).levels) add(row.level, row.features);
  return byLevel;
}

/** The features of one level, as rows beside the number of the level. */
function LevelRow({
  c,
  level,
  features,
  locked,
}: {
  c: Content;
  level: number;
  features: string[];
  locked: boolean;
}) {
  return (
    <div class={`level-row${locked ? " locked" : ""}`}>
      <span class="level-badge">
        <small>{ui("sheet.levelBadge")}</small>
        {level}
      </span>
      <div class="level-features">
        {features.map((id) => (
          <RulesText
            key={id}
            id={id}
            name={c.name(id)}
            text={c.text(id, "desc")}
            tag={sourceLabel(id)}
          />
        ))}
      </div>
    </div>
  );
}

/** One section per class, with its features level by level. */
export function ClassFeatures() {
  const c = content.value;
  const ch = character.value;
  if (!c || ch.classes.length === 0) return null;

  return (
    <div class="class-features">
      {ch.classes.map((cl) => {
        const hidden = sheet.value?.hiddenFeatures ?? [];
        const levels = [...featuresByLevel(c, cl, hidden).entries()].sort(([a], [b]) => a - b);
        const reached = levels.filter(([level]) => level <= cl.level);
        const ahead = levels.filter(([level]) => level > cl.level);
        return (
          <Panel
            key={cl.classId}
            tint="features"
            icon={FeaturesIcon}
            title={`${ui("sheet.classFeatures")}${ch.classes.length > 1 ? ` — ${c.name(cl.classId)}` : ""}`}
          >
            {reached.map(([level, features]) => (
              <LevelRow key={level} c={c} level={level} features={features} locked={false} />
            ))}
            {ahead.length > 0 && (
              <details class="higher-levels">
                <summary>{ui("sheet.higherLevels", { count: ahead.length })}</summary>
                {ahead.map(([level, features]) => (
                  <LevelRow key={level} c={c} level={level} features={features} locked />
                ))}
              </details>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
