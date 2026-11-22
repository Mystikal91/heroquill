import { useEffect, useRef, useState } from "preact/hooks";
import { askConfirm } from "../../app/confirm";
import { campaign, dmRuleset } from "../../app/dm";
import { browse } from "../../app/search";
import { content } from "../../app/store";
import {
  closeTable,
  kickPlayer,
  openTable,
  propose,
  readMessages,
  seatOpen,
  tableBye,
  tableCode,
  tablePanel,
  tableState,
  tableUnread,
  tableView,
  tellPlayers,
} from "../../app/table";
import { ui } from "../../i18n/ui";
import {
  type ProposalRecord,
  type TableActivity,
  type TablePlayer,
  tableActivity,
} from "../../relay/dmTable";
import { ABILITY_KEYS, type AbilityKey } from "../../relay/protocol";

const STATE_TEXT = {
  connecting: "dm.table.state.connecting",
  online: "dm.table.state.online",
  retrying: "dm.table.state.retrying",
  ended: "dm.table.state.ended",
} as const;

const closePanel = () => {
  tablePanel.value = undefined;
};

/** The first word of a name, for the chips that pick who a roll or a line is for. */
const short = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Who a roll or a line goes to: everyone here, or one of them. */
function WhoChips({
  players,
  who,
  setWho,
}: {
  players: TablePlayer[];
  who: string;
  setWho: (who: string) => void;
}) {
  return (
    <fieldset class="tbl-chips">
      <legend class="sr-only">{ui("dm.ask.who")}</legend>
      <button type="button" aria-pressed={who === "all"} onClick={() => setWho("all")}>
        {ui("dm.ask.all")}
      </button>
      {players.map((p) => (
        <button
          type="button"
          key={p.seat}
          aria-pressed={who === p.seat}
          onClick={() => setWho(p.seat)}
        >
          {short(p.name || ui("dm.unnamed"))}
        </button>
      ))}
    </fieldset>
  );
}

/** A saving throw, an ability check or a skill check asked of one player or all those here, with a difficulty if wanted. */
function AskRoll({ players }: { players: TablePlayer[] }) {
  const c = content.value;
  const preset = tablePanel.value?.who;
  const [who, setWho] = useState(preset ?? "all");
  useEffect(() => {
    if (preset) setWho(preset);
  }, [preset]);
  const [test, setTest] = useState<"save" | "check" | "skill">("save");
  const [ability, setAbility] = useState<AbilityKey>("wis");
  const [skill, setSkill] = useState("");
  const [dc, setDc] = useState("");
  const skills = c ? browse(c, "skill", dmRuleset.value) : [];
  const skillId = skill || skills[0]?.id || "";
  const abilityName = (a: string) => c?.name(`srd51:ability/${a}`) ?? a;
  const abbreviation = (a: string) => c?.text(`srd51:ability/${a}`, "abbreviation") ?? a;
  const target = players.find((p) => p.seat === who);
  const ask = () => {
    if (!c) return;
    const wanted = who === "all" ? players : players.filter((p) => p.seat === who);
    const typed = Number.parseInt(dc, 10);
    const difficulty = Number.isFinite(typed) && typed > 0 ? Math.min(typed, 40) : undefined;
    const skillAbility = c.index.get(skillId)?.data.ability;
    const skillKey = ABILITY_KEYS.find((a) => a === skillAbility);
    for (const p of wanted) {
      const spec =
        test === "skill"
          ? skillKey
            ? ({ test: "check", ability: skillKey, skill: skillId } as const)
            : undefined
          : ({ test, ability } as const);
      if (!spec) continue;
      const base =
        test === "skill"
          ? ui("dm.prop.rollSkill", { name: p.name, skill: c.name(skillId) })
          : ui(test === "save" ? "dm.prop.rollSave" : "dm.prop.rollCheck", {
              name: p.name,
              ability: abilityName(ability),
            });
      propose(
        p.seat,
        { kind: "roll", ...spec, ...(difficulty !== undefined && { dc: difficulty }) },
        base + (difficulty !== undefined ? ui("dm.prop.dc", { dc: difficulty }) : ""),
      );
    }
  };
  if (players.length === 0) return <p class="muted tbl-foot-note">{ui("dm.ask.nobody")}</p>;
  return (
    <div class="tbl-ask">
      <span class="tbl-foot-title">{ui("dm.ask.title")}</span>
      <WhoChips players={players} who={who} setWho={setWho} />
      <fieldset class="tbl-chips">
        <legend class="sr-only">{ui("dm.ask.type")}</legend>
        {(["save", "check", "skill"] as const).map((t) => (
          <button type="button" key={t} aria-pressed={test === t} onClick={() => setTest(t)}>
            {ui(
              t === "save"
                ? "dm.ask.save"
                : t === "check"
                  ? "dm.ask.checkShort"
                  : "dm.ask.skillShort",
            )}
          </button>
        ))}
      </fieldset>
      {test === "skill" ? (
        <select
          aria-label={ui("dm.ask.skillField")}
          value={skillId}
          onChange={(e) => setSkill(e.currentTarget.value)}
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : (
        <fieldset class="tbl-abilities">
          <legend class="sr-only">{ui("dm.ask.ability")}</legend>
          {ABILITY_KEYS.map((a) => (
            <button
              type="button"
              key={a}
              aria-pressed={ability === a}
              title={abilityName(a)}
              onClick={() => setAbility(a)}
            >
              {abbreviation(a)}
            </button>
          ))}
        </fieldset>
      )}
      <div class="tbl-ask-send">
        <label class="tbl-dc">
          <span>{ui("dm.ask.dcShort")}</span>
          <input
            type="number"
            min={1}
            max={40}
            inputMode="numeric"
            placeholder="—"
            aria-label={ui("dm.ask.dc")}
            value={dc}
            onInput={(e) => setDc(e.currentTarget.value)}
          />
        </label>
        <button type="button" class="primary" onClick={ask}>
          {target ? ui("dm.ask.sendTo", { name: short(target.name) }) : ui("dm.ask.sendAll")}
        </button>
      </div>
    </div>
  );
}

/** A line of text to one player or to all those here. */
function Compose({ players }: { players: TablePlayer[] }) {
  const preset = tablePanel.value?.who;
  const [who, setWho] = useState(preset ?? "all");
  useEffect(() => {
    if (preset) setWho(preset);
  }, [preset]);
  const [text, setText] = useState("");
  const send = () => {
    const seats = who === "all" ? players.map((p) => p.seat) : [who];
    tellPlayers(seats, text, new Map(players.map((p) => [p.seat, p.name])));
    setText("");
  };
  if (players.length === 0) return <p class="muted tbl-foot-note">{ui("dm.ask.nobody")}</p>;
  return (
    <form
      class="tbl-compose"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) send();
      }}
    >
      <WhoChips players={players} who={who} setWho={setWho} />
      <div class="tbl-compose-row">
        <input
          type="text"
          maxLength={400}
          value={text}
          aria-label={ui("dm.msg.field")}
          placeholder={ui("dm.msg.placeholder")}
          onInput={(e) => setText(e.currentTarget.value)}
        />
        <button type="submit" class="primary" disabled={text.trim() === ""}>
          {ui("dm.msg.button")}
        </button>
      </div>
    </form>
  );
}

/** One player at the table: whether they are here, their numbers, and what the DM can do with them. */
function PlayerCardRow({ p }: { p: TablePlayer }) {
  const card = p.card;
  const percent = card && card.maxHp > 0 ? Math.round((card.hp / card.maxHp) * 100) : 0;
  const state = !card
    ? undefined
    : card.hp === 0
      ? "down"
      : percent <= 25
        ? "low"
        : percent <= 50
          ? "hurt"
          : "well";
  return (
    <li class="tbl-player" data-online={p.online || undefined}>
      <div class="tbl-player-head">
        <span
          class="dm-live"
          data-state={p.online ? "online" : "retrying"}
          role="img"
          aria-label={p.online ? ui("dm.table.here") : ui("dm.table.away")}
        />
        <div class="tbl-player-name">
          <b>{p.name || ui("dm.unnamed")}</b>
          <small class="muted">
            {[card?.cls, p.online ? "" : ui("dm.table.away")].filter(Boolean).join(" · ")}
          </small>
        </div>
        <button
          type="button"
          class="tbl-kick"
          aria-label={ui("dm.table.kick", { name: p.name })}
          title={ui("dm.table.kick", { name: p.name })}
          onClick={() => kickPlayer(p.seat)}
        >
          ✕
        </button>
      </div>
      {card ? (
        <div class="tbl-player-nums">
          <div class="tbl-hp">
            <span>
              <b>{card.hp}</b>
              <span class="muted"> / {card.maxHp}</span>
              {card.tempHp > 0 && <em> +{card.tempHp}</em>}
            </span>
            <span class="dm-hp-bar" data-state={state} aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          </div>
          <div class="tbl-num">
            <small>{ui("dm.col.ac")}</small>
            <b>{card.ac}</b>
          </div>
          <div class="tbl-num">
            <small>{ui("dm.col.init")}</small>
            <b>{p.initiative ?? "—"}</b>
          </div>
        </div>
      ) : (
        <p class="muted tbl-no-card">{ui("dm.table.noCard")}</p>
      )}
      {card && card.conditions.length > 0 && (
        <div class="tbl-conditions">
          {card.conditions.map((name) => (
            <span key={name} class="dm-fx-chip">
              {name}
            </span>
          ))}
        </div>
      )}
      <div class="tbl-player-actions">
        <button
          type="button"
          disabled={!p.online}
          onClick={() => {
            tablePanel.value = { tab: "players", who: p.seat };
          }}
        >
          {ui("dm.ask.title")}
        </button>
        <button
          type="button"
          disabled={!p.online}
          onClick={() => {
            tablePanel.value = { tab: "activity", who: p.seat };
          }}
        >
          {ui("dm.msg.write")}
        </button>
        <button
          type="button"
          onClick={() => {
            seatOpen.value = p.seat;
          }}
        >
          {ui("dm.seat.sheet")}
        </button>
      </div>
    </li>
  );
}

/** What came of a proposal, in words: waiting, declined, or for a roll the total and whether it beat the difficulty. */
function outcome(p: ProposalRecord): string {
  if (p.kind === "say") return ui(p.status === "accepted" ? "dm.prop.read" : `dm.prop.${p.status}`);
  return ui(`dm.prop.${p.status}`);
}

const DieMark = () => (
  <svg
    viewBox="0 0 24 24"
    width="15"
    height="15"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    aria-hidden="true"
  >
    <path d="M12 3l8 5v8l-8 5-8-5V8z" />
  </svg>
);

/** One line of the activity: a roll, a line from a player, a line of the DM, or what came of a request. */
function ActivityLine({ item, names }: { item: TableActivity; names: Map<string, string> }) {
  if (item.kind === "message") {
    const m = item.message;
    return (
      <li class="tbl-feed-item" data-kind="message">
        <span class="tbl-feed-mark" data-kind="player" aria-hidden="true">
          {(m.name || "?").charAt(0).toUpperCase()}
        </span>
        <div class="tbl-feed-body">
          <span>
            <b>{m.name}</b> <small class="muted">{ui("dm.msg.wrote")}</small>
          </span>
          <span class="tbl-bubble">{m.text}</span>
        </div>
      </li>
    );
  }
  if (item.kind === "roll") {
    const r = item.roll;
    return (
      <li class="tbl-feed-item" data-kind="roll">
        <span class="tbl-feed-mark" data-kind="roll" aria-hidden="true">
          <DieMark />
        </span>
        <div class="tbl-feed-body">
          <span>
            <b>{r.name}</b> · {r.roll.label}
          </span>
          <span class="tbl-feed-result">
            {r.roll.total !== undefined && <b>{r.roll.total}</b>}
            <small class="muted">{r.roll.detail}</small>
            {r.roll.tone && (
              <span class={r.roll.tone === "critical" ? "tbl-ok" : "tbl-ko"}>
                {ui(r.roll.tone === "critical" ? "play.critical" : "play.fumble")}
              </span>
            )}
          </span>
        </div>
      </li>
    );
  }
  const p = item.proposal;
  const to = names.get(p.seat) ?? "";
  if (p.kind === "say")
    return (
      <li class="tbl-feed-item" data-kind="mine">
        <div class="tbl-feed-body">
          <small class="muted">
            {ui("dm.msg.to", { name: to })} · {outcome(p)}
          </small>
          <span class="tbl-bubble">{p.text ?? p.label}</span>
        </div>
      </li>
    );
  const rolled = p.kind === "roll" && p.status === "accepted" && p.result !== undefined;
  return (
    <li class="tbl-feed-item" data-kind="proposal">
      <span
        class="tbl-feed-mark"
        data-kind={p.kind === "roll" ? "roll" : "damage"}
        aria-hidden="true"
      >
        {p.kind === "roll" ? <DieMark /> : "!"}
      </span>
      <div class="tbl-feed-body">
        <span>{p.label}</span>
        {rolled ? (
          <span class="tbl-feed-result">
            <b>{p.result}</b>
            {p.dc !== undefined && p.result !== undefined && (
              <span class={p.result >= p.dc ? "tbl-ok" : "tbl-ko"}>
                {ui(p.result >= p.dc ? "dm.prop.success" : "dm.prop.failure")}
              </span>
            )}
          </span>
        ) : (
          <small class="muted">{outcome(p)}</small>
        )}
      </div>
    </li>
  );
}

const endedText = () => {
  const why = tableBye.value;
  if (why === "replaced") return ui("dm.table.endedReplaced");
  if (why === "closed" || why === "expired") return ui("dm.table.endedClosed");
  return ui("dm.table.endedOther");
};

/** The table itself: the code, the players and the activity, in a panel from the side (from the bottom on a phone). */
export function TableDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = tablePanel.value;
  const open = panel !== undefined;
  const camp = campaign.value;
  const code = tableCode.value;
  const state = tableState.value;
  const view = tableView.value;
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  const tab = panel?.tab ?? "players";
  // The list of the activity is being looked at: what the players wrote is seen.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new line while the list is open is seen at once
  useEffect(() => {
    if (open && tab === "activity") readMessages();
  }, [open, tab, view.messages.length]);
  if (!open || !camp) return null;

  const here = view.players.filter((p) => p.online);
  const names = new Map(view.players.map((p) => [p.seat, p.name]));
  const known = new Set(view.players.map((p) => p.name.trim().toLowerCase()));
  const away = camp.party.filter((m) => m.name.trim() && !known.has(m.name.trim().toLowerCase()));
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The code is on the screen: it can be read out.
    }
  };
  const live = Boolean(code) && state !== "ended";
  const activity = tableActivity(view);

  return (
    <dialog
      ref={dialog}
      class="table-drawer"
      aria-labelledby="table-drawer-title"
      onClose={closePanel}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePanel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") closePanel();
      }}
    >
      <div class="tbl">
        <header class="tbl-head">
          <h3 id="table-drawer-title">{ui("dm.table.title")}</h3>
          <button
            type="button"
            class="tbl-close"
            aria-label={ui("transfer.close")}
            onClick={closePanel}
          >
            ✕
          </button>
        </header>

        {!code || state === "ended" ? (
          <div class="tbl-intro">
            {state === "ended" && code && <p>{endedText()}</p>}
            <p class="muted">{ui("dm.table.intro")}</p>
            <button type="button" class="primary" onClick={() => void openTable(camp.id)}>
              {code ? ui("dm.table.openAgain") : ui("dm.table.open")}
            </button>
          </div>
        ) : (
          <>
            <div class="tbl-code">
              <span class="dm-live" data-state={state} aria-hidden="true" />
              <b class="dm-code" aria-label={ui("dm.table.code")}>
                {code}
              </b>
              <button type="button" class="secondary" onClick={() => void copy()}>
                {copied ? ui("dm.table.copied") : ui("dm.table.copy")}
              </button>
            </div>
            <p class="muted tbl-state">
              {ui(STATE_TEXT[state])}
              {live &&
                ` · ${ui("dm.online.here", { n: here.length, max: Math.max(camp.party.length, view.players.length) })}`}
            </p>
            <div class="tbl-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "players"}
                onClick={() => {
                  tablePanel.value = { tab: "players" };
                }}
              >
                {ui("dm.table.players")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "activity"}
                onClick={() => {
                  tablePanel.value = { tab: "activity" };
                }}
              >
                {ui("dm.table.activity")}
                {tableUnread.value > 0 && <span class="tbl-unread">{tableUnread.value}</span>}
              </button>
            </div>
            <div class="tbl-body">
              {tab === "players" ? (
                <>
                  {view.players.length === 0 && <p class="muted">{ui("dm.table.none")}</p>}
                  <ul class="plain tbl-players">
                    {view.players.map((p) => (
                      <PlayerCardRow key={p.seat} p={p} />
                    ))}
                    {away.map((m) => (
                      <li key={m.id} class="tbl-player tbl-away">
                        <span class="dm-live" aria-hidden="true" />
                        <span class="muted">{ui("dm.table.notHere", { name: m.name })}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    class="link tbl-close-table"
                    onClick={async () => {
                      const ok = await askConfirm({
                        title: ui("dm.table.closeAsk"),
                        confirm: ui("dm.table.close"),
                        cancel: ui("confirm.cancel"),
                      });
                      if (ok) await closeTable(camp.id);
                    }}
                  >
                    {ui("dm.table.close")}
                  </button>
                </>
              ) : activity.length === 0 ? (
                <p class="muted">{ui("dm.table.quiet")}</p>
              ) : (
                <ul class="plain tbl-feed">
                  {activity.slice(0, 40).map((item) => (
                    <ActivityLine
                      key={`${item.kind}-${item.at}-${item.kind === "proposal" ? item.proposal.id : ""}`}
                      item={item}
                      names={names}
                    />
                  ))}
                </ul>
              )}
            </div>
            <footer class="tbl-foot">
              {/* Both stay drawn, so a difficulty or a line half written survives a look at the other list. */}
              <div hidden={tab !== "players"}>
                <AskRoll players={here} />
              </div>
              <div hidden={tab !== "activity"}>
                <Compose players={here} />
              </div>
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
