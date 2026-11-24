import { character, content, isForced, shownSheet } from "../../app/store";
import type { DerivedSheet, SpellcastingResult } from "../../engine/derive";
import { OVERRIDE } from "../../engine/overrides";
import { signed, ui } from "../../i18n/ui";
import { MagicIcon } from "../play/icons";
import { Stat } from "./CoreStats";
import { Panel, Pips } from "./parts";

/**
 * What a class can have of spells at its level: the known ones (known casters), or the prepared
 * ones (prepared casters and wizards, who also have a spellbook of a size of its own).
 */
function spellCount(caster: SpellcastingResult) {
  const { preparation, known, prepared } = caster.lists;
  if (preparation === "known")
    return { label: ui("sheet.spellsKnown"), value: caster.spellsKnown ?? known?.allowed };
  return { label: ui("sheet.spellsPrepared"), value: prepared?.allowed };
}

/** Spell attack, save DC, cantrips, spells known or prepared, and the casting ability, for each class. */
export function SpellcastingStats({ s }: { s: DerivedSheet }) {
  const c = content.value;
  const ch = character.value;
  if (!c || s.spellcasters.length === 0) return null;
  return (
    <>
      {s.spellcasters.map((caster) => {
        const count = spellCount(caster);
        const book = caster.lists.preparation === "spellbook" ? caster.lists.known : undefined;
        return (
          <div key={caster.classId} class="spell-stats">
            {s.spellcasters.length > 1 && <h4>{c.name(caster.classId)}</h4>}
            <div class="stat-row stat-row-4">
              <Stat label={ui("sheet.spellAttack")} forced={isForced(OVERRIDE.spellAttack)}>
                {signed(caster.attackBonus)}
              </Stat>
              <Stat label={ui("sheet.spellSaveDc")} forced={isForced(OVERRIDE.spellSaveDc)}>
                {caster.saveDc}
              </Stat>
              <div class="stat">
                <div class="stat-value">{caster.cantripsKnown ?? "—"}</div>
                <div class="stat-label">{ui("sheet.cantrips")}</div>
              </div>
              <div class="stat">
                <div class="stat-value">{count.value ?? "—"}</div>
                <div class="stat-label">{count.label}</div>
              </div>
            </div>
            <p class="muted">
              {ui("sheet.spellAbility")}: {c.name(`${ch.ruleset}:ability/${caster.ability}`)}
              {book && ` · ${ui("sheet.spellbookSize", { count: book.allowed })}`}
            </p>
          </div>
        );
      })}
    </>
  );
}

/** Spell attack, save DC, how many spells are known, and the slots to tick off. */
export function SpellcastingPanel() {
  const s = shownSheet.value;
  if (!s || s.spellcasters.length === 0) return null;
  const slots = s.spellSlots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n > 0);

  return (
    <Panel title={ui("sheet.spellcasting")} tint="magic" icon={MagicIcon}>
      <SpellcastingStats s={s} />
      <h4>{ui("sheet.spellSlots")}</h4>
      <ul class="slot-list">
        {slots.map((x) => (
          <li key={x.level}>
            <span class="slot-level">{ui("sheet.slotLevel", { level: x.level })}</span>
            <Pips count={x.n} />
          </li>
        ))}
      </ul>
      {s.pactSlots && (
        <p class="muted">
          {ui("sheet.pact", { count: s.pactSlots.count, level: s.pactSlots.level })}
        </p>
      )}
    </Panel>
  );
}
