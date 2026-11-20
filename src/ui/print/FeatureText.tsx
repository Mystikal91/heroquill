import type { VNode } from "preact";
import { content } from "../../app/store";
import { activationOf, breathWeaponOf } from "../../engine/actions";
import { resourcesByEntry } from "../../engine/resources";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { SourceTag } from "../SourceTag";
import { recoveryLabel, resourceLabel } from "../play/ResourceControl";
import { featureValueLabel } from "../sheet/parts";
import { BlankFeatures } from "./BlankPages";
import { type FlowBlock, FlowPages } from "./FlowPages";
import { SpilledPanels } from "./FrontMore";
import { blank, printedCharacter, printedSheet } from "./printSource";

/**
 * A feature as a block of the flow: whole, and, for a text taller than a column, cut by paragraph
 * (the name stays with the first one).
 */
function featureBlock(key: string, title: VNode, paragraphs: string[], extra: VNode[]): FlowBlock {
  const text = paragraphs.map((p, i) => <p key={`${i}-${p.slice(0, 12)}`}>{p}</p>);
  return {
    key,
    node: (
      <article>
        {title}
        {text}
        {extra}
      </article>
    ),
    parts: [
      ...text.map((p, i) => ({
        key: `${key}#${i + 1}`,
        node: (
          <article class="p-part">
            {i === 0 && title}
            {p}
          </article>
        ),
      })),
      ...(extra.length > 0 ? [{ key: `${key}#extra`, node: <article>{extra}</article> }] : []),
    ],
  };
}

/** The full text of species traits and class features, flowing over as many pages as needed. */
export function FeatureText() {
  const c = content.value;
  const s = printedSheet.value;
  if (blank.value) return <BlankFeatures />;
  const ids = s
    ? [...s.traits, ...s.features, ...s.feats].filter((id) => !s.hiddenFeatures.includes(id))
    : [];
  // The 2024 rules: what each weapon mastery does is written out, once, with the weapons that have it.
  const masteries = new Map<string, string[]>();
  for (const weapon of s?.weaponMasteries ?? []) {
    const property = (c?.index.get(weapon)?.data as { weapon?: { mastery?: string } } | undefined)
      ?.weapon?.mastery;
    if (property) masteries.set(property, [...(masteries.get(property) ?? []), weapon]);
  }
  if (!c || !s || (ids.length === 0 && masteries.size === 0)) return null;
  const byEntry = resourcesByEntry(s.resources);
  const breath = breathWeaponOf(s, c.index);
  const ruleset = printedCharacter.value.ruleset;

  const blocks: FlowBlock[] = ids.map((id) => {
    const activation = activationOf(c.index.get(id));
    const counters = byEntry.get(id) ?? [];
    const extra: VNode[] = [];
    if (s.featureValues[id])
      extra.push(
        <p class="feature-values" key="values">
          {s.featureValues[id].map(featureValueLabel).join(" · ")}
        </p>,
      );
    if (id === "srd51:trait/breath-weapon" && breath)
      extra.push(
        <p class="feature-values" key="breath">
          {[
            ui("play.spellSave", {
              dc: breath.dc,
              ability: c.name(`${ruleset}:ability/${breath.save}`),
            }),
            `${ui(`spells.area.${breath.area.type}` as UiKey)} ${distance(breath.area.size)}`,
            `${breath.dice} ${ui(`hb.o.${breath.damageType}` as UiKey).toLowerCase()}`,
          ].join(" · ")}
        </p>,
      );
    if (counters.length > 0)
      extra.push(
        <p class="feature-values" key="uses">
          {counters.map((r) => `${resourceLabel(r)}: ${r.max} (${recoveryLabel(r)})`).join(" · ")}
        </p>,
      );
    const title = (
      <h3>
        {c.name(id)}
        <SourceTag id={id} />
        {activation && <span class="p-tag">{ui(`feature.activation.${activation}` as UiKey)}</span>}
      </h3>
    );
    return featureBlock(id, title, c.text(id, "desc")?.split("\n\n") ?? [], extra);
  });
  for (const [property, weapons] of masteries) {
    const title = (
      <h3>
        {c.name(property)}
        <span class="p-tag">{ui("choice.kind.mastery")}</span>
      </h3>
    );
    blocks.push(
      featureBlock(
        `mastery:${property}`,
        title,
        [c.text(property, "desc") ?? ""],
        [
          <p class="feature-values" key="weapons">
            {weapons.map((w) => c.name(w)).join(" · ")}
          </p>,
        ],
      ),
    );
  }

  return (
    <FlowPages
      class="p-features"
      head={
        <>
          <h2 class="p-title">{ui("print.page.features")}</h2>
          <SpilledPanels />
        </>
      }
      blocks={blocks}
    />
  );
}
