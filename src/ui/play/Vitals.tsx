import { useState } from "preact/hooks";
import { addLog, changePlay, damageCharacter, rollCheck, vitals } from "../../app/play";
import { character } from "../../app/store";
import { cryptoRandomInt } from "../../engine/dice";
import {
  applyHealing,
  currentHp,
  deathSaveRoll,
  deathStatus,
  gainTempHp,
  hitDiceLeft,
  revive,
  setDeathSave,
  spendHitDie,
} from "../../engine/play";
import { type UiKey, ui } from "../../i18n/ui";
import { Roll } from "../Roll";
import { Panel } from "../sheet/parts";
import { DamageButtons } from "./DamageButtons";
import { HealIcon } from "./icons";

export function HitPoints() {
  const [amount, setAmount] = useState("");
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const hp = currentHp(play, v.max);
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const apply = (change: (amount: number) => void) => {
    if (n === 0) return;
    change(n);
    setAmount("");
  };
  const percent = v.max > 0 ? Math.round((hp / v.max) * 100) : 0;

  return (
    <Panel title={ui("play.hitPoints")}>
      <output class="hp-readout">
        <Roll as="b" class={hp === 0 ? "zero" : ""}>
          {hp}
        </Roll>
        <span>{ui("play.of", { max: v.max })}</span>
        {play.tempHp > 0 && <em>{ui("play.temp", { n: play.tempHp })}</em>}
      </output>
      {play.wildShape && (
        <p class="muted">
          {ui(play.wildShape.own ? "play.wildShape.noteOwn" : "play.wildShape.note")}
        </p>
      )}
      {play.raging && <p class="muted">{ui("play.rage.note")}</p>}
      <div
        class="hp-bar"
        data-state={hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well"}
        role="img"
        aria-label={`${hp} ${ui("play.of", { max: v.max })}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div class="hp-quick">
        {[10, 5, 1].map((a) => (
          <button
            type="button"
            key={`d${a}`}
            class="danger-btn"
            aria-label={ui("play.damageBy", { n: a })}
            onClick={() => damageCharacter(a)}
          >
            {"\u2212"}
            {a}
          </button>
        ))}
        {[1, 5, 10].map((a) => (
          <button
            type="button"
            key={`h${a}`}
            aria-label={ui("play.healBy", { n: a })}
            onClick={() => changePlay((p) => applyHealing(p, v.max, a))}
          >
            +{a}
          </button>
        ))}
      </div>
      <div class="hp-controls">
        <label class="field">
          <span>{ui("play.amount")}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={amount}
            onInput={(e) => setAmount(e.currentTarget.value)}
          />
        </label>
        <div class="btn-row">
          <DamageButtons amount={n} apply={(dealt) => apply(() => damageCharacter(dealt))} />
          <button
            type="button"
            disabled={n === 0}
            onClick={() => apply((a) => changePlay((p) => applyHealing(p, v.max, a)))}
          >
            {ui("play.heal")}
          </button>
          <button
            type="button"
            disabled={n === 0}
            onClick={() => apply((a) => changePlay((p) => gainTempHp(p, a)))}
          >
            {ui("play.tempHp")}
          </button>
        </div>
      </div>
    </Panel>
  );
}

export function DeathSaves() {
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const status = deathStatus(play, v.max);
  if (status === "alive" && play.deathSaves.successes === 0 && play.deathSaves.failures === 0)
    return null;

  const card = (kind: "successes" | "failures", label: UiKey, glyph: string) => (
    <li class="play-card death-card" data-kind={kind}>
      <span class="card-badge" aria-hidden="true">
        {glyph}
      </span>
      <div class="card-head">
        <b class="feat-name">{ui(label)}</b>
        <span class="card-meta">{play.deathSaves[kind]} / 3</span>
      </div>
      <span class="pips-btns death-pips">
        {[1, 2, 3].map((n) => {
          const on = play.deathSaves[kind] >= n;
          return (
            <button
              type="button"
              key={n}
              class={`pip-btn${on ? " on" : ""}`}
              aria-pressed={on}
              aria-label={`${ui(label)} ${n}`}
              onClick={() =>
                changePlay((p) => setDeathSave(p, kind, p.deathSaves[kind] === n ? n - 1 : n))
              }
            />
          );
        })}
      </span>
    </li>
  );

  return (
    <Panel title={ui("play.deathSaves")} className="death-panel">
      {status !== "alive" && (
        <output class={`death-status status-${status}`}>
          <b>{ui(`play.status.${status}` as UiKey)}</b>
          {status === "dead" && (
            <button
              type="button"
              class="card-btn card-revive"
              onClick={() => {
                changePlay((p) => revive(p));
                addLog({ label: ui("play.revive"), detail: ui("play.reviveDetail") });
              }}
            >
              {ui("play.revive")}
            </button>
          )}
          {status === "dying" && (
            <button
              type="button"
              class="card-btn card-primary card-wide"
              onClick={() => {
                const roll = rollCheck(ui("play.deathSaves"), 0);
                changePlay((p) => deathSaveRoll(p, v.max, roll.used));
              }}
            >
              {ui("play.deathSaveRoll")}
            </button>
          )}
        </output>
      )}
      <ul class="plain card-list">
        {card("successes", "play.successes", "✓")}
        {card("failures", "play.failures", "✕")}
      </ul>
    </Panel>
  );
}

export function HitDice() {
  const v = vitals();
  const play = character.value.play;
  if (!v) return null;
  const dice = Object.entries(v.hitDice);
  if (dice.length === 0) return null;
  const bonus = v.conMod === 0 ? "" : v.conMod > 0 ? `+${v.conMod}` : `${v.conMod}`;

  return (
    <Panel title={ui("play.hitDice")} className="hitdice-panel">
      <ul class="plain card-list">
        {dice.map(([die, total]) => {
          const left = hitDiceLeft(play, die, total);
          return (
            <li class="play-card die-card" key={die} data-empty={left === 0 ? "true" : undefined}>
              <span class="card-badge" aria-hidden="true">
                {die}
              </span>
              <div class="card-head">
                <b class="feat-name">
                  {ui("play.hitDice")} {die}
                </b>
                <span class="card-meta">{ui("play.hitDiceLeft", { left, total })}</span>
              </div>
              <span
                class="slot-dots die-dots"
                role="img"
                aria-label={ui("play.hitDiceLeft", { left, total })}
              >
                {Array.from({ length: total }, (_, i) => (
                  <i key={`${die}-${i + 1}`} class={i < left ? "on" : ""} />
                ))}
              </span>
              <div class="card-actions">
                <button
                  type="button"
                  class="card-btn card-primary card-wide card-roll card-heal"
                  disabled={left === 0}
                  onClick={() => {
                    const rolled = 1 + cryptoRandomInt(Number(die.slice(1)));
                    const heal = Math.max(0, rolled + v.conMod);
                    changePlay((p) => spendHitDie(p, v.max, die, rolled, v.conMod));
                    addLog({
                      label: `${ui("play.hitDice")} ${die}`,
                      detail: `${die} ${rolled}${v.conMod === 0 ? "" : v.conMod > 0 ? ` +${v.conMod}` : ` ${v.conMod}`} → ${ui("play.healedBy", { n: heal })}`,
                      total: heal,
                    });
                  }}
                >
                  <HealIcon />
                  <span>{ui("play.spendDie")}</span>
                  <b>
                    {die}
                    {bonus}
                  </b>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/** Hit points, death saves, hit dice and rests: what changes most during a session. */
export function Vitals() {
  return (
    <>
      <HitPoints />
      <DeathSaves />
      <HitDice />
    </>
  );
}
