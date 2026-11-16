import { signal } from "@preact/signals";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  addLog,
  changePlay,
  concentrationAlert,
  rollCheck,
  rollDiceText,
  vitals,
} from "../../app/play";
import { character, content, sheet } from "../../app/store";
import type { DerivedSheet } from "../../engine/derive";
import { durationRounds } from "../../engine/durations";
import { doubleDice } from "../../engine/monsterRolls";
import {
  applyHealing,
  castSpell,
  endConcentration,
  resourceLeft,
  setResourceUsed,
  slotsLeft,
  startConcentration,
} from "../../engine/play";
import { type SpellRollData, spellRolls } from "../../engine/spellRolls";
import { signed, ui } from "../../i18n/ui";
import { reserveName } from "../reserveName";
import { damageLabel } from "../rules/ActionButtons";
import { Panel } from "../sheet/parts";
import { type SpellRow, collectSpellRows } from "../spellRows";
import { spellDetail } from "../spells/SpellInfo";
import { PrepareSpellsButton, preparingCasters } from "./PrepareSpells";
import { ChecksIcon, FocusIcon, HealIcon, SaveIcon } from "./icons";

/** The slot level the person chose to roll and cast a spell at, by spell (default: its own level). */
const slotChoice = signal<Record<string, number>>({});
/** The spell whose last attack was a critical hit: its damage rolls the dice twice, once. */
const criticalSpell = signal<string | undefined>(undefined);

const levelId = (level: number) => `spells-level-${level}`;

/** The slots of one level as small gems: filled while there are some left. */
function SlotDots({ level, s }: { level: number; s: DerivedSheet }) {
  const total = s.spellSlots[level - 1] ?? 0;
  if (total === 0) return null;
  const left = slotsLeft(character.value.play, level, total);
  return (
    <span class="slot-dots" role="img" aria-label={ui("play.slotsLeft", { left, total })}>
      {Array.from({ length: total }, (_, i) => (
        <i key={`${level}-${i + 1}`} class={i < left ? "on" : ""} />
      ))}
    </span>
  );
}

/** The spell a person is keeping their mind on, and the save that may break it. */
function ConcentrationBanner({ spell }: { spell: string }) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const alert = concentrationAlert.value;
  const conSave = s.saves.con.bonus;
  return (
    <div class="spell-focus" aria-live="polite">
      <FocusIcon />
      <div class="spell-focus-text">
        <small>{ui("play.concentrationLabel")}</small>
        <b>{c.name(spell)}</b>
        {alert !== undefined && (
          <span class="spell-focus-alert">{ui("play.concentrationCheck", { dc: alert })}</span>
        )}
      </div>
      {alert !== undefined && (
        <button
          type="button"
          class="card-btn"
          onClick={() =>
            rollCheck(
              `${c.name(spell)} - ${ui("play.concentrationSave")}`,
              conSave,
              undefined,
              undefined,
              "save",
            )
          }
        >
          {ui("play.concentrationRoll")} {signed(conSave)}
        </button>
      )}
      <button
        type="button"
        class="card-btn"
        onClick={() => {
          concentrationAlert.value = undefined;
          changePlay((p) => endConcentration(p));
        }}
      >
        {ui("play.concentrationEnd")}
      </button>
    </div>
  );
}

/** One spell: its name (tap for the text), what it is, and the buttons to cast it and roll it. */
function SpellCard({ row, s }: { row: SpellRow; s: DerivedSheet }) {
  const c = content.value;
  if (!c) return null;
  const { id, level } = row;
  const play = character.value.play;
  const data = (c.index.get(id)?.data ?? {}) as SpellRollData & {
    classes?: string[];
    school?: string;
    concentration?: boolean;
    ritual?: boolean;
    pointCost?: number;
  };
  const name = c.name(id);
  const caster = s.spellcasters.find((x) => data.classes?.includes(x.classId)) ?? s.spellcasters[0];
  const modifier = caster ? s.abilities[caster.ability].modifier : 0;

  // A bigger slot only matters to the spells that grow with it.
  const slotLevels = (level > 0 ? s.spellSlots.map((n, i) => (n > 0 ? i + 1 : 0)) : []).filter(
    (l) => l >= level,
  );
  const picked = slotChoice.value[id] ?? level;
  const slotLevel = slotLevels.includes(picked) ? picked : level;
  const rolls = spellRolls(data, {
    slotLevel,
    characterLevel: s.level,
    modifier,
    bonuses: s.spellDamage,
    spellId: id,
    healing: s.spellHealing,
  });
  const choosing = rolls.scalesBySlot && slotLevels.length > 1;
  const castLevel = rolls.scalesBySlot ? slotLevel : level;

  const concentrating = play.concentration === id;
  const critical = criticalSpell.value === id;
  const school = data.school ? c.name(`${character.value.ruleset}:school/${data.school}`) : "";
  // "1 reaction, which you take when..." is long: the first words say how long it takes.
  const time = c.text(id, "castingTime")?.split(",")[0];

  const hasActions =
    level > 0 ||
    rolls.attack ||
    rolls.damage.length > 0 ||
    rolls.heal !== undefined ||
    rolls.save !== undefined ||
    data.concentration === true;

  // A class without slots pays for its spells from a reserve of points, up to a limit for each spell.
  const reserveCounter = caster?.reserve
    ? s.resources.find((r) => r.id === `reserve:${caster.reserve}`)
    : undefined;
  const pointCost = typeof data.pointCost === "number" ? data.pointCost : level;
  const castFromReserve = () => {
    if (!caster?.reserve) return;
    const label = reserveName(caster.reserve);
    if (caster.spellLimit !== undefined && pointCost > caster.spellLimit) {
      addLog({ label: name, detail: ui("play.overLimit", { n: caster.spellLimit }) });
      return;
    }
    const left = reserveCounter ? resourceLeft(play, reserveCounter.id, reserveCounter.max) : 0;
    if (!reserveCounter || left < pointCost) {
      addLog({ label: name, detail: ui("play.noPoints", { reserve: label.toLowerCase() }) });
      return;
    }
    changePlay((p) =>
      setResourceUsed(
        p,
        reserveCounter.id,
        (p.resourcesUsed?.[reserveCounter.id] ?? 0) + pointCost,
        reserveCounter.max,
      ),
    );
    addLog({
      label: name,
      detail: ui("play.castPoints", { n: pointCost, reserve: label.toLowerCase() }),
    });
  };
  const cast = () => {
    if (caster?.reserve) {
      castFromReserve();
      return;
    }
    const done = castSpell(play, castLevel, s.spellSlots, s.pactSlots);
    if (!done) {
      addLog({ label: name, detail: ui("play.noSlot") });
      return;
    }
    changePlay(() => done.play);
    addLog({
      label: name,
      detail: ui(done.slot.kind === "pact" ? "play.castPact" : "play.castSlot", {
        level: done.slot.level,
      }),
    });
  };

  return (
    <li
      class="play-card spell-card"
      data-school={data.school ?? ""}
      data-focus={concentrating ? "on" : undefined}
    >
      <span class="card-badge" aria-hidden="true">
        {level === 0 ? "✦" : level}
      </span>
      <div class="card-head">
        <button
          type="button"
          class="link card-name"
          aria-label={`${ui("spells.info")}: ${name}`}
          onClick={() => {
            spellDetail.value = id;
          }}
        >
          {name}
        </button>
        <span class="card-meta">
          {[school, time].filter(Boolean).join(" · ")}
          {data.concentration && <abbr title={ui("spells.concentration")}>C</abbr>}
          {data.ritual && <abbr title={ui("spells.ritual")}>R</abbr>}
          {row.atWill && <abbr title={ui("spells.atWill")}>∞</abbr>}
        </span>
      </div>

      {choosing && (
        <div class="spell-slot-pick">
          <small>{ui("play.spellAtSlot")}</small>
          {slotLevels.map((l) => (
            <button
              key={l}
              type="button"
              class="card-btn spell-slot-btn"
              aria-label={`${ui("play.spellSlotChoice", { spell: name })}: ${l}`}
              aria-pressed={l === slotLevel}
              onClick={() => {
                slotChoice.value = { ...slotChoice.value, [id]: l };
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {hasActions && (
        // Armor worn without training: the character cannot cast, so none of the buttons of the spell works.
        <div
          class="card-actions"
          ref={(el) => {
            if (el) el.inert = s.armorClass.untrained;
          }}
        >
          {(level > 0 || (caster?.reserve && pointCost > 0)) && (
            <button type="button" class="card-btn card-primary" onClick={cast}>
              {ui("play.cast")}
              {caster?.reserve && <small> −{pointCost}</small>}
            </button>
          )}
          {rolls.attack && caster && (
            <button
              type="button"
              class="card-btn card-roll card-attack"
              onClick={() => {
                const roll = rollCheck(
                  `${name} - ${ui("play.spellAttack")}`,
                  caster.attackBonus,
                  undefined,
                  undefined,
                  "attack",
                );
                criticalSpell.value = roll.critical ? id : undefined;
              }}
            >
              <ChecksIcon />
              <span>{ui("play.spellAttack")}</span>
              <b>{signed(caster.attackBonus)}</b>
            </button>
          )}
          {rolls.damage.map((part) => {
            const dice = critical ? doubleDice(part.dice) : part.dice;
            return (
              <button
                key={`${part.type}${part.dice}`}
                type="button"
                class="card-btn card-roll card-damage"
                data-damage={part.type}
                onClick={() => {
                  rollDiceText(`${name} (${damageLabel(part, dice)})`, dice);
                  criticalSpell.value = undefined;
                }}
              >
                {damageLabel(part, dice)}
              </button>
            );
          })}
          {rolls.heal && (
            <button
              type="button"
              class="card-btn card-roll card-heal"
              onClick={() => {
                const label = `${name} - ${ui("play.spellHeal")}`;
                // The highest number on every die: nothing to roll, the total goes to the log.
                if (rolls.healFixed !== undefined)
                  addLog({ label, detail: rolls.heal ?? "", total: rolls.healFixed });
                else if (rolls.heal) rollDiceText(label, rolls.heal);
              }}
            >
              <HealIcon />
              <span>
                {ui("play.spellHealDice", { dice: String(rolls.healFixed ?? rolls.heal ?? "") })}
              </span>
            </button>
          )}
          {rolls.selfHeal !== undefined && (
            <button
              type="button"
              class="card-btn card-roll card-heal"
              onClick={() => {
                const v = vitals();
                const amount = rolls.selfHeal ?? 0;
                if (!v) return;
                changePlay((p) => applyHealing(p, v.max, amount));
                addLog({
                  label: `${name} - ${ui("play.spellHealSelf", { n: amount })}`,
                  detail: "",
                  total: amount,
                });
              }}
            >
              <HealIcon />
              <span>{ui("play.spellHealSelf", { n: rolls.selfHeal })}</span>
            </button>
          )}
          {rolls.save && caster && (
            <span class="spell-save">
              <SaveIcon />
              {ui("play.spellSave", {
                dc: caster.saveDc,
                ability: c.name(`${character.value.ruleset}:ability/${rolls.save}`),
              })}
            </span>
          )}
          {data.concentration === true && (
            <button
              type="button"
              class="card-btn spell-focus-btn"
              aria-pressed={concentrating}
              onClick={() => {
                concentrationAlert.value = undefined;
                changePlay((p) =>
                  concentrating
                    ? endConcentration(p)
                    : startConcentration(p, id, durationRounds(c.text(id, "duration"))),
                );
              }}
            >
              <FocusIcon />
              <span>{ui("play.concentrate")}</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * The button to change the prepared spells and the quick buttons of the levels: in one row when
 * they fit (the button takes what the buttons leave, a thin line between), else the button takes
 * the whole row and the levels come under it, centred.
 */
function SpellToolbar({ levels }: { levels: number[] }) {
  const row = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState(false);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el) return;
    const measure = () => {
      const [first, second] = [el.children[0], el.children[1]] as (HTMLElement | undefined)[];
      setWrapped(Boolean(first && second && second.offsetTop > first.offsetTop + 1));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(measure);
    watcher.observe(el);
    return () => watcher.disconnect();
  });
  return (
    <div ref={row} class={`spell-toolbar${wrapped ? " wrapped" : ""}`}>
      <PrepareSpellsButton />
      {levels.length > 2 && (
        <nav class="spell-jump" aria-label={ui("play.spellJump")}>
          {levels.map((level) => (
            <button
              key={level}
              type="button"
              class="card-btn spell-jump-btn"
              onClick={() =>
                document.getElementById(levelId(level))?.scrollIntoView({ block: "start" })
              }
            >
              {level === 0 ? "✦" : level}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

/** The spells the character can cast, by level, as cards with what to tap at the table. */
export function PlaySpells() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const rows = collectSpellRows(c, s);
  // A class that prepares its spells can have none prepared yet: the button must still be there.
  if (rows.length === 0 && preparingCasters(s).length === 0) return null;
  const levels = [...new Set(rows.map((r) => r.level))];
  const concentrating = character.value.play.concentration;

  return (
    <Panel title={ui("play.spells")} className="spells-panel">
      {s.armorClass.untrained && <p class="note">{ui("armor.untrained")}</p>}
      {concentrating && <ConcentrationBanner spell={concentrating} />}
      <SpellToolbar levels={levels} />
      {levels.map((level) => (
        <section key={level} id={levelId(level)} class="spell-group">
          <header class="spell-group-head">
            <h4>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</h4>
            <SlotDots level={level} s={s} />
          </header>
          <ul class="plain spell-cards">
            {rows
              .filter((r) => r.level === level)
              .map((row) => (
                <SpellCard key={row.id} row={row} s={s} />
              ))}
          </ul>
        </section>
      ))}
    </Panel>
  );
}
