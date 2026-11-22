import { useState } from "preact/hooks";
import { ui } from "../i18n/ui";
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
}: {
  state: TableLinkState;
  code?: string;
  /** "2 of 3 here": the long line of a wide screen. */
  count?: string;
  /** The number a phone shows beside the dot. */
  short?: string;
  /** With no table, the word beside the crossed sign on a wide screen. */
  label?: string;
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
      {short !== undefined && (
        <span class="table-chip-short" aria-hidden="true">
          {short}
        </span>
      )}
    </span>
  );
}

/**
 * The player's side of the online table: the same pill, and a panel to join the DM's table with a code. Only the look
 * for now: joining is not built yet, so the button stays off.
 */
export function PlayerTableChip() {
  const [code, setCode] = useState("");
  return (
    <Popover
      align="end"
      class="table-chip-pop"
      title={ui("dm.table.title")}
      label={<TableChipFace state="offline" label={ui("table.none")} />}
    >
      <div class="table-join">
        <h2 class="popover-heading">{ui("dm.table.title")}</h2>
        <p class="muted">{ui("table.join.intro")}</p>
        <form
          class="table-join-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <label class="field">
            <span>{ui("table.join.code")}</span>
            <input
              type="text"
              value={code}
              maxLength={6}
              autoComplete="off"
              autoCapitalize="characters"
              spellcheck={false}
              placeholder="ABC123"
              onInput={(e) => setCode(e.currentTarget.value.toUpperCase())}
            />
          </label>
          <button type="submit" class="primary" disabled>
            {ui("table.join.button")}
          </button>
        </form>
        <p class="muted table-join-soon">{ui("table.join.soon")}</p>
      </div>
    </Popover>
  );
}
