import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";
import { addLog, changePlay, rollLog } from "../../app/play";
import { character } from "../../app/store";
import { offerUndo } from "../../app/undo";
import {
  type CastOption,
  type CastSources,
  canPay,
  castOptions,
  payCast,
  planCast,
  refundCast,
} from "../../engine/casting";
import { ui } from "../../i18n/ui";
import { reserveName } from "../reserveName";

/** A spell (or Divine Smite) that the person wants to cast. */
export interface CastRequest {
  name: string;
  /** Without an id nothing but slots can pay for it. */
  spell: { id?: string; level: number };
  /** The slot level picked on the card. */
  wanted?: number | undefined;
  sources: CastSources;
  /** The dice at a slot level, when they are worth showing beside it. */
  dice?: ((level: number) => string | undefined) | undefined;
  /** After it was paid for. */
  onCast?: ((option: CastOption) => void) | undefined;
  onUndo?: (() => void) | undefined;
}

/** The cast that waits for the person to say what to pay with, and whose it is. */
const asked = signal<(CastRequest & { owner: string }) | undefined>(undefined);

const optionsNow = (request: CastRequest) =>
  castOptions(character.value.play, request.spell, request.sources);

const keyOf = (option: CastOption) =>
  `${option.kind} ${option.level} ${"id" in option ? option.id : ""}`;

const reserveLabel = (option: CastOption) =>
  option.kind === "points" ? reserveName(option.id.replace(/^reserve:/, "")).toLowerCase() : "";

/** "Cast with a level 2 slot": what the history and the notice say. */
function paidText(option: CastOption): string {
  if (option.kind === "points")
    return ui("play.castPoints", { n: option.cost, reserve: reserveLabel(option) });
  if (option.kind === "free") return ui("play.castFree");
  return ui(option.kind === "pact" ? "play.castPact" : "play.castSlot", { level: option.level });
}

const leftText = (option: CastOption) =>
  ui("play.leftOf", { left: option.left, total: option.total });

/** Writes a cast in the history and says it in the notice, which can take it back. */
export function announceCast(name: string, text: string, left = "", undo?: () => boolean) {
  addLog({ label: name, detail: text });
  const entry = rollLog.value[0];
  const owner = character.value.id;
  offerUndo(`${name}: ${text}${left && ` (${left})`}`, () => {
    // Another character may be open by now: theirs is not to be touched.
    if (character.value.id !== owner) return;
    if (undo?.() === false) return;
    rollLog.value = rollLog.value.filter((x) => x !== entry);
  });
}

/** Pays for the spell, says it, and offers to take it back. Nothing happens when it can be paid no more. */
function spend(request: CastRequest, wanted: CastOption) {
  const option = optionsNow(request).find((o) => keyOf(o) === keyOf(wanted));
  if (!option || !canPay(option)) return;
  changePlay((p) => payCast(p, option));
  const after = optionsNow(request).find((o) => keyOf(o) === keyOf(option));
  announceCast(request.name, paidText(option), after && leftText(after), () => {
    const before = character.value.play;
    if (refundCast(before, option) === before) return false;
    changePlay((p) => refundCast(p, option));
    request.onUndo?.();
    return true;
  });
  request.onCast?.(option);
}

/** Casts: spends what is meant at once, or opens the window when the person has to say. */
export function startCast(request: CastRequest) {
  const plan = planCast(optionsNow(request), request.wanted);
  if (plan.type === "spend") spend(request, plan.option);
  else if (plan.type === "ask") asked.value = { ...request, owner: character.value.id };
}

/** What an option is called in the window. */
function optionName(option: CastOption): string {
  if (option.kind === "free") return ui("play.castWithFree");
  if (option.kind === "points") return `${option.cost} ${reserveLabel(option)}`;
  return ui(option.kind === "pact" ? "play.pact" : "play.castWithSlot", { level: option.level });
}

/** The window that asks what to pay for a spell with. Only what can pay is in it. */
export function CastDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  // Another character was opened, or nothing can pay any more: there is nothing left to ask.
  const asking = asked.value?.owner === character.value.id ? asked.value : undefined;
  const options = asking ? optionsNow(asking).filter(canPay) : [];
  const request = options.length > 0 ? asking : undefined;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (request && !el.open) el.showModal();
    if (!request && el.open) el.close();
  }, [request]);

  const close = () => {
    asked.value = undefined;
  };
  // A question left behind (another screen) does not come back by itself.
  useEffect(
    () => () => {
      asked.value = undefined;
    },
    [],
  );
  const free = options.some((o) => o.kind === "free");

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog cast-dialog"
      aria-labelledby="cast-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {request && (
        <div class="spell-dialog-body">
          <h3 id="cast-title">{request.name}</h3>
          <p class="muted">
            {free
              ? ui("play.castAskFree")
              : ui("play.castAskSlot", { level: request.wanted ?? request.spell.level })}
          </p>
          <div class="cast-options">
            {options.map((option) => {
              // At what level a free use casts it is in the words of its feature only.
              const dice = option.kind === "free" ? undefined : request.dice?.(option.level);
              return (
                <button
                  key={keyOf(option)}
                  type="button"
                  class="card-btn cast-option"
                  onClick={() => {
                    close();
                    spend(request, option);
                  }}
                >
                  <b>{optionName(option)}</b>
                  {dice && <span>{dice}</span>}
                  <small>{leftText(option)}</small>
                </button>
              );
            })}
          </div>
          <div class="card-actions cast-cancel">
            <button type="button" class="card-btn" onClick={close}>
              {ui("confirm.cancel")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
