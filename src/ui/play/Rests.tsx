import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { addLog, changePlay, vitals } from "../../app/play";
import { sheet } from "../../app/store";
import { longRest, shortRest } from "../../engine/play";
import { ui } from "../../i18n/ui";
import { Panel } from "../sheet/parts";
import { prepareAsked, preparingCasters } from "./PrepareSpells";
import { FlameIcon, MoonIcon } from "./icons";

/** The long rest is asked about in a dialog of the app, not in the browser's own box. */
const longRestAsked = signal(false);

/** Short and long rest: what each gives back to this character, and the buttons to take them. */
export function Rests() {
  const v = vitals();
  const s = sheet.value;
  if (!v || !s) return null;
  // A lone warlock gets every slot back; a multiclass warlock only the separate pact slots.
  const onlyWarlock = s.spellcasters.length === 1 && s.spellcasters[0]?.pact;
  const recovers = s.pactSlots ? "pact" : onlyWarlock ? "all" : "none";
  const shortUses = s.resources.filter((r) => r.recovery === "short");
  const shortSome = s.resources.filter((r) => r.shortRegain !== undefined);
  const hasSlots = s.spellcasters.length > 0;

  const shortChips = [
    ...(recovers === "none"
      ? []
      : [ui(recovers === "pact" ? "play.restChipPact" : "play.restChipSlots")]),
    ...(shortUses.length > 0 || shortSome.length > 0 ? [ui("play.restChipUses")] : []),
  ];
  const longChips = [
    ui("play.restChipHp"),
    ...(hasSlots ? [ui("play.restChipSlots")] : []),
    ui("play.restChipDice"),
    ...(s.resources.length > 0 ? [ui("play.restChipUses")] : []),
  ];

  const takeShort = () => {
    changePlay((p) =>
      shortRest(
        p,
        recovers,
        shortUses.map((r) => r.id),
        shortSome.map((r) => ({ id: r.id, count: r.shortRegain ?? 0 })),
      ),
    );
    addLog({ label: ui("play.shortRestLog"), detail: "" });
  };

  return (
    <Panel title={ui("play.rests")} className="rests-panel">
      <ul class="plain card-list">
        <li class="play-card rest-card" data-rest="short">
          <span class="card-badge" aria-hidden="true">
            <FlameIcon />
          </span>
          <div class="card-head">
            <b class="feat-name">{ui("play.shortRest")}</b>
            <span class="card-meta">{ui("play.restShortTime")}</span>
          </div>
          <p class="rest-text">{ui("play.shortRestHint")}</p>
          {shortChips.length > 0 && (
            <ul class="plain rest-chips">
              {shortChips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          )}
          <div class="card-actions">
            <button type="button" class="card-btn card-wide" onClick={takeShort}>
              {ui("play.shortRest")}
            </button>
          </div>
        </li>
        <li class="play-card rest-card" data-rest="long">
          <span class="card-badge" aria-hidden="true">
            <MoonIcon />
          </span>
          <div class="card-head">
            <b class="feat-name">{ui("play.longRest")}</b>
            <span class="card-meta">{ui("play.restLongTime")}</span>
          </div>
          <ul class="plain rest-chips">
            {longChips.map((chip) => (
              <li key={chip}>{chip}</li>
            ))}
          </ul>
          <div class="card-actions">
            <button
              type="button"
              class="card-btn card-primary card-wide"
              onClick={() => {
                longRestAsked.value = true;
              }}
            >
              {ui("play.longRest")}
            </button>
          </div>
        </li>
      </ul>
      <LongRestDialog />
    </Panel>
  );
}

/** What a long rest does, and the choice to take it or not. */
function LongRestDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const asked = longRestAsked.value;
  const v = vitals();
  const prepares = preparingCasters(sheet.value).length > 0;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (asked && !el.open) el.showModal();
    if (!asked && el.open) el.close();
  }, [asked]);

  const close = () => {
    longRestAsked.value = false;
  };
  const effects = [
    ui("play.restChipHp"),
    ui("play.restChipSlots"),
    ui("play.restChipDice"),
    ui("play.restChipUses"),
    ui("play.longRestDeath"),
    ui("play.longRestEnds"),
    ...(prepares ? [ui("play.longRestPrepare")] : []),
  ];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the buttons are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog rest-dialog"
      aria-labelledby="long-rest-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {asked && (
        <div class="spell-dialog-body">
          <div class="rest-dialog-head">
            <span class="card-badge" aria-hidden="true">
              <MoonIcon />
            </span>
            <h3 id="long-rest-title">{ui("play.longRestTitle")}</h3>
          </div>
          <ul class="plain rest-effects">
            {effects.map((effect) => (
              <li key={effect}>{effect}</li>
            ))}
          </ul>
          <div class="card-actions rest-dialog-actions">
            <button type="button" class="card-btn" onClick={close}>
              {ui("play.longRestCancel")}
            </button>
            <button
              type="button"
              class="card-btn card-primary"
              onClick={() => {
                if (v) changePlay((p) => longRest(p, v.hitDice));
                addLog({ label: ui("play.longRestLog"), detail: "" });
                close();
                // The step after the rest: a reminder to change the spells that are prepared.
                if (prepares) prepareAsked.value = "rest";
              }}
            >
              {ui("play.longRestGo")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
