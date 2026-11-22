import {
  answerInitiative,
  initiativeAsked,
  joinedCode,
  mySeat,
  myTurn,
  trackerView,
} from "../../app/playerTable";
import { ui } from "../../i18n/ui";

/**
 * At the top of the Play screen while the player is at an online table: the round, whose turn it is (in gold when it
 * is theirs), the order from now on with their own line marked, and the DM's ask for the initiative.
 */
export function TableStrip() {
  const view = trackerView.value;
  const asked = initiativeAsked.value;
  if (!joinedCode.value) return null;
  const fighting = view !== undefined && view.round > 0;
  if (!asked && !fighting) return null;
  const seat = mySeat.value;
  const at = fighting ? view.order.findIndex((c) => c.id === view.turn) : -1;
  const order = fighting && at >= 0 ? [...view.order.slice(at), ...view.order.slice(0, at)] : [];
  const now = order[0];
  const mine = myTurn.value;
  return (
    <section class="table-strip" data-mine={mine || undefined} aria-label={ui("dm.table.title")}>
      {fighting && (
        <div class="table-strip-head">
          <small class="table-strip-round">{ui("table.tracker.round", { n: view.round })}</small>
          <b>{mine ? ui("table.yourTurn") : now ? ui("table.turnOf", { name: now.name }) : ""}</b>
        </div>
      )}
      {asked && (
        <div class="table-strip-ask">
          <span>{ui("table.initiative.ask")}</span>
          <button type="button" class="table-strip-roll" onClick={answerInitiative}>
            {ui("table.initiative.roll")}
          </button>
        </div>
      )}
      {order.length > 1 && (
        <ol class="plain table-strip-order">
          {order.map((c) => (
            <li
              key={c.id}
              data-mine={(seat !== undefined && c.seat === seat) || undefined}
              data-player={c.seat ? true : undefined}
            >
              {c.name}
              {seat !== undefined && c.seat === seat && ` · ${ui("table.you")}`}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
