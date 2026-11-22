import { useState } from "preact/hooks";
import { askConfirm } from "../../app/confirm";
import {
  closeTable,
  kickPlayer,
  openTable,
  tableBye,
  tableCode,
  tableState,
  tableView,
} from "../../app/table";
import { ui } from "../../i18n/ui";
import type { TablePlayer } from "../../relay/dmTable";

const STATE_TEXT = {
  connecting: "dm.table.state.connecting",
  online: "dm.table.state.online",
  retrying: "dm.table.state.retrying",
  ended: "dm.table.state.ended",
} as const;

/** One player at the table: whether they are here, and what their card says. */
function Seat({ p }: { p: TablePlayer }) {
  const card = p.card;
  const conditions = card && card.conditions.length > 0 ? ` · ${card.conditions.join(", ")}` : "";
  return (
    <li class="dm-seat" data-online={p.online}>
      <span
        class="dm-live"
        data-state={p.online ? "online" : "retrying"}
        role="img"
        aria-label={p.online ? ui("dm.table.here") : ui("dm.table.away")}
      />
      <div class="dm-seat-body">
        <b>{p.name || ui("dm.unnamed")}</b>
        {card ? (
          <small>
            {ui("dm.table.card", { hp: card.hp + card.tempHp, max: card.maxHp, ac: card.ac })}
            {conditions}
          </small>
        ) : (
          <small class="muted">{ui("dm.table.noCard")}</small>
        )}
      </div>
      <button
        type="button"
        class="secondary dm-seat-kick"
        aria-label={ui("dm.table.kick", { name: p.name })}
        title={ui("dm.table.kick", { name: p.name })}
        onClick={() => kickPlayer(p.seat)}
      >
        ✕
      </button>
    </li>
  );
}

const endedText = () => {
  const why = tableBye.value;
  if (why === "replaced") return ui("dm.table.endedReplaced");
  if (why === "closed" || why === "expired") return ui("dm.table.endedClosed");
  return ui("dm.table.endedOther");
};

/** The online table of the open campaign: open it, give the code, see who is there and what they shared. */
export function TableBlock({ campaignId }: { campaignId: string }) {
  const code = tableCode.value;
  const state = tableState.value;
  const [copied, setCopied] = useState(false);
  const view = tableView.value;

  if (!code)
    return (
      <section class="dm-online">
        <h3>{ui("dm.table.title")}</h3>
        <p class="muted">{ui("dm.table.intro")}</p>
        <button type="button" onClick={() => void openTable(campaignId)}>
          {ui("dm.table.open")}
        </button>
      </section>
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The code is on the screen: it can be read out.
    }
  };

  return (
    <section class="dm-online">
      <h3>{ui("dm.table.title")}</h3>
      {state === "ended" ? (
        <div class="dm-online-ended">
          <p>{endedText()}</p>
          <button type="button" onClick={() => void openTable(campaignId)}>
            {ui("dm.table.openAgain")}
          </button>
        </div>
      ) : (
        <>
          <div class="dm-online-code-row">
            <span
              class="dm-live"
              data-state={state}
              role="img"
              aria-label={ui(STATE_TEXT[state])}
            />
            <div>
              <small>{ui("dm.table.code")}</small>
              <b class="dm-code">{code}</b>
            </div>
            <button type="button" class="secondary" onClick={() => void copy()}>
              {copied ? ui("dm.table.copied") : ui("dm.table.copy")}
            </button>
          </div>
          <p class="muted">{ui(STATE_TEXT[state])}</p>
          <h4>{ui("dm.table.players")}</h4>
          {view.players.length === 0 ? (
            <p class="muted">{ui("dm.table.none")}</p>
          ) : (
            <ul class="plain dm-seats">
              {view.players.map((p) => (
                <Seat key={p.seat} p={p} />
              ))}
            </ul>
          )}
          {view.rolls.length > 0 && (
            <>
              <h4>{ui("dm.table.rolls")}</h4>
              <ul class="plain dm-shared-rolls">
                {view.rolls.slice(0, 8).map((r) => (
                  <li key={`${r.seat}-${r.at}-${r.roll.label}`} data-tone={r.roll.tone}>
                    <b>{r.name}</b> {r.roll.label}: {r.roll.detail}
                    {r.roll.total !== undefined ? ` = ${r.roll.total}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div class="dm-online-danger">
            <button
              type="button"
              class="danger-btn"
              onClick={async () => {
                const ok = await askConfirm({
                  title: ui("dm.table.closeAsk"),
                  confirm: ui("dm.table.close"),
                  cancel: ui("confirm.cancel"),
                });
                if (ok) await closeTable(campaignId);
              }}
            >
              {ui("dm.table.close")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
