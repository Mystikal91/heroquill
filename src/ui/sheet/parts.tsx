import type { ComponentChildren, ComponentType } from "preact";
import { content, shownSheet } from "../../app/store";
import type { FeatureValue } from "../../engine/featureValues";
import { ui } from "../../i18n/ui";
import { machineMode, toggleOriginal } from "../../translate/auto";
import { ENGINE_NAMES } from "../../translate/engines";
import { EditPencil } from "../QuickEdit";

/** What a section of the sheet is about: the colour of its heading. */
export type Tint = "combat" | "magic" | "bag" | "features" | "species" | "story" | "profile";

/** A framed panel with a titled heading; with a tint, the heading is a coloured band with an icon. */
export function Panel({
  title,
  children,
  className = "",
  tint,
  icon: Icon,
}: {
  title: string;
  children: ComponentChildren;
  className?: string;
  tint?: Tint;
  icon?: ComponentType;
}) {
  return (
    <section class={`card panel ${className}`.trim()} data-tint={tint}>
      <h3>
        {Icon && (
          <span class="panel-icon" aria-hidden="true">
            <Icon />
          </span>
        )}
        {Icon ? <span class="panel-title">{title}</span> : title}
      </h3>
      {children}
    </section>
  );
}

/** Says that a text was translated by machine, and swaps it with the English original. */
export function MachineNote({ text }: { text: string | undefined }) {
  const mode = text ? machineMode(text) : undefined;
  if (!mode) return null;
  return (
    <p class="machine-note">
      <span>{ui("translate.machine", { source: ENGINE_NAMES[mode.engine] })}</span>{" "}
      <button type="button" class="link" onClick={() => toggleOriginal(mode.key)}>
        {ui(mode.mode === "translated" ? "translate.showOriginal" : "translate.showTranslation")}
      </button>
    </p>
  );
}

/** Text with blank lines between paragraphs, as stored in the rules texts. */
export function Paragraphs({ text }: { text: string | undefined }) {
  return (
    <>
      {text?.split("\n\n").map((p) => (
        <p key={p}>{p}</p>
      ))}
      <MachineNote text={text} />
    </>
  );
}

/** A proficiency marker: filled when proficient, with a text alternative for screen readers. */
export function Pip({ on }: { on: boolean }) {
  return (
    <span class={`pip${on ? " on" : ""}`}>
      {on && <span class="sr-only">{ui("sheet.proficient")}</span>}
    </span>
  );
}

/** One row of empty markers, e.g. spell slots to tick off. */
export function Pips({ count }: { count: number }) {
  return (
    <span class="pips" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <span class="pip" key={`pip-${i + 1}`} />
      ))}
    </span>
  );
}

/** `breath weapon:dc` and its value as a line: "Breath weapon DC: 14". */
export function featureValueLabel({ name, value }: FeatureValue): string {
  const words = name
    .replace(/:/g, " ")
    .replace(/\b(dc|hp)\b/g, (w) => w.toUpperCase())
    .trim();
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}: ${value}`;
}

/** The numbers a feature shows (a save DC, dice, a range), worked out for the character. */
export function FeatureValues({ values }: { values: FeatureValue[] | undefined }) {
  if (!values || values.length === 0) return null;
  return <p class="feature-values">{values.map(featureValueLabel).join(" · ")}</p>;
}

/** A collapsible rules text: the name is the summary, the text is revealed on demand. */
export function RulesText({
  name,
  text,
  id,
  tag,
}: {
  name: string;
  text: string | undefined;
  id?: string | undefined;
  /** Where it comes from, shown after the name. */
  tag?: string | undefined;
}) {
  const activation = id ? content.value?.index.get(id)?.data.activation : undefined;
  // A step of an improving feature says which ones it replaces; one the person turned back on says what replaced it.
  const superseded = id ? shownSheet.value?.superseded : undefined;
  const replacedBy = id ? superseded?.[id] : undefined;
  const replaces = id
    ? Object.entries(superseded ?? {}).flatMap(([old, by]) => (by === id ? [old] : []))
    : [];
  const nameOf = (entry: string) => content.value?.name(entry) ?? entry;
  return (
    <details>
      <summary>
        {name}
        {id && <EditPencil id={id} />}
        {tag && <span class="source-tag"> [{tag}]</span>}
        {(activation === "action" || activation === "bonus" || activation === "reaction") && (
          <span class="source-tag"> [{ui(`feature.activation.${activation}`)}]</span>
        )}
      </summary>
      <Paragraphs text={text} />
      <FeatureValues values={id ? shownSheet.value?.featureValues[id] : undefined} />
      {replaces.length > 0 && (
        <p class="muted replaces-note">
          {ui("feature.replaces", { names: replaces.map(nameOf).join(", ") })}
        </p>
      )}
      {replacedBy && (
        <p class="muted replaces-note">{ui("feature.replacedBy", { name: nameOf(replacedBy) })}</p>
      )}
    </details>
  );
}
