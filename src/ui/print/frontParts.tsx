import { useLayoutEffect, useRef } from "preact/hooks";
import { printSettings } from "../../app/printSettings";
import { character, content, printSheet } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import type { DamageResult } from "../../engine/equipment";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { damageName } from "../damageName";
import { movementLines } from "../movementLines";
import { extraAmount, extraName } from "../sheet/ExtraDamage";
import { collectSpellRows } from "../spellRows";
import { RuledArea } from "./RuledArea";
import { fitFront } from "./fitFront";
import { frontSpill } from "./frontSpill";

/**
 * The parts the two models of the front page are made of (the 2014 one in `FrontPage`, the 2024
 * one in `FrontPage2024`). Each reads what it needs, so a model is the choice and the order of its
 * parts, and a part that differs by edition says so by itself.
 */

const BLANK_ATTACK_ROWS = 4;
/** Facts that the attacks panel already says as damage (sneak attack, rage, martial arts). */
const FACTS_AS_DAMAGE = new Set(["rageDamage", "sneakAttack", "martialArts"]);
const PROFICIENCY_CATEGORIES = ["armor", "weapon", "tool", "language"] as const;

const formatDamage = (d: DamageResult) =>
  `${d.dice}${d.bonus === 0 ? "" : signed(d.bonus)} ${damageName(d.type)}`;

/** True for a character of the 2024 rules. */
export const is2024 = () => character.value.ruleset === "srd52";

/**
 * Makes the front fit its page (see `fitFront`) when it is drawn, when the fonts arrive and before
 * the browser prints, and tells the page that follows which panels left it. Returns the ref of the page.
 */
export function useFitFront() {
  const page = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    const fit = () => {
      const { spill } = fitFront(el);
      if (frontSpill.value !== spill) frontSpill.value = spill;
    };
    fit();
    void document.fonts?.ready.then(fit);
    window.addEventListener("beforeprint", fit);
    return () => window.removeEventListener("beforeprint", fit);
  });
  return page;
}

/** The name, who the character is, and the class. */
export function FrontHead() {
  const c = content.value;
  const s = printSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const name = c.name;
  const totalLevel = ch.classes.reduce((sum, cl) => sum + cl.level, 0);
  const first = ch.classes[0];
  const classTitle = ch.classes.map((cl) => name(cl.classId)).join(" / ") || ui("sheet.noClass");
  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");
  return (
    <header class="p-head">
      <div class="p-banner">
        <h1>{ch.name || ui("sheet.unnamed")}</h1>
        <small>{ui("sheet.name")}</small>
      </div>
      <div class="p-frame p-info">
        <dl class="p-fields">
          <div>
            <dd>{species || " "}</dd>
            <dt>{ui("print.species")}</dt>
          </div>
          <div>
            <dd>{ch.choices.background ? name(ch.choices.background) : " "}</dd>
            <dt>{ui("print.background")}</dt>
          </div>
          <div>
            <dd>{ui("sheet.levelLabel", { level: totalLevel })}</dd>
            <dt>{ui("form.level")}</dt>
          </div>
          <div>
            <dd>{ch.story.alignment ? name(ch.story.alignment) : " "}</dd>
            <dt>{ui("story.alignment")}</dt>
          </div>
        </dl>
      </div>
      <div class="p-banner">
        <h2>{classTitle}</h2>
        <small>
          {first?.subclassId
            ? name(first.subclassId)
            : ui("sheet.levelLabel", { level: totalLevel })}
        </small>
      </div>
    </header>
  );
}

/** Four round numbers: the proficiency bonus and the passive senses (the 2014 sheet adds the martial save DC). */
export function Badges() {
  const s = printSheet.value;
  const ch = character.value;
  if (!s) return null;
  const passive = (skill: string, fallback: number) =>
    10 + (s.skills.find((sk) => sk.id === `${ch.ruleset}:skill/${skill}`)?.bonus ?? fallback);
  return (
    <div class="p-badges">
      <div class="p-badge">
        <b>{signed(s.proficiencyBonus)}</b>
        <span>{ui("quick.proficiency")}</span>
      </div>
      <div class="p-badge">
        <b>{s.passivePerception}</b>
        <span>{ui("quick.perception")}</span>
      </div>
      <div class="p-badge">
        <b>{passive("insight", s.abilities.wis.modifier)}</b>
        <span>{ui("quick.insight")}</span>
      </div>
      <div class="p-badge">
        {is2024() ? (
          <>
            <b>{passive("investigation", s.abilities.int.modifier)}</b>
            <span>{ui("print.investigation")}</span>
          </>
        ) : (
          <>
            <b>{s.martialSaveDc}</b>
            <span>{ui("quick.martialDc")}</span>
          </>
        )}
      </div>
    </div>
  );
}

/** The six abilities, each with its saving throw and its skills. */
export function AbilityBlocks() {
  const c = content.value;
  const s = printSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const name = c.name;
  return (
    <>
      {ABILITIES.map((a) => (
        <section class="p-frame p-ability" key={a}>
          <div class="p-ability-core">
            <div class="p-ability-name">{name(`${ch.ruleset}:ability/${a}`)}</div>
            <div class="p-oval">{s.abilities[a].score}</div>
            <div class="p-ability-mod">{signed(s.abilities[a].modifier)}</div>
          </div>
          <ul class="p-checks">
            <li class={s.saves[a].proficient ? "on" : ""}>
              <span class={`p-pip${s.saves[a].proficient ? " on" : ""}`} />
              <b>{signed(s.saves[a].bonus)}</b>
              {ui("sheet.savingThrow")}
            </li>
            {s.skills
              .filter((sk) => sk.ability === a)
              .sort((x, y) => name(x.id).localeCompare(name(y.id)))
              .map((sk) => (
                <li key={sk.id} class={sk.proficient ? "on" : ""}>
                  <span class={`p-pip${sk.proficient ? " on" : ""}`} />
                  <b>{signed(sk.bonus)}</b>
                  {name(sk.id)}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Armor class, initiative, speed, hit points, hit dice and death saves. */
export function CombatStats() {
  const s = printSheet.value;
  if (!s) return null;
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    .join(" + ");
  // Climbing and swimming at half speed are not written on the sheet; what is given is.
  const otherSpeeds = movementLines(s.movement, s.senses, true);
  return (
    <>
      <div class="p-stat-row">
        <div class="p-frame p-box">
          <b>{s.armorClass.value}</b>
          <span>{ui("sheet.armorClass")}</span>
        </div>
        <div class="p-frame p-box">
          <b>{signed(s.initiative)}</b>
          <span>{ui("sheet.initiative")}</span>
        </div>
        <div class="p-frame p-box">
          <b>{s.speed === undefined ? "" : distance(s.speed)}</b>
          <span>{ui("sheet.speed")}</span>
        </div>
      </div>

      {otherSpeeds.length > 0 && (
        <p class="p-extra">
          {otherSpeeds.map(([label, value]) => `${label} ${value}`).join(" · ")}
        </p>
      )}
      <div class="p-frame p-hp">
        <div class="p-hp-max">
          <span class="p-caption">{ui("print.maxHp")}</span>
          <b>{s.hitPoints.max}</b>
        </div>
        <div class="p-write" />
        <div class="p-caption">{ui("print.currentHp")}</div>
      </div>
      <div class="p-two">
        <div class="p-frame p-box">
          <div class="p-write small" />
          <span>{ui("print.tempHp")}</span>
        </div>
        <div class="p-frame p-box">
          <b>{hitDice || " "}</b>
          <span>{ui("print.hitDiceTotal")}</span>
        </div>
      </div>
      <div class="p-frame p-death">
        <div class="row">
          <span>{ui("print.successes")}</span>
          <span>
            <span class="p-pip" />
            <span class="p-pip" />
            <span class="p-pip" />
          </span>
        </div>
        <div class="row">
          <span>{ui("print.failures")}</span>
          <span>
            <span class="p-pip" />
            <span class="p-pip" />
            <span class="p-pip" />
          </span>
        </div>
        <div class="p-caption">{ui("print.deathSaves")}</div>
      </div>
    </>
  );
}

/** A box to mark the inspiration (the 2024 rules call it Heroic Inspiration), with the bardic die. */
export function InspirationBox() {
  const s = printSheet.value;
  if (!s) return null;
  const bardic = s.facts.find((f) => f.kind === "bardicDie");
  return (
    <div class="p-frame p-inspire">
      <span class="p-pip" />
      <span>{ui(is2024() ? "play.heroic" : "print.inspiration")}</span>
      {bardic && (
        <span class="p-inspire-die">
          {ui("fact.bardicDie", bardic.params)}
          <span class="p-pip" />
          <span class="p-pip" />
          <span class="p-pip" />
        </span>
      )}
    </div>
  );
}

/** The weapons and their attack and damage; the 2024 sheet adds the weapon mastery of each one. */
export function AttacksPanel({ grow = false }: { grow?: boolean }) {
  const c = content.value;
  const s = printSheet.value;
  if (!c || !s) return null;
  const name = c.name;
  const mastery = is2024();
  // The unarmed strike is the last row, since everyone has it.
  const allAttacks = [...s.attacks, ...(s.unarmed ? [s.unarmed] : [])];
  const attackRows = Math.max(BLANK_ATTACK_ROWS, allAttacks.length);
  const facts = s.facts.filter((f) => !FACTS_AS_DAMAGE.has(f.kind));
  const mastered = s.weaponMasteries.map((id) => name(id));
  return (
    <section class={`p-frame p-panel${grow ? " grow" : ""}`}>
      <h3 class="p-h">{ui("sheet.attacks")}</h3>
      <table class="p-table">
        <thead>
          <tr>
            <th>{ui("print.name")}</th>
            <th>{ui("sheet.attackBonus")}</th>
            <th>{ui("sheet.damage")}</th>
            {mastery && <th>{ui("print.mastery")}</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: attackRows }, (_, i) => {
            const a = allAttacks[i];
            return (
              <tr key={a?.itemId ?? `blank-${i + 1}`}>
                <td>{a ? (a.unarmed ? ui("play.unarmed") : name(a.itemId)) : " "}</td>
                <td>{a ? signed(a.attackBonus) : ""}</td>
                <td>{a?.damage ? formatDamage(a.damage) : ""}</td>
                {mastery && <td>{a?.mastery ? name(a.mastery) : ""}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
      {mastery && mastered.length > 0 && (
        <p class="p-extra">
          {ui("choice.kind.mastery")}: {mastered.join(", ")}
        </p>
      )}
      {s.extraDamage.length > 0 && (
        <p class="p-extra">
          {s.extraDamage.map((x) => `${extraName(x)} ${extraAmount(x)}`).join(" · ")}
        </p>
      )}
      {facts.length > 0 && (
        <p class="p-extra">
          {facts.map((f) => ui(`fact.${f.kind}` as UiKey, f.params)).join(" · ")}
        </p>
      )}
      {grow && <RuledArea />}
    </section>
  );
}

/** What spellcasting gives at a glance: the numbers and the slots (the spells themselves are on their pages). */
export function SpellcastingPanel({ grow = false }: { grow?: boolean }) {
  const c = content.value;
  const s = printSheet.value;
  const ch = character.value;
  const caster = s?.spellcasting;
  if (!c || !s || !caster) return null;
  const slots = caster.spellSlots.map((n, i) => ({ level: i + 1, n })).filter((x) => x.n > 0);
  return (
    <section class={`p-frame p-panel${grow ? " grow" : ""}`}>
      <h3 class="p-h">{ui("sheet.spellcasting")}</h3>
      <div class="p-stat-row">
        <div class="p-box">
          <b>{signed(caster.attackBonus)}</b>
          <span>{ui("sheet.spellAttack")}</span>
        </div>
        <div class="p-box">
          <b>{caster.saveDc}</b>
          <span>{ui("sheet.spellSaveDc")}</span>
        </div>
        <div class="p-box">
          <b>{c.name(`${ch.ruleset}:ability/${caster.ability}`).slice(0, 3)}</b>
          <span>{ui("sheet.spellAbility")}</span>
        </div>
      </div>
      <div class="p-slots">
        {slots.map((x) => (
          <div class="p-slotrow" key={x.level}>
            <span class="lvl">{ui("sheet.slotLevel", { level: x.level })}</span>
            <span>
              {Array.from({ length: x.n }, (_, i) => (
                <span class="p-pip" key={`slot-${x.level}-${i + 1}`} />
              ))}
            </span>
          </div>
        ))}
      </div>
      {s.pactSlots && (
        <p class="p-extra">
          {ui("sheet.pact", { count: s.pactSlots.count, level: s.pactSlots.level })}
        </p>
      )}
      {grow && <RuledArea />}
    </section>
  );
}

/** True when the spells are not printed on pages of their own, so the front has to list them. */
export const spellListOnFront = () => printSettings.value.spellMode === "none";

/** The names of the spells, by level, when there are no spell pages. */
export function FrontSpellList() {
  const c = content.value;
  const s = printSheet.value;
  if (!c || !s || !spellListOnFront()) return null;
  const spellRows = collectSpellRows(c, s);
  if (spellRows.length === 0) return null;
  const spellLevels = [...new Set(spellRows.map((r) => r.level))];
  return (
    <section class="p-frame p-panel grow">
      <h3 class="p-h">{ui("sheet.spellList")}</h3>
      {spellLevels.map((level) => (
        <div class="p-quick-row" key={level}>
          <span class="lvl">
            {level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}
          </span>
          <span class="items">
            {spellRows
              .filter((r) => r.level === level)
              .map((r) => (
                <span class="item" key={r.id}>
                  <span class={`p-pip${r.alwaysPrepared ? " on" : ""}`} />
                  {c.name(r.id)}
                </span>
              ))}
          </span>
        </div>
      ))}
    </section>
  );
}

/** Armor, weapons, tools and languages (the 2024 rules say armor training). */
export function ProficienciesPanel() {
  const c = content.value;
  const s = printSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const labels = {
    armor: is2024() ? "print.armorTraining" : "sheet.armor",
    weapon: "sheet.weapons",
    tool: "sheet.tools",
    language: "sheet.languages",
  } as const;
  const list = (category: (typeof PROFICIENCY_CATEGORIES)[number]) =>
    s.proficiencies[category]
      .map((t) =>
        category === "language"
          ? c.name(`${ch.ruleset}:language/${t}`)
          : c.name(`${ch.ruleset}:proficiency/${t}`),
      )
      .join(", ");
  return (
    <section class="p-frame p-panel">
      <h3 class="p-h">{ui(is2024() ? "print.training" : "sheet.proficiencies")}</h3>
      <dl class="p-prof">
        {PROFICIENCY_CATEGORIES.map((cat) => (
          <div key={cat}>
            <dt>{ui(labels[cat])}</dt>
            <dd>{list(cat) || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** The features the person wrote, and a box for notes that takes the room that is left. */
export function CustomAndNotes() {
  const ch = character.value;
  const custom = (ch.custom ?? []).filter((f) => f.name.trim() !== "");
  return (
    <>
      {custom.length > 0 && (
        <section class="p-frame p-panel">
          <h3 class="p-h">{ui("sheet.customFeatures")}</h3>
          <ul class="p-names">
            {custom.map((f) => (
              <li key={f.id}>
                {f.name}
                {f.uses ? ` (${f.uses})` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="p-frame p-panel grow p-notes">
        <h3 class="p-h">{ui("print.notes")}</h3>
        <RuledArea />
      </section>
    </>
  );
}
