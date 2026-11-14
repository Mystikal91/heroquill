import { character, content, printSheet } from "../../app/store";
import { activationOf, breathWeaponOf } from "../../engine/actions";
import { resourcesByEntry } from "../../engine/resources";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { SourceTag } from "../SourceTag";
import { recoveryLabel, resourceLabel } from "../play/ResourceControl";
import { featureValueLabel } from "../sheet/parts";
import { SpilledPanels } from "./FrontMore";

/** The full text of species traits and class features, flowing over as many pages as needed. */
export function FeatureText() {
  const c = content.value;
  const s = printSheet.value;
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
  const ruleset = character.value.ruleset;
  return (
    <section class="p-page">
      <h2 class="p-title">{ui("print.page.features")}</h2>
      <SpilledPanels />
      <div class="p-flow">
        {ids.map((id) => {
          const activation = activationOf(c.index.get(id));
          const counters = byEntry.get(id) ?? [];
          return (
            <article key={id}>
              <h3>
                {c.name(id)}
                <SourceTag id={id} />
                {activation && (
                  <span class="p-tag">{ui(`feature.activation.${activation}` as UiKey)}</span>
                )}
              </h3>
              {c
                .text(id, "desc")
                ?.split("\n\n")
                .map((p) => (
                  <p key={p}>{p}</p>
                ))}
              {s.featureValues[id] && (
                <p class="feature-values">
                  {s.featureValues[id].map(featureValueLabel).join(" · ")}
                </p>
              )}
              {id === "srd51:trait/breath-weapon" && breath && (
                <p class="feature-values">
                  {[
                    ui("play.spellSave", {
                      dc: breath.dc,
                      ability: c.name(`${ruleset}:ability/${breath.save}`),
                    }),
                    `${ui(`spells.area.${breath.area.type}` as UiKey)} ${distance(breath.area.size)}`,
                    `${breath.dice} ${ui(`hb.o.${breath.damageType}` as UiKey).toLowerCase()}`,
                  ].join(" · ")}
                </p>
              )}
              {counters.length > 0 && (
                <p class="feature-values">
                  {counters
                    .map((r) => `${resourceLabel(r)}: ${r.max} (${recoveryLabel(r)})`)
                    .join(" · ")}
                </p>
              )}
            </article>
          );
        })}
        {[...masteries.entries()].map(([property, weapons]) => (
          <article key={property}>
            <h3>
              {c.name(property)}
              <span class="p-tag">{ui("choice.kind.mastery")}</span>
            </h3>
            <p>{c.text(property, "desc")}</p>
            <p class="feature-values">{weapons.map((w) => c.name(w)).join(" · ")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
