import { useEffect, useState } from "preact/hooks";
import {
  answerInitiative,
  dmMessages,
  dmOnline,
  initiativeAsked,
  joinTable,
  joinedCode,
  leaveTable,
  mySeat,
  myTurn,
  playerBye,
  playerState,
  readDmMessages,
  resumeTable,
  sentMessages,
  tableAttention,
  tellDm,
  trackerView,
  unreadFromDm,
} from "../app/playerTable";
import { ui } from "../i18n/ui";
import type { ByeReason, TrackerView } from "../relay/protocol";
import { Popover } from "./Popover";
import { OfflineIcon } from "./icons";

/** How the link to an online table is: open and connected, on its way, lost for a moment, or no table at all. */
export type TableLinkState = "online" | "connecting" | "retrying" | "offline";

/**
 * What the pill of the online table shows, in the header beside the menu: a dot in the colour of the link (or a
 * crossed sign with no table), and on a wide screen the code and who is there; on a phone only the dot and a number.
 */
export function TableChipFace({
  state,
  code,
  count,
  short,
  label,
  badge,
  alert,
}: {
  state: TableLinkState;
  code?: string;
  /** "2 of 3 here": the long line of a wide screen. */
  count?: string;
  /** The number a phone shows beside the dot. */
  short?: string;
  /** With no table, the word beside the crossed sign on a wide screen. */
  label?: string;
  /** Lines waiting to be read. */
  badge?: number;
  /** Something waits for the player: their turn, the initiative, a request. */
  alert?: boolean;
}) {
  return (
    <span class="table-chip-face" data-state={state}>
      {state === "offline" ? (
        <OfflineIcon />
      ) : (
        <span class="table-dot" data-state={state} aria-hidden="true" />
      )}
      {code && <span class="table-chip-code">{code}</span>}
      {(count ?? label) && <span class="table-chip-count">{count ?? label}</span>}
      {alert && (
        <span class="table-chip-alert" role="img" aria-label={ui("table.attention")}>
          !
        </span>
      )}
      {badge !== undefined && badge > 0 && (
        <span class="table-chip-badge" role="img" aria-label={ui("dm.msg.unread", { n: badge })}>
          ✉ {badge}
        </span>
      )}
      {short !== undefined && (
        <span class="table-chip-short" aria-hidden="true">
          {short}
        </span>
      )}
    </span>
  );
}

const endedKey = (bye: ByeReason | undefined) => {
  switch (bye) {
    case "closed":
    case "expired":
      return "table.ended.closed";
    case "kicked":
      return "table.ended.kicked";
    case "no-room":
      return "table.ended.noRoom";
    case "full":
      return "table.ended.full";
    default:
      return "table.ended.other";
  }
};

const STATE_TEXT = {
  connecting: "table.state.connecting",
  online: "table.state.online",
  retrying: "table.state.retrying",
  ended: "table.state.online",
} as const;

const BANDS = {
  unhurt: "table.band.unhurt",
  hurt: "table.band.hurt",
  bloodied: "table.band.bloodied",
  down: "table.band.down",
} as const;

/** The order of the fight the DM shows: who is up, the player's own line, and how hurt the monsters look. */
function Tracker({ view }: { view: TrackerView }) {
  const seat = mySeat.value;
  return (
    <section class="table-tracker">
      <div class="table-sec-head">
        <h3 class="popover-heading">{ui("table.tracker.title")}</h3>
        <small class="muted">{ui("table.tracker.round", { n: view.round })}</small>
      </div>
      <ol class="plain">
        {view.order.map((c) => {
          const mine = seat !== undefined && c.seat === seat;
          const now = c.id === view.turn;
          return (
            <li
              key={c.id}
              aria-current={now ? "true" : undefined}
              data-mine={mine || undefined}
              data-player={c.seat ? true : undefined}
            >
              <span class="table-init">{c.initiative ?? "—"}</span>
              <span class="table-who">
                {c.name}
                {mine && <span class="table-you">{ui("table.you")}</span>}
              </span>
              <small>
                {now && mine
                  ? ui("table.yourTurn")
                  : now
                    ? ui("table.nowActs")
                    : c.band
                      ? ui(BANDS[c.band])
                      : ""}
              </small>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The lines with the DM, as a conversation (theirs on the left, the player's on the right), and a line to the DM. */
function Talk() {
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const lines = [
    ...dmMessages.value.map((m) => ({ mine: false, text: m.text, at: m.at })),
    ...sentMessages.value.map((m) => ({ mine: true, text: m.text, at: m.at })),
  ]
    .sort((a, b) => a.at - b.at)
    .slice(-6);
  return (
    <section class="table-talk">
      <h3 class="popover-heading">{ui("table.msg.title")}</h3>
      {lines.length > 0 && (
        <ul class="plain table-heard">
          {lines.map((m) => (
            <li key={`${m.at}-${m.mine}`} data-mine={m.mine || undefined}>
              {!m.mine && <small>{ui("table.msg.fromDmShort")}</small>}
              {m.text}
            </li>
          ))}
        </ul>
      )}
      <form
        class="table-join-form"
        onSubmit={(e) => {
          e.preventDefault();
          const ok = tellDm(text);
          setFailed(!ok);
          if (ok) setText("");
        }}
      >
        <input
          type="text"
          value={text}
          maxLength={400}
          autoComplete="off"
          aria-label={ui("table.msg.toDm")}
          placeholder={ui("table.msg.placeholder")}
          onInput={(e) => {
            setFailed(false);
            setText(e.currentTarget.value);
          }}
        />
        <button type="submit" disabled={text.trim() === ""}>
          {ui("table.msg.send")}
        </button>
      </form>
      {failed && <p class="table-join-soon">{ui("table.msg.notSent")}</p>}
    </section>
  );
}

/** The player's side of the online table: the pill in the header, and a panel to join, follow and leave the DM's table. */
export function PlayerTableChip() {
  const [code, setCode] = useState("");
  const [bad, setBad] = useState(false);
  useEffect(() => resumeTable(), []);
  const joined = joinedCode.value;
  const state = playerState.value;
  const ended = joined !== undefined && state === "ended";
  const here = dmOnline.value;
  const face = !joined ? (
    <TableChipFace state="offline" label={ui("table.none")} />
  ) : ended ? (
    <TableChipFace state="offline" code={joined} />
  ) : (
    <TableChipFace
      state={state === "online" ? "online" : state === "retrying" ? "retrying" : "connecting"}
      code={joined}
      count={myTurn.value ? ui("table.yourTurn") : here ? ui("table.dmHere") : ui("table.dmAway")}
      short=""
      badge={unreadFromDm.value}
      alert={tableAttention.value}
    />
  );
  return (
    <Popover
      align="end"
      class="table-chip-pop"
      title={ui("dm.table.title")}
      label={face}
      keepOpen
      onOpen={readDmMessages}
    >
      <div class="table-join">
        {!joined || ended ? (
          <>
            <h2 class="popover-heading">{ui("dm.table.title")}</h2>
            {ended && <p>{ui(endedKey(playerBye.value))}</p>}
            <p class="muted">{ui("table.join.intro")}</p>
            <form
              class="table-join-form"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = joinTable(code);
                setBad(!ok);
                if (ok) setCode("");
              }}
            >
              <input
                type="text"
                class="table-code-field"
                value={code}
                maxLength={7}
                autoComplete="off"
                autoCapitalize="characters"
                spellcheck={false}
                placeholder="ABC123"
                aria-label={ui("table.join.code")}
                onInput={(e) => {
                  setBad(false);
                  setCode(e.currentTarget.value.toUpperCase());
                }}
              />
              <button type="submit" class="primary" disabled={code.trim().length === 0}>
                {ui("table.join.button")}
              </button>
            </form>
            {bad && <p class="table-join-soon">{ui("table.join.badCode")}</p>}
            <details class="table-privacy">
              <summary>{ui("table.privacy")}</summary>
              <p class="muted">{ui("table.join.preview")}</p>
            </details>
          </>
        ) : (
          <>
            <div class="table-status">
              <span
                class="table-dot"
                data-state={state === "online" ? "online" : "retrying"}
                aria-hidden="true"
              />
              <div>
                <b class="table-chip-code">{joined}</b>
                <small class="muted">
                  {state === "online"
                    ? here
                      ? ui("table.status.here")
                      : ui("table.status.away")
                    : ui(STATE_TEXT[state])}
                </small>
              </div>
            </div>
            {initiativeAsked.value && (
              <div class="table-ask">
                <p>{ui("table.initiative.ask")}</p>
                <button type="button" class="primary" onClick={answerInitiative}>
                  {ui("table.initiative.roll")}
                </button>
              </div>
            )}
            {trackerView.value && trackerView.value.round > 0 && (
              <Tracker view={trackerView.value} />
            )}
            <Talk />
            <div class="table-foot">
              <details class="table-privacy">
                <summary>{ui("table.privacy")}</summary>
                <p class="muted">{ui("table.join.preview")}</p>
              </details>
              <button type="button" class="table-leave" onClick={leaveTable}>
                {ui("table.leave")}
              </button>
            </div>
          </>
        )}
      </div>
    </Popover>
  );
}
