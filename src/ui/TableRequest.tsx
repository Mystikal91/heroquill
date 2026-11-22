import { useEffect, useRef } from "preact/hooks";
import {
  answerRequest,
  dmMessages,
  joinedCode,
  readDmMessages,
  tableRequest,
} from "../app/playerTable";
import { signed, ui } from "../i18n/ui";
import { DieIcon } from "./icons";

/**
 * What the DM asks of the player at the online table, in a card of its own (from the bottom on a phone): what is
 * asked, the player's own bonus and the difficulty for a roll, and the answer. A roll stays with its total and
 * whether it beat the difficulty until the card is closed.
 */
export function TableRequestCard() {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = tableRequest.value;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (request && !node.open) node.showModal();
    if (!request && node.open) node.close();
  }, [request]);
  if (!request) return null;
  const { proposal, outcome } = request;
  const roll = proposal.kind === "roll" ? proposal : undefined;
  // Escape, the back button or a tap outside: no to a question, closed once the roll is made.
  const dismiss = () => answerRequest(Boolean(outcome));
  return (
    <dialog
      ref={dialog}
      class="table-request"
      aria-labelledby="table-request-title"
      onCancel={(e) => {
        e.preventDefault();
        dismiss();
      }}
      onClose={() => {
        if (tableRequest.peek()) dismiss();
      }}
    >
      <div class="treq">
        <div class="treq-head">
          <span class="treq-mark" data-kind={proposal.kind} aria-hidden="true">
            {proposal.kind === "roll" ? <DieIcon /> : "!"}
          </span>
          <div>
            <small>
              {proposal.kind === "roll"
                ? ui("table.req.asks", { from: request.from })
                : proposal.kind === "damage"
                  ? ui("table.req.dealt", { from: request.from })
                  : ui("table.req.applied", { from: request.from })}
            </small>
            <h3 id="table-request-title">{request.what}</h3>
          </div>
        </div>
        {roll && (
          <div class="treq-numbers">
            <div>
              <small>{outcome ? ui("table.req.total") : ui("table.req.bonus")}</small>
              <b>
                {outcome
                  ? outcome.total
                  : request.bonus !== undefined
                    ? signed(request.bonus)
                    : "—"}
              </b>
            </div>
            {roll.dc !== undefined && (
              <div>
                <small>{ui("table.req.dc")}</small>
                <b>{roll.dc}</b>
              </div>
            )}
          </div>
        )}
        {outcome?.success !== undefined && (
          <p class="treq-result" data-success={outcome.success}>
            {ui(outcome.success ? "table.req.success" : "table.req.failure")}
          </p>
        )}
        <div class="treq-actions">
          {outcome ? (
            <button type="button" class="primary" onClick={() => answerRequest(true)}>
              {ui("table.req.close")}
            </button>
          ) : (
            <>
              <button type="button" class="secondary" onClick={() => answerRequest(false)}>
                {ui("table.proposal.decline")}
              </button>
              <button type="button" class="primary" onClick={() => answerRequest(true)}>
                {roll
                  ? request.bonus !== undefined
                    ? ui("table.req.rollWith", { bonus: signed(request.bonus) })
                    : ui("table.proposal.roll")
                  : ui("table.proposal.accept")}
              </button>
            </>
          )}
        </div>
        <p class="muted treq-note">
          {roll ? ui("table.req.rollNote") : ui("table.req.acceptNote")}
        </p>
      </div>
    </dialog>
  );
}

/** The newest line of the DM not read yet, as a notice that does not stop the game; closing it marks them read. */
export function DmMessageNotice() {
  const unread = dmMessages.value.filter((m) => !m.read);
  const newest = unread[0];
  if (!joinedCode.value || !newest) return null;
  return (
    <output class="dm-message-notice no-print">
      <small>{ui("table.msg.fromDmShort")}</small>
      <p>
        {newest.text}
        {unread.length > 1 && (
          <span class="muted"> {ui("table.msg.more", { n: unread.length - 1 })}</span>
        )}
      </p>
      <button
        type="button"
        class="dm-message-close"
        aria-label={ui("table.msg.markRead")}
        title={ui("table.msg.markRead")}
        onClick={readDmMessages}
      >
        ✕
      </button>
    </output>
  );
}
