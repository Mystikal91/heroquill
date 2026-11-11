import { useEffect, useState } from "preact/hooks";
import { view } from "../../app/navigation";
import { addBardicDie, rerollWithInspiration, rollLog } from "../../app/play";
import { character } from "../../app/store";
import { ui } from "../../i18n/ui";

const ROLLING_MS = 560;

/** The sparks of a critical hit, thrown out in every direction (they reuse the level-up ones). */
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  angle: Math.round((i / 22) * 360 + (i % 3) * 9),
  distance: 70 + ((i * 41) % 80),
  delay: (i % 5) * 0.03,
  size: 4 + (i % 3) * 2,
  tone: i % 3,
}));

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A twenty-sided die, drawn in the colour of the text around it. */
const Die = () => (
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
function putOnTop(element: HTMLElement | null) {
  if (!element || typeof element.showPopover !== "function") return;
  element.setAttribute("popover", "manual");
  try {
    if (!element.matches(":popover-open")) element.showPopover();
  } catch {
    // Without the top layer it is a plain fixed box, which is fine.
  }
}

/**
 * The latest roll, big, over the page: the die spins and the numbers run for half a second, then
 * the total settles (gold for a critical hit, dull red for a natural 1). It stays until it is
 * tapped, or the next roll replaces it. It lives in the top layer, so it shows over the dice
 * drawer as well.
 */
export function RollToast() {
  const latest = rollLog.value[0];
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState(0);
  const [hidden, setHidden] = useState(true);

  // The history that was there when the screen opened is not a roll to show.
  const [first] = useState(latest?.id);
  const fresh = latest && latest.id !== first && latest.total !== undefined ? latest : undefined;

  const freshId = fresh?.id;
  const freshTotal = fresh?.total;
  useEffect(() => {
    if (freshId === undefined) return;
    setHidden(false);
    const timers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];
    if (reducedMotion()) {
      setRolling(false);
    } else {
      setRolling(true);
      const max = Math.max(20, Math.abs(freshTotal ?? 20));
      setFace(1 + Math.floor(Math.random() * max));
      const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * max)), 55);
      timers.push(spin);
      timers.push(
        setTimeout(() => {
          clearInterval(spin);
          setRolling(false);
        }, ROLLING_MS),
      );
    }
    return () => {
      for (const t of timers) {
        clearTimeout(t as ReturnType<typeof setTimeout>);
        clearInterval(t as ReturnType<typeof setInterval>);
      }
    };
  }, [freshId, freshTotal]);

  // Changing screen puts the old roll away; a roll made on any screen (the rules, with a monster
  // open, as well as Play) shows where it was made.
  const screen = view.value;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the screen is the trigger
  useEffect(() => {
    setHidden(true);
  }, [screen]);

  if (!fresh || hidden) return null;
  const tone = rolling ? "" : (fresh.tone ?? "");
  // A d20 roll that has landed can be taken again with the inspiration, or get the Bardic die.
  const play = character.value.play;
  const canReroll = !rolling && fresh.redo !== undefined && play.inspiration;
  const canAddDie =
    !rolling && fresh.redo !== undefined && !fresh.bardic && play.bardicDie !== undefined;
  return (
    <div
      class={`roll-toast no-print ${rolling ? "rolling" : "settled"} ${tone}`}
      key={fresh.id}
      aria-live="polite"
      ref={putOnTop}
    >
      <button type="button" class="toast-main" onClick={() => setHidden(true)}>
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
        <Die />
        <span class="toast-number">{rolling ? face : fresh.total}</span>
        <span class="toast-text">
          <b>{fresh.label}</b>
          {/* Both lines are always there, hidden until the roll lands, so the box never changes size. */}
          <small class={rolling ? "pending" : ""}>{fresh.detail || " "}</small>
          <em class={`toast-tone${tone ? "" : " pending"}`}>
            {tone === "fumble"
              ? ui("play.fumble")
              : tone === "critical"
                ? ui("play.critical")
                : " "}
          </em>
          <small class="toast-hint">{ui("play.tapToClose")}</small>
        </span>
      </button>
      {(canReroll || canAddDie) && (
        <div class="toast-actions">
          {canAddDie && (
            <button type="button" class="toast-act" onClick={() => addBardicDie(fresh)}>
              <span aria-hidden="true">♪</span>
              {ui("play.bardicAdd", { die: `d${play.bardicDie}` })}
            </button>
          )}
          {canReroll && (
            <button type="button" class="toast-act" onClick={() => rerollWithInspiration(fresh)}>
              <span aria-hidden="true">✦</span>
              {ui("play.rerollSpend")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
