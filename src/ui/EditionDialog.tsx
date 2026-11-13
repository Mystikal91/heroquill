import { useEffect, useRef } from "preact/hooks";
import { editionRequest } from "../app/edition";
import { ui } from "../i18n/ui";

/** "Which rules?": the first question when a character is made. Mount it once, near the root. */
export function EditionDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = editionRequest.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (request && !el.open) el.showModal();
    if (!request && el.open) el.close();
  }, [request]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the buttons are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog edition-dialog"
      aria-labelledby="edition-title"
      onClose={() => editionRequest.value?.answer(undefined)}
      onClick={(e) => {
        if (e.target === e.currentTarget) editionRequest.value?.answer(undefined);
      }}
    >
      {request && (
        <div class="spell-dialog-body">
          <h3 id="edition-title">{ui("edition.title")}</h3>
          <p class="muted">{ui("edition.fixed")}</p>
          <p class="edition-hint">{ui("edition.hint")}</p>
          <div class="edition-options">
            <button type="button" class="edition-option" onClick={() => request.answer("srd51")}>
              <b>{ui("edition.srd51.name")}</b>
              <span>{ui("edition.srd51.desc")}</span>
            </button>
            <button type="button" class="edition-option" onClick={() => request.answer("srd52")}>
              <b>{ui("edition.srd52.name")}</b>
              <span>{ui("edition.srd52.desc")}</span>
            </button>
          </div>
          <div class="confirm-actions">
            <button type="button" class="secondary" onClick={() => request.answer(undefined)}>
              {ui("confirm.cancel")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
