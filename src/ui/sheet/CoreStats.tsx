import type { ComponentChildren } from "preact";
import { character, content, isForced, shownSheet, updateCharacter } from "../../app/store";
import type { DamageResult } from "../../engine/equipment";
import type { ExplainTarget } from "../../engine/explain";
import { OVERRIDE } from "../../engine/overrides";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { ExplainButton } from "../Explain";
import { attackName } from "../attackName";
import { damageName } from "../damageName";
import { CombatIcon, SwordIcon } from "../play/icons";
import { useRoll } from "../useRoll";
import { ExtraDamageList } from "./ExtraDamage";
import { Panel } from "./parts";

export function Stat({
  label,
  forced = false,
  explain,
  children,
}: {
  label: string;
  forced?: boolean;
  /** The number takes itself apart when tapped. */
  explain?: ExplainTarget;
  children: ComponentChildren;
}) {
  const value = useRoll<HTMLSpanElement>();
  const inside = (
    <>
      <span class="stat-value" ref={value}>
        {children}
      </span>
      <span class="stat-label">{label}</span>
    </>
  );
  return (
    <div
      class={`stat${forced ? " forced" : ""}`}
      title={forced ? ui("freeEdit.forced") : undefined}
    >
      {explain ? <ExplainButton target={explain}>{inside}</ExplainButton> : inside}
    </div>
  );
}

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${damageName(d.type)}`;

/** Where the bonuses of features and choices come from, so a number can be trusted. */
function Bonuses() {
  const s = shownSheet.value;
  const c = content.value;
  if (!s || !c || s.bonuses.length === 0) return null;
  return (
    <details class="bonuses">
      <summary>{ui("sheet.bonuses")}</summary>
      <ul class="plain">
        {s.bonuses.map((b) => (
          <li key={`${b.target}-${b.source}-${b.value}`}>
            {ui(`sheet.bonus.${b.target}` as UiKey, {
              value:
                b.target === "speed"
                  ? `${b.value > 0 ? "+" : "-"}${distance(Math.abs(b.value))}`
                  : signed(b.value),
            })}{" "}
            <span class="muted">· {c.name(b.source)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** The numbers to know first, in the band of the sheet. */
export function KeyNumbers() {
  const s = shownSheet.value;
  if (!s) return null;
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    // It may break after a plus (a zero-width space), never inside a die.
    .join("+\u200b");
  return (
    <div class="hero-numbers">
      <Stat
        label={ui("sheet.armorClass")}
        forced={isForced(OVERRIDE.armorClass)}
        explain={{ kind: "ac" }}
      >
        {s.armorClass.value}
      </Stat>
      <Stat label={ui("sheet.hitPoints")} forced={isForced(OVERRIDE.hitPoints)}>
        {s.hitPoints.max}
      </Stat>
      <Stat
        label={ui("sheet.initiative")}
        forced={isForced(OVERRIDE.initiative)}
        explain={{ kind: "initiative" }}
      >
        {signed(s.initiative)}
      </Stat>
      <Stat label={ui("sheet.speed")} forced={isForced(OVERRIDE.speed)} explain={{ kind: "speed" }}>
        {s.speed === undefined ? "—" : distance(s.speed)}
      </Stat>
      <Stat label={ui("quick.proficiency")}>{signed(s.proficiencyBonus)}</Stat>
      <Stat label={ui("sheet.hitDice")}>{hitDice || "—"}</Stat>
    </div>
  );
}

/** Equipped weapons with their attack bonus and damage. */
export function Attacks() {
  const c = content.value;
  const s = shownSheet.value;
  if (!c || !s) return null;
  // Weapons in the inventory that are not equipped yet: the sheet offers to equip them.
  const carried = character.value.inventory
    .filter((i) => !i.equipped && c.index.get(i.itemId)?.data.weapon !== undefined)
    .map((i) => i.itemId);

  return (
    <Panel title={ui("sheet.attacks")} tint="combat" icon={CombatIcon}>
      {s.attacks.length === 0 && (
        <>
          <p class="muted">
            {ui(carried.length > 0 ? "sheet.noAttacksCarried" : "sheet.noAttacks")}
          </p>
          {carried.map((id) => (
            <button
              type="button"
              class="secondary"
              key={id}
              onClick={() =>
                updateCharacter((d) => {
                  const found = d.inventory.find((x) => x.itemId === id);
                  if (found) found.equipped = true;
                })
              }
            >
              {ui("sheet.equipItem", { name: c.name(id) })}
            </button>
          ))}
        </>
      )}
      {s.attacksPerAction > 1 && (
        <p class="muted attacks-per-action">
          {ui("sheet.attacksPerAction", { n: s.attacksPerAction })}
        </p>
      )}
      <ul class="attack-list">
        {[...s.attacks, ...(s.unarmed ? [s.unarmed] : [])].map((a) => (
          <li key={a.itemId}>
            <span class="attack-badge" aria-hidden="true">
              <SwordIcon />
            </span>
            <div class="attack-name">
              {attackName(c, a)}
              {a.enhancement > 0 && ` +${a.enhancement}`}
              {a.enchantment && <span class="muted"> · {c.name(a.enchantment)}</span>}
            </div>
            <ExplainButton class="attack-bonus" target={{ kind: "attack", itemId: a.itemId }}>
              <b>{signed(a.attackBonus)}</b>
            </ExplainButton>
            {a.heavy && <p class="note attack-note">{ui(`weapon.heavy.${a.heavy}` as UiKey)}</p>}
            <div class="attack-damage">
              {a.damage && formatDamage(a.damage)}
              {a.twoHandedDamage && (
                <div class="muted">
                  {formatDamage(a.twoHandedDamage)} ({ui("sheet.twoHanded")})
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ExtraDamageList />
      {s.armorClass.stealthDisadvantage && <p class="note">{ui("sheet.stealthDisadvantage")}</p>}
      {s.armorClass.untrained && <p class="note">{ui("armor.untrained")}</p>}
      <Bonuses />
    </Panel>
  );
}
