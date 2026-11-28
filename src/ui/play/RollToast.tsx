import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { view } from "../../app/navigation";
import {
  type LogEntry,
  addBardicDie,
  addCheckBoost,
  addToRoll,
  boostsFor,
  keepBoostedUse,
  removeFromRoll,
  rerollOneDie,
  rerollWithInspiration,
  rollLog,
  setRollModeAfter,
} from "../../app/play";
import { character, content } from "../../app/store";
import type { D20Mode } from "../../engine/dice";
import { type RollParts, keptFace, partsTotal } from "../../engine/rollParts";
import { type UiKey, ui } from "../../i18n/ui";

/** How long a die tumbles before it lands, and how much later each next one lands. */
const TUMBLE_MS = 520;
const STAGGER_MS = 170;
/** How long the total takes to run up to its number. */
const COUNT_MS = 380;

/** The sparks of a critical hit, thrown out in every direction (they reuse the level-up ones). */
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  angle: Math.round((i / 22) * 360 + (i % 3) * 9),
  distance: 70 + ((i * 41) % 80),
  delay: (i % 5) * 0.03,
  size: 4 + (i % 3) * 2,
  tone: i % 3,
}));

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A twenty-sided die, drawn in the colour of the text around it (the DM's roll box uses it). */
export const Die = () => (
  <svg viewBox="0 0 24 24" class="toast-die" aria-hidden="true" focusable="false">
    <path
      d="M12 2.500l8 4.500v10l-8 4.500-8-4.500V7z M12 8l4 7H8z"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
    />
  </svg>
);

/** Moves the roll into the browser's top layer, above a dialog that is open (a popover that stays put). */
export function putOnTop(element: HTMLElement | null) {
  if (!element || typeof element.showPopover !== "function") return;
  element.setAttribute("popover", "manual");
  try {
    if (!element.matches(":popover-open")) element.showPopover();
  } catch {
    // Without the top layer it is a plain fixed box, which is fine.
  }
}

/** The outline of each die (a shape and a line of its facets), on a 44 by 44 grid; other dice are round. */
const SHAPES: Record<number, { shape: string; facet: string; y: number }> = {
  4: { shape: "M22 3 41 38H3z", facet: "M22 3V38", y: 28 },
  6: {
    shape: "M9 5h26a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4z",
    facet: "M12 10h20a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z",
    y: 22,
  },
  8: { shape: "M22 2 41 22 22 42 3 22z", facet: "M3 22H41", y: 22 },
  10: { shape: "M22 2 41 18 22 42 3 18z", facet: "M3 18 22 26 41 18M22 26V42", y: 20 },
  12: { shape: "M22 2 42 16 34 40H10L2 16z", facet: "M22 10 32 18 28 31H16L12 18z", y: 22 },
  20: { shape: "M22 2 40 12V32L22 42 4 32V12z", facet: "M22 9 33 28H11z", y: 21 },
};
const ROUND = { shape: "M22 3a19 19 0 1 1 0 38a19 19 0 1 1 0-38z", facet: "", y: 22 };

/** A die drawn in its own shape, with a number on it (or none, for the buttons that add one). */
export function DieShape({ sides, face }: { sides: number; face?: number }) {
  const s = SHAPES[sides] ?? ROUND;
  return (
    <svg viewBox="0 0 44 44" class="rt-svg" aria-hidden="true" focusable="false">
      <path class="rt-shape" d={s.shape} />
      {s.facet && <path class="rt-facet" d={s.facet} />}
      {face !== undefined && (
        <text class="rt-num" x="22" y={s.y}>
          {face}
        </text>
      )}
    </svg>
  );
}

/** Every key of the pieces of a roll: the dice it has already shown rolling are not rolled again. */
const keysOf = (parts: RollParts | undefined) => [
  ...(parts?.d20?.keys ?? []),
  ...(parts?.terms.map((t) => t.key) ?? []),
];

/** The pieces of an entry, or its bare total as one number. */
const piecesOf = (entry: LogEntry): RollParts =>
  entry.parts ?? {
    terms: [
      { key: -entry.id, value: Math.abs(entry.total ?? 0), sign: (entry.total ?? 0) < 0 ? -1 : 1 },
    ],
  };

/**
 * The latest roll, over the page. Each die is drawn in its own shape and tumbles before it lands, one after
 * another; then the total runs up to its number and settles (the gold glow and sparks of a critical hit, the
 * red shake of a natural 1). With advantage or disadvantage the die that does not count fades and is struck
 * out. The roll can be changed afterwards: a die or a number added or taken away, the d20 turned into advantage
 * or disadvantage. It stays until it is closed, or the next roll replaces it, and lives in the top layer, so it
 * shows over the dice drawer as well.
 */
export function RollToast() {
  const latest = rollLog.value[0];
  const [hidden, setHidden] = useState(true);
  // The roll whose dice are being offered for a reroll (Heroic Inspiration).
  const [choosingFor, setChoosingFor] = useState<number>();
  const [editing, setEditing] = useState(false);
  const [sign, setSign] = useState<1 | -1>(1);
  // The dice still tumbling, and a tick that changes the faces they show while they do.
  const [rolling, setRolling] = useState<Set<number>>(new Set());
  const [, setTick] = useState(0);
  const [shownTotal, setShownTotal] = useState<number>();
  const [settled, setSettled] = useState(false);
  const seen = useRef(new Set<number>());

  // The history that was there when the screen opened is not a roll to show.
  const [first] = useState(latest?.id);
  const fresh = latest && latest.id !== first && latest.total !== undefined ? latest : undefined;
  const parts = fresh ? piecesOf(fresh) : undefined;
  // A roll that carries on from the one on screen (a Bardic die, a die added) keeps the box; a new roll opens a new one.
  const chain = parts ? Math.min(...keysOf(parts)) : undefined;
  const run = fresh ? `${fresh.id}:${fresh.edits ?? 0}` : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new roll or a change of the roll is the trigger
  useEffect(() => {
    if (!fresh || !parts) return;
    setHidden(false);
    const target = partsTotal(parts);
    const newKeys = keysOf(parts).filter((k) => !seen.current.has(k));
    const carriesOn = newKeys.length < keysOf(parts).length;
    // Only dice tumble: a number put in shows at once.
    const diceKeys = new Set([
      ...(parts.d20?.keys ?? []),
      ...parts.terms.flatMap((t) => (t.sides === undefined ? [] : [t.key])),
    ]);
    const newDice = newKeys.filter((k) => diceKeys.has(k));
    if (!carriesOn) {
      setEditing(false);
      setSign(1);
      setChoosingFor(undefined);
      setShownTotal(undefined);
    }
    for (const k of keysOf(parts)) seen.current.add(k);
    const from = carriesOn ? (shownTotal ?? 0) : 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let frame = 0;
    const countUp = () => {
      if (reducedMotion() || from === target) {
        setShownTotal(target);
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / COUNT_MS);
        setShownTotal(Math.round(from + (target - from) * (1 - (1 - p) ** 3)));
        if (p < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };
    if (reducedMotion() || newDice.length === 0) {
      setRolling(new Set());
      setSettled(true);
      countUp();
    } else {
      setRolling(new Set(newDice));
      if (!carriesOn) setSettled(false);
      const spin = setInterval(() => setTick((t) => t + 1), 55);
      newDice.forEach((key, i) => {
        timers.push(
          setTimeout(
            () =>
              setRolling((now) => {
                const next = new Set(now);
                next.delete(key);
                return next;
              }),
            TUMBLE_MS + i * STAGGER_MS,
          ),
        );
      });
      timers.push(
        setTimeout(
          () => {
            clearInterval(spin);
            setSettled(true);
            countUp();
          },
          TUMBLE_MS + (newDice.length - 1) * STAGGER_MS + 120,
        ),
      );
      timers.push(spin as unknown as ReturnType<typeof setTimeout>);
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t);
        clearInterval(t);
      }
      cancelAnimationFrame(frame);
    };
  }, [run]);

  // Changing screen puts the old roll away; a roll made on any screen (the rules, with a monster
  // open, as well as Play) shows where it was made.
  const screen = view.value;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the screen is the trigger
  useEffect(() => {
    setHidden(true);
  }, [screen]);

  // The undo notice stays above the roll: it is told how tall the roll is (it grows with its buttons).
  useLayoutEffect(() => {
    const root = document.documentElement;
    const toast = document.querySelector<HTMLElement>(".roll-toast");
    if (toast) root.style.setProperty("--toast-space", `${toast.offsetHeight + 12}px`);
    else root.style.removeProperty("--toast-space");
  });

  if (!fresh || !parts || hidden) return null;
  const busy = rolling.size > 0 || !settled;
  const tone = busy ? "" : (fresh.tone ?? "");
  const d20 = parts.d20;
  const kept = d20 ? keptFace(d20) : 0;
  const twoD20 = d20 !== undefined && d20.faces.length > 1;
  const faceOf = (key: number, sides: number, value: number) =>
    rolling.has(key) ? 1 + Math.floor(Math.random() * sides) : value;
  const landed = (key: number) => !rolling.has(key);

  // A d20 roll that has landed can be taken again with the inspiration, or get the Bardic die.
  const play = character.value.play;
  const canReroll = !busy && fresh.redo !== undefined && play.inspiration;
  const canAddDie =
    !busy && fresh.redo !== undefined && !fresh.bardic && play.bardicDie !== undefined;
  // A check that landed can get the die of a feature that helps with failed checks (Tactical Mind), and a boosted
  // one can say it failed anyway, which gives the use back.
  const boosts = busy ? [] : boostsFor(fresh);
  const canKeep = !busy && fresh.boosted !== undefined;
  // The 2024 Heroic Inspiration rerolls any die, not only the d20: a roll of dice offers each of its dice.
  const rerollable = parts.terms.filter((t) => t.sides !== undefined);
  const canRerollDie =
    !busy &&
    fresh.redo === undefined &&
    rerollable.length > 0 &&
    play.inspiration &&
    character.value.ruleset === "srd52";
  const choosing = canRerollDie && choosingFor === fresh.id;
  const sources = [
    ...new Set(
      parts.terms.flatMap((t) =>
        t.source && t.sides !== undefined ? [`${t.source} d${t.sides}`] : [],
      ),
    ),
  ];
  const mode = d20?.mode ?? "normal";
  const shown = busy && shownTotal === undefined ? "·" : (shownTotal ?? fresh.total);

  return (
    <div
      class={`roll-toast roll-card no-print ${busy ? "rolling" : "settled"} ${tone}`}
      key={chain}
      aria-live="polite"
      ref={putOnTop}
    >
      <div class="rt-head">
        <b class="rt-label">{fresh.label}</b>
        {mode !== "normal" && (
          <span class={`rt-mode ${mode}${busy ? "" : " show"}`}>
            {ui(mode === "advantage" ? "play.rollWithAdvantage" : "play.rollWithDisadvantage")}
          </span>
        )}
      </div>
      <div class="rt-rule" aria-hidden="true">
        ◆
      </div>
      <div class="rt-main">
        <div class="rt-total">
          {tone === "critical" && !reducedMotion() && (
            <div class="lv-sparks toast-sparks" aria-hidden="true">
              {SPARKS.map((p) => (
                <i
                  key={`${p.angle}-${p.size}`}
                  class={`lv-spark tone-${p.tone}`}
                  style={{
                    "--a": `${p.angle}deg`,
                    "--d": `${p.distance}px`,
                    "--delay": `${p.delay}s`,
                    "--size": `${p.size}px`,
                  }}
                />
              ))}
            </div>
          )}
          <span class="toast-number" key={settled ? `t${fresh.edits ?? 0}` : "rolling"}>
            {shown}
          </span>
          <small>{ui("play.rollTotal")}</small>
        </div>
        <div class="rt-dice">
          <span class="sr-only">{fresh.detail}</span>
          {d20?.faces.map((face, i) => {
            const key = d20.keys[i] ?? i;
            const dropped = twoD20 && i !== kept && !busy;
            const raised = i === kept && d20.floor > face;
            return (
              <span
                key={key}
                class={`rt-die${i === kept || !twoD20 ? " kept" : ""}${dropped ? " drop" : ""}${rolling.has(key) ? " tumbling" : landed(key) ? " landed" : ""}`}
                aria-hidden="true"
              >
                <DieShape sides={20} face={faceOf(key, 20, face)} />
                <span class="rt-lab">{raised ? `d20 → ${d20.floor}` : "d20"}</span>
                {twoD20 && <i class="rt-strike" />}
              </span>
            );
          })}
          {parts.terms.map((t, i) => {
            const first = i === 0 && !d20;
            const op =
              first && t.sign > 0 ? null : (
                <span class={`rt-op${t.sign < 0 ? " minus" : ""}`} aria-hidden="true">
                  {t.sign < 0 ? "−" : "+"}
                </span>
              );
            const remove = t.added && (
              <button
                type="button"
                class="rt-remove"
                aria-label={ui("play.rollRemove", {
                  what: `${t.sign < 0 ? "−" : "+"}${t.sides === undefined ? t.value : `d${t.sides}`}`,
                })}
                onClick={() => removeFromRoll(fresh, t.key)}
              >
                ✕
              </button>
            );
            if (t.sides === undefined)
              return (
                <span key={t.key} class="rt-piece">
                  {op}
                  <span class={`rt-flat${t.added ? " added" : ""}${t.sign < 0 ? " minus" : ""}`}>
                    <span class="rt-flat-n" aria-hidden="true">
                      {t.value}
                    </span>
                    <span class="rt-lab" aria-hidden="true">
                      {t.added ? " " : ui("play.rollBonus")}
                    </span>
                    {remove}
                  </span>
                </span>
              );
            const sides = t.sides;
            return (
              <span key={t.key} class="rt-piece">
                {op}
                {choosing ? (
                  <button
                    type="button"
                    class="rt-die rt-pick kept"
                    aria-label={`${ui("play.rerollDieWhich")} ${t.value}`}
                    onClick={() => {
                      setChoosingFor(undefined);
                      rerollOneDie(fresh, t.key);
                    }}
                  >
                    <DieShape sides={sides} face={t.value} />
                    <span class="rt-lab">✦</span>
                  </button>
                ) : (
                  <span
                    class={`rt-die${d20 ? "" : " kept"}${t.added ? " added" : ""}${t.sign < 0 ? " minus" : ""}${rolling.has(t.key) ? " tumbling" : landed(t.key) ? " landed" : ""}`}
                    title={t.source}
                  >
                    <DieShape sides={sides} face={faceOf(t.key, sides, t.value)} />
                    <span class="rt-lab" aria-hidden="true">{`d${sides}`}</span>
                    {remove}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <em class={`toast-tone${tone ? "" : " pending"}`}>
        {tone === "fumble" ? ui("play.fumble") : tone === "critical" ? ui("play.critical") : " "}
      </em>
      {sources.length > 0 && (
        <p class="rt-included">{ui("play.rollIncluded", { list: sources.join(", ") })}</p>
      )}
      <div class="toast-actions rt-actions">
        <button
          type="button"
          class={`rt-btn${editing ? " on" : " primary"}`}
          aria-expanded={editing}
          onClick={() => setEditing(!editing)}
        >
          <span aria-hidden="true">{editing ? "▴" : "✎"}</span>
          {ui(editing ? "play.rollEditDone" : "play.rollEdit")}
        </button>
        {canRerollDie && !choosing && (
          <button type="button" class="rt-btn" onClick={() => setChoosingFor(fresh.id)}>
            <span aria-hidden="true">✦</span>
            {ui("play.rerollDie")}
          </button>
        )}
        {boosts.map((b) => (
          <button
            key={b.feature}
            type="button"
            class="rt-btn"
            title={ui("play.checkBoostHint", {
              feature: content.value?.name(b.spends) ?? b.spends,
            })}
            onClick={() => addCheckBoost(fresh, b.feature)}
          >
            <span aria-hidden="true">+</span>
            {`${content.value?.name(b.feature) ?? b.feature} +${b.dice}`}
          </button>
        ))}
        {canKeep && (
          <button type="button" class="rt-btn" onClick={() => keepBoostedUse(fresh)}>
            <span aria-hidden="true">↺</span>
            {ui("play.checkBoostFailed")}
          </button>
        )}
        {canAddDie && (
          <button type="button" class="rt-btn" onClick={() => addBardicDie(fresh)}>
            <span aria-hidden="true">♪</span>
            {ui("play.bardicAdd", { die: `d${play.bardicDie}` })}
          </button>
        )}
        {canReroll && (
          <button type="button" class="rt-btn" onClick={() => rerollWithInspiration(fresh)}>
            <span aria-hidden="true">✦</span>
            {ui("play.rerollSpend")}
          </button>
        )}
        <button
          type="button"
          class="rt-btn rt-close"
          aria-label={ui("spells.closeInfo")}
          title={ui("spells.closeInfo")}
          onClick={() => setHidden(true)}
        >
          ✕
        </button>
      </div>
      <div class={`rt-edit${editing ? " open" : ""}`} inert={!editing}>
        <div>
          <div class="rt-edit-in">
            <div class={`rt-sign${sign < 0 ? " minus" : ""}`}>
              <span class="rt-knob" />
              {([1, -1] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={sign === s}
                  class={sign === s ? "sel" : ""}
                  onClick={() => setSign(s)}
                >
                  {`${s > 0 ? "+" : "−"} ${ui(s > 0 ? "play.rollAdd" : "play.rollSubtract")}`}
                </button>
              ))}
            </div>
            <p class="rt-edit-h">{ui("play.rollEditDie")}</p>
            <div class="rt-palette">
              {[4, 6, 8, 10, 12, 20].map((sides) => (
                <button
                  key={sides}
                  type="button"
                  class="rt-add-die"
                  onClick={() => addToRoll(fresh, { sides, sign })}
                >
                  <DieShape sides={sides} />
                  <span>
                    <span class="rt-sg">{sign > 0 ? "+" : "−"}</span>
                    {`d${sides}`}
                  </span>
                </button>
              ))}
            </div>
            <p class="rt-edit-h">{ui("play.rollEditNumber")}</p>
            <div class="rt-numbers">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  class="rt-btn"
                  onClick={() => addToRoll(fresh, { value, sign })}
                >
                  {`${sign > 0 ? "+" : "−"}${value}`}
                </button>
              ))}
            </div>
            {d20 && (
              <>
                <p class="rt-edit-h">{ui("play.mode")}</p>
                <div class="rt-modes">
                  {(["normal", "advantage", "disadvantage"] as D20Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      class={`rt-btn${mode === m ? " on" : ""}`}
                      aria-pressed={mode === m}
                      onClick={() => setRollModeAfter(fresh, m)}
                    >
                      {ui(`play.mode.${m}` as UiKey)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
