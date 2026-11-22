import { useState } from "preact/hooks";
import { askConfirm } from "../../app/confirm";
import { dmRuleset } from "../../app/dm";
import { browse } from "../../app/search";
import { content } from "../../app/store";
import {
  closeTable,
  kickPlayer,
  openTable,
  propose,
  tableBye,
  tableCode,
  tableState,
  tableView,
} from "../../app/table";
import { ui } from "../../i18n/ui";
import type { ProposalRecord, TablePlayer } from "../../relay/dmTable";
import { ABILITY_KEYS, type AbilityKey } from "../../relay/protocol";

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

/** A saving throw, an ability check or a skill check asked of one player or all those here, with a difficulty if wanted. */
function AskRoll() {
  const players = tableView.value.players.filter((p) => p.online);
  const c = content.value;
  const [who, setWho] = useState("all");
  const [test, setTest] = useState<"save" | "check" | "skill">("save");
  const [ability, setAbility] = useState<AbilityKey>("wis");
  const [skill, setSkill] = useState("");
  const [dc, setDc] = useState("");
  const skills = c ? browse(c, "skill", dmRuleset.value) : [];
  const skillId = skill || skills[0]?.id || "";
  const abilityName = (a: string) => c?.name(`srd51:ability/${a}`) ?? a;
  const ask = () => {
    if (!c) return;
    const wanted = who === "all" ? players : players.filter((p) => p.seat === who);
    const target = Number.parseInt(dc, 10);
    const difficulty = Number.isFinite(target) && target > 0 ? Math.min(target, 40) : undefined;
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
  return (
    <details class="dm-ask">
      <summary>{ui("dm.ask.title")}</summary>
      {players.length === 0 ? (
        <p class="muted">{ui("dm.ask.nobody")}</p>
      ) : (
        <div class="dm-ask-form">
          <label class="field">
            <span>{ui("dm.ask.who")}</span>
            <select value={who} onChange={(e) => setWho(e.currentTarget.value)}>
              <option value="all">{ui("dm.ask.all")}</option>
              {players.map((p) => (
                <option key={p.seat} value={p.seat}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label class="field">
            <span>{ui("dm.ask.type")}</span>
            <select
              value={test}
              onChange={(e) => setTest(e.currentTarget.value as "save" | "check" | "skill")}
            >
              <option value="save">{ui("dm.ask.save")}</option>
              <option value="check">{ui("dm.ask.check")}</option>
              <option value="skill">{ui("dm.ask.skill")}</option>
            </select>
          </label>
          {test === "skill" ? (
            <label class="field">
              <span>{ui("dm.ask.skillField")}</span>
              <select value={skillId} onChange={(e) => setSkill(e.currentTarget.value)}>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label class="field">
              <span>{ui("dm.ask.ability")}</span>
              <select
                value={ability}
                onChange={(e) => setAbility(e.currentTarget.value as AbilityKey)}
              >
                {ABILITY_KEYS.map((a) => (
                  <option key={a} value={a}>
                    {abilityName(a)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label class="field">
            <span>{ui("dm.ask.dc")}</span>
            <input
              type="number"
              min={1}
              max={40}
              inputMode="numeric"
              value={dc}
              onInput={(e) => setDc(e.currentTarget.value)}
            />
          </label>
          <button type="button" class="primary" onClick={ask}>
            {ui("dm.ask.send")}
          </button>
        </div>
      )}
    </details>
  );
}

/** What came of a proposal, in words: waiting, declined, or for a roll the total and whether it beat the difficulty. */
function outcome(p: ProposalRecord): string {
  if (p.status !== "accepted" || p.result === undefined) return ui(`dm.prop.${p.status}`);
  const rolled = ui("dm.prop.rolled", { n: p.result });
  if (p.dc === undefined) return rolled;
  return `${rolled} · ${ui(p.result >= p.dc ? "dm.prop.success" : "dm.prop.failure")}`;
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
          <AskRoll />
          {view.proposals.length > 0 && (
            <>
              <h4>{ui("dm.prop.title")}</h4>
              <ul class="plain dm-proposals">
                {view.proposals.slice(0, 6).map((p) => (
                  <li key={p.id} data-status={p.status}>
                    <span>{p.label}</span>
                    <small>{outcome(p)}</small>
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
