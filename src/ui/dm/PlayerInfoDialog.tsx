import { seatOpen, tablePanel, tableView } from "../../app/table";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import type { PlayerCard } from "../../relay/protocol";
import { Modal } from "./Modal";

function Row({ name, value }: { name: string; value: string | number }) {
  return (
    <li>
      <span>{name}</span>
      <b>{value}</b>
    </li>
  );
}

/** A tile of the sheet: a short name above, the number below (as the sheet of a creature has them). */
function Tile({ name, title, value }: { name: string; title?: string; value: string | number }) {
  return (
    <div class="dm-panel-stat">
      <small title={title}>{name}</small>
      <b>{value}</b>
    </div>
  );
}

/** The numbers a player shares: the tiles read in play first, then the rest in short lists. */
function Numbers({ card, initiative }: { card: PlayerCard; initiative?: number }) {
  const speed = card.speed === undefined ? "—" : distance(card.speed);
  const percent = card.maxHp > 0 ? Math.round((card.hp / card.maxHp) * 100) : 0;
  const state = card.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  const facts: [string, string | number | undefined][] = [
    [ui("sheet.passivePerception"), card.passivePerception],
    [ui("sheet.spellSaveDc"), card.spellDc],
    [
      ui("sheet.spellAttack"),
      card.spellAttack === undefined ? undefined : signed(card.spellAttack),
    ],
  ];
  return (
    <>
      <div class="dm-panel-stats dm-info-stats">
        <div class="dm-panel-stat dm-panel-stat-hp">
          <small title={ui("sheet.hitPoints")}>{ui("dm.col.hp")}</small>
          <span class="dm-hp-num">
            <b>{card.hp}</b>
            <span> / {card.maxHp}</span>
            {card.tempHp > 0 && <em>+{card.tempHp}</em>}
          </span>
          <span class="dm-hp-bar" data-state={state} aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        </div>
        <Tile name={ui("dm.col.ac")} title={ui("sheet.armorClass")} value={card.ac} />
        <Tile name={ui("dm.col.speed")} title={ui("sheet.speed")} value={speed} />
        <Tile
          name={ui("dm.col.init")}
          title={ui("sheet.initiative")}
          value={
            initiative ?? (card.initiativeBonus === undefined ? "—" : signed(card.initiativeBonus))
          }
        />
      </div>
      {card.conditions.length > 0 && (
        <div class="tbl-conditions">
          {card.conditions.map((name) => (
            <span key={name} class="dm-fx-chip">
              {name}
            </span>
          ))}
        </div>
      )}
      {(card.active ?? []).length > 0 && (
        <section class="dm-seat-section">
          <h4>{ui("play.activeEffects")}</h4>
          <div class="tbl-conditions">
            {(card.active ?? []).map((a) => (
              <span key={a.name} class="dm-fx-chip">
                {a.name}
                {a.rounds !== undefined && ` · ${ui("play.roundsLeft", { n: a.rounds })}`}
              </span>
            ))}
          </div>
        </section>
      )}
      {facts.some(([, v]) => v !== undefined) && (
        <div class="dm-seat-facts">
          {facts
            .filter(([, v]) => v !== undefined)
            .map(([name, value]) => (
              <Tile key={name} name={name} value={value ?? ""} />
            ))}
        </div>
      )}
      {(card.senses ?? []).length + (card.passiveInvestigation !== undefined ? 1 : 0) > 0 && (
        <section class="dm-seat-section">
          <h4>{ui("more.senses")}</h4>
          <ul class="plain dm-seat-lines">
            {(card.senses ?? []).map(([name, value]) => (
              <Row key={name} name={name} value={value} />
            ))}
            {card.passiveInvestigation !== undefined && (
              <Row name={ui("more.passiveInvestigation")} value={card.passiveInvestigation} />
            )}
            {card.passiveInsight !== undefined && (
              <Row name={ui("more.passiveInsight")} value={card.passiveInsight} />
            )}
          </ul>
        </section>
      )}
      {(card.defenses ?? []).length > 0 && (
        <section class="dm-seat-section">
          <h4>{ui("play.damageEffects")}</h4>
          <ul class="plain dm-seat-lines">
            {(card.defenses ?? []).map(([name, value]) => (
              <Row key={name} name={name} value={value} />
            ))}
          </ul>
        </section>
      )}
      {card.proficiency !== undefined && (
        <section class="dm-seat-section">
          <h4>{ui("more.attacks")}</h4>
          <ul class="plain dm-seat-lines">
            <Row name={ui("sheet.proficiencyBonus")} value={signed(card.proficiency)} />
            {card.martialDc !== undefined && (
              <Row name={ui("play.martialDc")} value={card.martialDc} />
            )}
            {card.critRange !== undefined && (
              <Row
                name={ui("more.critRange", { min: card.critRange })}
                value={`${card.critRange}–20`}
              />
            )}
            {card.attunedMax !== undefined && card.attunedUsed !== undefined && (
              <Row
                name={ui("equip.attunement", { used: card.attunedUsed, max: card.attunedMax })}
                value=""
              />
            )}
          </ul>
        </section>
      )}
    </>
  );
}

/** What a player at the table shows of their sheet, opened by touching them in the list: no need to ask them. */
export function PlayerInfoDialog() {
  const seat = seatOpen.value;
  const player = tableView.value.players.find((p) => p.seat === seat);
  const close = () => {
    seatOpen.value = undefined;
  };
  return (
    <Modal
      open={player !== undefined}
      variant="side"
      title={player?.name || ui("dm.unnamed")}
      onClose={close}
    >
      <div class="dm-info-body dm-seat-info">
        <p class="muted dm-info-kind">
          {[player?.card?.cls, player ? ui(player.online ? "dm.table.here" : "dm.table.away") : ""]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {player?.card ? (
          <>
            <Numbers card={player.card} initiative={player.initiative} />
            <div class="dm-seat-actions">
              <button
                type="button"
                class="primary"
                disabled={!player.online}
                onClick={() => {
                  close();
                  tablePanel.value = { tab: "players", who: player.seat };
                }}
              >
                {ui("dm.ask.title")}
              </button>
              <button
                type="button"
                disabled={!player.online}
                onClick={() => {
                  close();
                  tablePanel.value = { tab: "activity", who: player.seat };
                }}
              >
                {ui("dm.msg.write")}
              </button>
            </div>
            <p class="muted dm-seat-note">{ui("dm.seat.language")}</p>
          </>
        ) : (
          <p class="muted">{ui("dm.seat.noCard")}</p>
        )}
      </div>
    </Modal>
  );
}
