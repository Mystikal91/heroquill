import { useEffect, useState } from "preact/hooks";
import {
  answerInitiative,
  dmMessages,
  dmOnline,
  initiativeAsked,
  joinTable,
  joinedCode,
  leaveTable,
  playerBye,
  playerState,
  resumeTable,
  tellDm,
  trackerView,
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

/** The order of the fight the DM shows: who is up, and how hurt the monsters look. */
function Tracker({ view }: { view: TrackerView }) {
  return (
    <section class="table-tracker">
      <h3 class="popover-heading">
        {ui("table.tracker.title")} · {ui("table.tracker.round", { n: view.round })}
      </h3>
      <ol class="plain">
        {view.order.map((c) => (
          <li key={c.id} aria-current={c.id === view.turn ? "true" : undefined}>
            <b>{c.name}</b>
            {c.band && <small>{ui(BANDS[c.band])}</small>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the DM wrote, and a line to the DM. */
function Talk() {
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const heard = dmMessages.value;
  return (
    <section class="table-talk">
      <h3 class="popover-heading">{ui("table.msg.title")}</h3>
      {heard.length > 0 && (
        <ul class="plain table-heard">
          {heard.slice(0, 4).map((m) => (
            <li key={m.at}>
              <small>{ui("table.msg.fromDm")}</small> {m.text}
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
        <label class="field">
          <span>{ui("table.msg.toDm")}</span>
          <input
            type="text"
            value={text}
            maxLength={400}
            autoComplete="off"
            onInput={(e) => {
              setFailed(false);
              setText(e.currentTarget.value);
            }}
          />
        </label>
        <button type="submit" class="primary" disabled={text.trim() === ""}>
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
      count={here ? ui("table.dmHere") : ui("table.dmAway")}
      short={here ? "✓" : "…"}
    />
  );
  return (
    <Popover align="end" class="table-chip-pop" title={ui("dm.table.title")} label={face}>
      <div class="table-join">
        <h2 class="popover-heading">{ui("dm.table.title")}</h2>
        {!joined || ended ? (
          <>
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
              <label class="field">
                <span>{ui("table.join.code")}</span>
                <input
                  type="text"
                  value={code}
                  maxLength={7}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellcheck={false}
                  placeholder="ABC123"
                  onInput={(e) => {
                    setBad(false);
                    setCode(e.currentTarget.value.toUpperCase());
                  }}
                />
              </label>
              <button type="submit" class="primary" disabled={code.trim().length === 0}>
                {ui("table.join.button")}
              </button>
            </form>
            {bad && <p class="table-join-soon">{ui("table.join.badCode")}</p>}
            <p class="muted">{ui("table.join.preview")}</p>
          </>
        ) : (
          <>
            <p>{ui(STATE_TEXT[state])}</p>
            {state === "online" && !here && <p class="muted">{ui("table.dmAwayLong")}</p>}
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
            <p class="muted">{ui("table.join.preview")}</p>
            <button type="button" class="secondary" onClick={leaveTable}>
              {ui("table.leave")}
            </button>
          </>
        )}
      </div>
    </Popover>
  );
}
