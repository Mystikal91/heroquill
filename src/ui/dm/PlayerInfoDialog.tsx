import { seatOpen, tableView } from "../../app/table";
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

/** The numbers a player shares, in the sections of the player's own "numbers at a glance" window. */
function Numbers({ card }: { card: PlayerCard }) {
  const speed = card.speed === undefined ? "—" : distance(card.speed);
  return (
    <>
      <h4>{ui("more.defense")}</h4>
      <ul class="explain-lines more-lines">
        <Row
          name={ui("sheet.hitPoints")}
          value={`${card.hp}/${card.maxHp}${card.tempHp > 0 ? ` +${card.tempHp}` : ""}`}
        />
        {card.conditions.length > 0 && (
          <Row name={ui("play.conditions")} value={card.conditions.join(", ")} />
        )}
        <Row name={ui("sheet.armorClass")} value={card.ac} />
        {card.initiativeBonus !== undefined && (
          <Row name={ui("sheet.initiative")} value={signed(card.initiativeBonus)} />
        )}
        <Row name={ui("sheet.speed")} value={speed} />
        {(card.senses ?? []).map(([name, value]) => (
          <Row key={name} name={name} value={value} />
        ))}
      </ul>

      {(card.defenses ?? []).length > 0 && (
        <>
          <h4>{ui("play.damageEffects")}</h4>
          <ul class="explain-lines damage-effects">
            {(card.defenses ?? []).map(([name, value]) => (
              <Row key={name} name={name} value={value} />
            ))}
          </ul>
        </>
      )}

      {card.passivePerception !== undefined && (
        <>
          <h4>{ui("more.senses")}</h4>
          <ul class="explain-lines more-lines">
            <Row name={ui("sheet.passivePerception")} value={card.passivePerception} />
            {card.passiveInvestigation !== undefined && (
              <Row name={ui("more.passiveInvestigation")} value={card.passiveInvestigation} />
            )}
            {card.passiveInsight !== undefined && (
              <Row name={ui("more.passiveInsight")} value={card.passiveInsight} />
            )}
          </ul>
        </>
      )}

      {card.proficiency !== undefined && (
        <>
          <h4>{ui("more.attacks")}</h4>
          <ul class="explain-lines more-lines">
            <Row name={ui("sheet.proficiencyBonus")} value={signed(card.proficiency)} />
            {card.martialDc !== undefined && (
              <Row name={ui("play.martialDc")} value={card.martialDc} />
            )}
            {card.spellDc !== undefined && (
              <Row name={ui("sheet.spellSaveDc")} value={card.spellDc} />
            )}
            {card.spellAttack !== undefined && (
              <Row name={ui("sheet.spellAttack")} value={signed(card.spellAttack)} />
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
        </>
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
      variant="compact"
      title={player?.name || ui("dm.unnamed")}
      onClose={close}
    >
      <div class="dm-seat-info">
        {player && !player.online && <p class="muted">{ui("dm.seat.away")}</p>}
        {player?.card ? (
          <>
            {player.card.cls && <p class="muted">{player.card.cls}</p>}
            <Numbers card={player.card} />
            <p class="muted dm-seat-note">{ui("dm.seat.language")}</p>
          </>
        ) : (
          <p class="muted">{ui("dm.seat.noCard")}</p>
        )}
      </div>
    </Modal>
  );
}
