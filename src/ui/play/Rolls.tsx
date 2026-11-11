import { useState } from "preact/hooks";
import {
  type LogEntry,
  clearLog,
  rollCheck,
  rollDiceText,
  rollLog,
  rollMode,
} from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { ABILITIES, type Ability } from "../../data/schema";
import type { D20Mode } from "../../engine/dice";
import type { ExhaustionRoll } from "../../engine/exhaustion";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { Panel } from "../sheet/parts";
import { AttackCards, ExtraCards } from "./AttackCards";

const MODES: D20Mode[] = ["normal", "advantage", "disadvantage"];
const DICE = [4, 6, 8, 10, 12, 20, 100];

function RollButton({
  label,
  bonus,
  name = label,
  floor,
  ability,
  check,
  kind,
}: {
  label: string;
  bonus: number;
  name?: string;
  /** The ability the roll belongs to: its colour is the diamond before the name. */
  ability?: Ability;
  /** A die lower than this counts as this (Reliable Talent). */
  floor?: number | undefined;
  /** An ability check (a skill), which a feature can add to when it fails. */
  check?: boolean;
  /** An ability check, an attack roll or a saving throw (the 2014 exhaustion gives disadvantage on them). */
  kind?: ExhaustionRoll;
}) {
  return (
    <button
      type="button"
      class="roll-btn"
      data-ability={ability}
      onClick={() => rollCheck(name, bonus, floor ? { floor } : undefined, check, kind, ability)}
    >
      <span>{label}</span>
      <b>{signed(bonus)}</b>
    </button>
  );
}

/** Advantage, disadvantage or a normal roll for every d20 check below. */
export function ModePicker() {
  const mode = rollMode.value;
  return (
    <fieldset class="segmented">
      <legend class="sr-only">{ui("play.mode")}</legend>
      {MODES.map((m) => (
        <button
          type="button"
          key={m}
          class={mode === m ? "on" : ""}
          aria-pressed={mode === m}
          onClick={() => {
            rollMode.value = m;
          }}
        >
          {ui(`play.mode.${m}` as UiKey)}
        </button>
      ))}
    </fieldset>
  );
}

/** The checks (initiative, saves, skills) or the attacks that roll with one tap. */
function RollsPanel({ part }: { part: "attacks" | "checks" }) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const ruleset = "srd51";
  const skills = [...s.skills].sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));

  return (
    <Panel title={ui(part === "attacks" ? "play.attacks" : "play.rolls")}>
      <ModePicker />
      {part === "attacks" && s.attacksPerAction > 1 && (
        <p class="muted attacks-per-action">
          {ui("sheet.attacksPerAction", { n: s.attacksPerAction })}
        </p>
      )}
      {part === "checks" && (
        <>
          <ul class="plain ability-legend" aria-label={ui("play.abilityLegend")}>
            {ABILITIES.map((a) => (
              <li key={a} data-ability={a}>
                {c.text(`${ruleset}:ability/${a}`, "abbreviation") ?? a}
              </li>
            ))}
          </ul>
          <h4>{ui("play.initiative")}</h4>
          <div class="roll-grid">
            <RollButton
              label={ui("play.initiative")}
              bonus={s.initiative}
              ability="dex"
              kind="check"
            />
          </div>
          <h4>{ui("play.saves")}</h4>
          <div class="roll-grid">
            {ABILITIES.map((a) => (
              <RollButton
                key={a}
                label={c.text(`${ruleset}:ability/${a}`, "abbreviation") ?? a}
                name={`${c.name(`${ruleset}:ability/${a}`)} - ${ui("sheet.savingThrow")}`}
                bonus={s.saves[a].bonus}
                ability={a}
                kind="save"
              />
            ))}
          </div>
          <h4>{ui("play.skills")}</h4>
          <div class="roll-grid">
            {skills.map((sk) => (
              <RollButton
                key={sk.id}
                label={c.name(sk.id)}
                bonus={sk.bonus}
                ability={sk.ability}
                check
                floor={sk.proficient ? s.proficientSkillFloor : undefined}
              />
            ))}
          </div>
        </>
      )}
      {part === "attacks" && character.value.play.wildShape && (
        <p class="muted">{ui("play.wildShape.attacks")}</p>
      )}
      {part === "attacks" && sheet.value?.armorClass.untrained && (
        <p class="note">{ui("armor.untrained")}</p>
      )}
      {part === "attacks" && <AttackCards />}
      {part === "attacks" && <ExtraCards />}
    </Panel>
  );
}

export const AttackRolls = () => <RollsPanel part="attacks" />;
export const CheckRolls = () => <RollsPanel part="checks" />;

/** Plain dice and a box for expressions like 2d6+3. */
export function DiceTray() {
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    const ok = rollDiceText(text.trim(), text);
    setInvalid(!ok);
    if (ok) setText("");
  };

  return (
    <Panel title={ui("play.dice")}>
      <div class="dice-row">
        {DICE.map((sides) => (
          <button
            type="button"
            class="die"
            key={sides}
            onClick={() => rollDiceText(`d${sides}`, `d${sides}`)}
          >
            d{sides}
          </button>
        ))}
      </div>
      <form
        class="dice-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label class="field">
          <span>{ui("play.customDice")}</span>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder={ui("play.customPlaceholder")}
            value={text}
            aria-invalid={invalid}
            onInput={(e) => {
              setText(e.currentTarget.value);
              setInvalid(false);
            }}
          />
        </label>
        <button type="submit">{ui("play.roll")}</button>
      </form>
      {invalid && (
        <p class="note" role="alert">
          {ui("play.invalidDice")}
        </p>
      )}
    </Panel>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  return (
    <li class={entry.tone ?? ""}>
      <span class="log-label">{entry.label}</span>
      {entry.detail && <span class="muted log-detail">{entry.detail}</span>}
      {entry.total !== undefined && <b class="log-total">{entry.total}</b>}
      {entry.tone && <em>{entry.tone === "critical" ? ui("play.critical") : ui("play.fumble")}</em>}
    </li>
  );
}

/** The latest rolls, newest first. */
export function RollHistory() {
  const log = rollLog.value;
  return (
    <Panel title={ui("play.log")}>
      {log.length === 0 ? (
        <p class="muted">{ui("play.logEmpty")}</p>
      ) : (
        <>
          <ol class="roll-log">
            {log.map((entry) => (
              <LogLine key={entry.id} entry={entry} />
            ))}
          </ol>
          <button type="button" class="link" onClick={clearLog}>
            {ui("play.clearLog")}
          </button>
        </>
      )}
    </Panel>
  );
}
