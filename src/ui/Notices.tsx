import { useEffect, useRef } from "preact/hooks";
import { confirmRequest } from "../app/confirm";
import { dismissUndo, takeUndo, undoOffer } from "../app/undo";
import { ui } from "../i18n/ui";

/** The line at the bottom that says what was just removed, with the button that brings it back. */
export function UndoNotice() {
  const offer = undoOffer.value;
  if (!offer) return null;
  return (
    <output class="undo-notice no-print" key={offer.id}>
      <span>{offer.label}</span>
      <button type="button" class="link" onClick={() => void takeUndo()}>
        {ui("bar.undo")}
      </button>
      <button
        type="button"
        class="undo-close"
        aria-label={ui("spells.closeInfo")}
        onClick={dismissUndo}
      >
        ✕
      </button>
    </output>
  );
}

/** The question for what cannot be taken back, as a dialog of the app. Mount it once, near the root. */
export function ConfirmDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = confirmRequest.value;
  /** The app itself closed the dialog (a question was answered): the closing event that follows is not a refusal. */
  const closedByApp = useRef(false);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (request && !el.open) el.showModal();
    if (!request && el.open) {
      closedByApp.current = true;
      el.close();
    }
  }, [request]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the buttons are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog confirm-dialog"
      aria-labelledby="confirm-title"
      onClose={() => {
        // The event comes after the closing, when the next question may already be up: only Escape is a refusal.
        if (closedByApp.current) closedByApp.current = false;
        else confirmRequest.value?.answer(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) confirmRequest.value?.answer(false);
      }}
    >
      {request && (
        <div class="spell-dialog-body">
          <h3 id="confirm-title">{request.title}</h3>
          <div class="confirm-actions">
            <button type="button" class="secondary" onClick={() => request.answer(false)}>
              {request.cancel}
            </button>
            <button type="button" class="danger-btn" onClick={() => request.answer(true)}>
              {request.confirm}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
