import { type ComponentChildren, Fragment } from "preact";
import { character, content, sheet } from "../../app/store";
import { classData, subclassData } from "../../data/progression";
import type { Effect } from "../../data/schema";
import { heldBy, plainEffects } from "../../engine/requirements";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { EditPencil } from "../QuickEdit";
import { backgroundFeature } from "../backgroundFeature";
import { Paragraphs, RulesText } from "../sheet/parts";

/** The longest list of options named in a line before it is cut. */
const MAX_LISTED = 8;

type Proficiency = Extract<Effect, { type: "proficiency" }>;
type Choice = Extract<Effect, { type: "choice" }>;

/** The name of a proficiency, language, skill or ability from its category and target. */
function label(category: string, target: string): string {
  const c = content.value;
  if (!c) return target;
  const rs = character.value.ruleset;
  const kind =
    category === "language"
      ? "language"
      : category === "skill"
        ? "skill"
        : category === "save"
          ? "ability"
          : "proficiency";
  return c.name(`${rs}:${kind}/${target}`);
}

const proficiencies = (effects: Effect[], category: Proficiency["category"]) =>
  effects
    .filter((e): e is Proficiency => e.type === "proficiency" && e.category === category)
    .map((e) => label(category, e.target));

/** "Choose 2: Arcana, History..." for the proficiency a class or background lets you pick. */
function choiceLines(effects: Effect[]): string[] {
  return effects
    .filter((e): e is Choice => e.type === "choice")
    .flatMap((e) => {
      if (e.grants === "language")
        return [ui("build.info.choose", { n: e.choose, list: ui("sheet.languages") })];
      if (e.grants === "size")
        return [
          ui("build.info.choose", {
            n: e.choose,
            list: e.from.map((size) => ui(`hb.o.${size}` as UiKey)).join(", "),
          }),
        ];
      if (e.grants !== "proficiency") return [];
      const names = e.from.map((option) => {
        const [category = "", target = ""] = String(option).split(":");
        return label(category, target);
      });
      const shown = names.slice(0, MAX_LISTED).join(", ");
      return [
        ui("build.info.choose", {
          n: e.choose,
          list: names.length > MAX_LISTED ? `${shown}…` : shown,
        }),
      ];
    });
}

function Facts({ rows }: { rows: [string, string | undefined][] }) {
  const shown = rows.filter(([, value]) => value);
  if (shown.length === 0) return null;
  return (
    <dl class="pairs">
      {shown.map(([term, value]) => (
        <Fragment key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function Block({
  title,
  subtitle,
  edit = [],
  subtitleEdit,
  children,
}: {
  title: string;
  subtitle?: string | undefined;
  /** The entries whose texts the pencils next to the title edit. */
  edit?: string[];
  /** The entry the pencil next to the subtitle edits (a subspecies). */
  subtitleEdit?: string | undefined;
  children: ComponentChildren;
}) {
  return (
    <section class="entry-info">
      <h4>
        {title}
        {edit.map((id) => (
          <EditPencil key={id} id={id} />
        ))}
      </h4>
      {subtitle && (
        <p class="muted">
          {subtitle}
          {subtitleEdit && <EditPencil id={subtitleEdit} />}
        </p>
      )}
      {children}
    </section>
  );
}

const Pick = ({ text }: { text: UiKey }) => <p class="muted">{ui(text)}</p>;

/** What the chosen species (and subspecies) give: size, speed, bonuses, languages and traits. */
export function SpeciesInfo() {
  const c = content.value;
  const ch = character.value;
  const species = c?.index.get(ch.choices.species ?? "");
  if (!c || !species) return <Pick text="build.info.pickSpecies" />;
  const sub = c.index.get(ch.choices.subspecies ?? "");
  const all = sub?.data.replacesSpecies
    ? sub.effects
    : [...species.effects, ...(sub?.effects ?? [])];
  const held = new Set([
    ...(sub ? heldBy(sub.id, sub.effects) : []),
    ...(ch.options ?? []).flatMap((id) => {
      const option = c.index.get(id);
      return option ? [...heldBy(id, option.effects)] : [];
    }),
  ]);
  const effects = plainEffects(all, held);
  const rs = ch.ruleset;

  const bonuses = effects
    .filter((e): e is Extract<Effect, { type: "abilityBonus" }> => e.type === "abilityBonus")
    .map(
      (e) =>
        `${signed(e.value)} ${c.text(`${rs}:ability/${e.ability}`, "abbreviation") ?? e.ability}`,
    );
  // The size the sheet works out (a species can let you pick it), else the one the species has.
  const size = sheet.value?.size ?? (species.data.size as string | undefined);
  const speed = species.data.speed as number | undefined;
  const traits = effects.flatMap((e) => (e.type === "trait" ? [e.id] : []));
  const about = ["desc", "age", "alignment", "sizeDescription", "languageDescription"]
    .map((field) => c.text(species.id, field))
    .filter(Boolean)
    .join("\n\n");

  return (
    <Block
      title={c.name(species.id)}
      subtitle={sub ? c.name(sub.id) : undefined}
      edit={[species.id]}
      subtitleEdit={sub?.id}
    >
      <Facts
        rows={[
          [ui("hb.f.size"), size ? (ui(`hb.o.${size}` as UiKey) ?? size) : undefined],
          [ui("sheet.speed"), speed === undefined ? undefined : distance(speed)],
          [ui("build.info.bonuses"), bonuses.join(", ")],
          [ui("sheet.languages"), [...proficiencies(effects, "language")].join(", ")],
          ...choiceLines(effects).map((line): [string, string] => [ui("build.info.choices"), line]),
        ]}
      />
      {sub && <Paragraphs text={c.text(sub.id, "desc")} />}
      {traits.length > 0 && (
        <div class="entry-info-list">
          {traits.map((id) => (
            <RulesText key={id} id={id} name={c.name(id)} text={c.text(id, "desc")} />
          ))}
        </div>
      )}
      {about && (
        <details>
          <summary>{ui("build.info.more")}</summary>
          <Paragraphs text={about} />
        </details>
      )}
    </Block>
  );
}

/** What the chosen background gives: proficiencies and its feature. */
export function BackgroundInfo() {
  const c = content.value;
  const ch = character.value;
  const background = c?.index.get(ch.choices.background ?? "");
  if (!c || !background) return <Pick text="build.info.pickBackground" />;
  const effects = plainEffects(background.effects);
  const { name: featureName, text: featureText } = backgroundFeature(ch, c);

  return (
    <Block title={c.name(background.id)} edit={[background.id]}>
      <Paragraphs text={c.text(background.id, "desc")} />
      <Facts
        rows={[
          [ui("sheet.skills"), proficiencies(effects, "skill").join(", ")],
          [ui("sheet.tools"), proficiencies(effects, "tool").join(", ")],
          [ui("sheet.languages"), proficiencies(effects, "language").join(", ")],
          ...choiceLines(effects).map((line): [string, string] => [ui("build.info.choices"), line]),
        ]}
      />
      {featureName && (
        <div class="entry-info-list">
          <RulesText id={background.id} name={featureName} text={featureText} />
        </div>
      )}
    </Block>
  );
}

/**
 * What a class gives, and its subclass. The first class gives its proficiencies; a class taken
 * later only gives what multiclassing allows, which the engine reports on the sheet.
 */
export function ClassInfo({
  classId,
  subclassId,
  first,
}: { classId: string; subclassId: string | undefined; first: boolean }) {
  const c = content.value;
  const entry = c?.index.get(classId);
  if (!c || !entry) return null;
  const data = classData(entry);
  const effects = plainEffects(entry.effects);
  const rs = character.value.ruleset;
  const sub = subclassId ? c.index.get(subclassId) : undefined;

  const abilityName = (id: string) => c.name(`${rs}:ability/${id}`);
  const levelOne = data.levels.find((l) => l.level === 1)?.features ?? [];
  const byLevel = data.levels.filter((l) => l.features.length > 0);
  const subLevels = sub ? subclassData(sub).levels.filter((l) => l.features.length > 0) : [];

  return (
    <>
      <Block title={c.name(classId)} edit={[classId]}>
        <Paragraphs text={c.text(classId, "desc")} />
        <Facts
          rows={[
            [ui("hb.f.hitDie"), `d${data.hitDie}`],
            [
              ui("sheet.spellcasting"),
              data.spellcasting ? abilityName(data.spellcasting.ability) : undefined,
            ],
            ...(first
              ? ([
                  [ui("hb.f.saves"), proficiencies(effects, "save").join(", ")],
                  [ui("sheet.armor"), proficiencies(effects, "armor").join(", ")],
                  [ui("sheet.weapons"), proficiencies(effects, "weapon").join(", ")],
                  [ui("sheet.tools"), proficiencies(effects, "tool").join(", ")],
                  ...choiceLines(effects).map((line): [string, string] => [
                    ui("build.info.choices"),
                    line,
                  ]),
                ] as [string, string | undefined][])
              : []),
          ]}
        />
        {levelOne.length > 0 && (
          <div class="entry-info-list">
            {levelOne.map((id) => (
              <RulesText key={id} id={id} name={c.name(id)} text={c.text(id, "desc")} />
            ))}
          </div>
        )}
        {byLevel.length > 0 && (
          <details>
            <summary>{ui("build.info.byLevel")}</summary>
            <dl class="pairs">
              {byLevel.map((row) => (
                <Fragment key={row.level}>
                  <dt>{ui("build.info.level", { n: row.level })}</dt>
                  <dd>{row.features.map((id) => c.name(id)).join(", ")}</dd>
                </Fragment>
              ))}
            </dl>
          </details>
        )}
      </Block>
      {sub && (
        <Block title={c.name(sub.id)} subtitle={c.text(sub.id, "flavor")} edit={[sub.id]}>
          <Paragraphs text={c.text(sub.id, "desc")} />
          {subLevels.length > 0 && (
            <dl class="pairs">
              {subLevels.map((row) => (
                <Fragment key={row.level}>
                  <dt>{ui("build.info.level", { n: row.level })}</dt>
                  <dd>{row.features.map((id) => c.name(id)).join(", ")}</dd>
                </Fragment>
              ))}
            </dl>
          )}
        </Block>
      )}
    </>
  );
}
