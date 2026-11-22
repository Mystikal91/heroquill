import { useEffect, useState } from "preact/hooks";
import {
  addPlayer,
  addPlayerFromCharacter,
  campaign,
  campaignEncounters,
  campaigns,
  changePlayer,
  dmSection,
  encounter,
  encounters,
  newCampaign,
  newEncounter,
  removeCampaign,
  removePlayer,
  renameOpenCampaign,
  selectCampaign,
  selectEncounter,
} from "../../app/dm";
import { content } from "../../app/store";
import { tableView } from "../../app/table";
import { MAX_PARTY, type PartyMember } from "../../engine/campaign";
import { MAX_SPEED, isStarted } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { feetFrom, feetTo, metricUnits } from "../../i18n/units";
import { type CharacterSummary, listCharacters } from "../../storage/characters";
import { NumberField } from "./NumberField";
import { TableBlock } from "./TableBlock";

/** One player of the party, as a card: the name, and the four numbers the fight needs. */
function Player({ m }: { m: PartyMember }) {
  const metric = metricUnits.value;
  const seat = tableView.value.players.find((p) => p.seat === m.id);
  return (
    <li class="dm-player">
      <div class="dm-player-head">
        <span class="dm-player-mark" aria-hidden="true">
          {(m.name.trim() || "?").charAt(0).toUpperCase()}
        </span>
        <input
          type="text"
          class="dm-player-name"
          value={m.name}
          maxLength={80}
          aria-label={ui("dm.field.name")}
          placeholder={ui("dm.field.name")}
          onInput={(e) => {
            const name = e.currentTarget.value;
            changePlayer(m.id, (x) => ({ ...x, name }));
          }}
        />
        {seat && (
          <span
            class="dm-live"
            data-state={seat.online ? "online" : "retrying"}
            role="img"
            aria-label={seat.online ? ui("dm.table.here") : ui("dm.table.away")}
            title={seat.online ? ui("dm.table.here") : ui("dm.table.away")}
          />
        )}
        <button
          type="button"
          class="secondary dm-player-remove"
          aria-label={ui("dm.party.remove", { name: m.name || ui("dm.unnamed") })}
          title={ui("dm.party.remove", { name: m.name || ui("dm.unnamed") })}
          onClick={() => removePlayer(m.id)}
        >
          ✕
        </button>
      </div>
      <div class="dm-player-numbers">
        <div class="field" title={ui("dm.field.maxHp")}>
          <span>{ui("dm.col.hp")}</span>
          <NumberField
            label={ui("dm.field.maxHp")}
            min={1}
            max={99999}
            value={m.maxHp}
            onChange={(n) => n !== undefined && changePlayer(m.id, (x) => ({ ...x, maxHp: n }))}
          />
        </div>
        <div class="field" title={ui("sheet.armorClass")}>
          <span>{ui("dm.col.ac")}</span>
          <NumberField
            label={ui("sheet.armorClass")}
            min={0}
            max={99}
            value={m.ac}
            onChange={(n) => n !== undefined && changePlayer(m.id, (x) => ({ ...x, ac: n }))}
          />
        </div>
        <div class="field" title={ui("dm.field.speed")}>
          <span>{`${ui("dm.col.speed")} (${metric ? "m" : "ft"})`}</span>
          <NumberField
            label={ui("dm.field.speed")}
            min={0}
            max={metric ? Math.floor(feetTo(MAX_SPEED, true)) : MAX_SPEED}
            value={
              m.speed === undefined ? undefined : Math.round(feetTo(m.speed, metric) * 10) / 10
            }
            onChange={(n) =>
              changePlayer(m.id, (x) => {
                const { speed: _old, ...rest } = x;
                return n === undefined ? rest : { ...rest, speed: Math.round(feetFrom(n, metric)) };
              })
            }
          />
        </div>
        <div class="field" title={ui("dm.field.bonus")}>
          <span>{ui("dm.col.init")}</span>
          <NumberField
            label={ui("dm.field.bonus")}
            min={-20}
            max={30}
            value={m.initiativeBonus}
            onChange={(n) =>
              n !== undefined && changePlayer(m.id, (x) => ({ ...x, initiativeBonus: n }))
            }
          />
        </div>
      </div>
    </li>
  );
}

/** The encounters of the campaign, with where each stands; one opens it in the Encounter part. */
function EncounterList() {
  const current = encounter.value?.id;
  const open = (id: string) =>
    void selectEncounter(id).then(() => {
      dmSection.value = "encounter";
    });
  return (
    <section class="dm-encounter-list">
      <div class="dm-section-head">
        <h3>{ui("dm.encounters")}</h3>
        <button
          type="button"
          onClick={() =>
            void newEncounter().then(() => {
              dmSection.value = "encounter";
            })
          }
        >
          + {ui("dm.newEncounter")}
        </button>
      </div>
      <ul class="plain">
        {campaignEncounters.value.map((x) => {
          const running = isStarted(x);
          const state = running ? "running" : x.combatants.length > 0 ? "ready" : "empty";
          return (
            <li key={x.id} data-state={state} data-current={x.id === current || undefined}>
              <div class="dm-encounter-row-text">
                <b>{x.name.trim() || ui("dm.unnamed")}</b>
                <small class="muted">{ui("dm.creatureCount", { n: x.combatants.length })}</small>
              </div>
              <span class="dm-encounter-state">
                {running
                  ? ui("dm.state.running", { n: x.round })
                  : ui(state === "ready" ? "dm.state.ready" : "dm.state.empty")}
              </span>
              <button
                type="button"
                class={running ? "primary" : "secondary"}
                onClick={() => open(x.id)}
              >
                {running ? ui("dm.resume") : ui("dm.openEncounter")}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The saved characters of this device, to take a player from. */
function SavedCharacters({ taken, done }: { taken: Set<string>; done: () => void }) {
  const [list, setList] = useState<CharacterSummary[] | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void listCharacters().then((l) => current && setList(l));
    return () => {
      current = false;
    };
  }, []);
  if (!list) return <p class="muted">{ui("app.loading")}</p>;
  if (list.length === 0) return <p class="muted">{ui("dm.noCharacters")}</p>;
  return (
    <ul class="plain dm-results">
      {list.map((ch) => (
        <li key={ch.id}>
          <span class="dm-result-name">
            <b>{ch.name.trim() || ui("dm.unnamed")}</b>
            <small>
              {ch.classes
                .map((k) => `${content.value?.name(k.classId) ?? ""} ${k.level}`.trim())
                .join(" / ")}
            </small>
          </span>
          <button
            type="button"
            class="dm-add-button"
            disabled={taken.has(ch.id)}
            onClick={() => {
              void addPlayerFromCharacter(ch.id).then(done);
            }}
          >
            {taken.has(ch.id) ? ui("dm.alreadyIn") : ui("dm.addButton")}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The campaigns, and the open one with its name and its party. */
export function CampaignSection() {
  const open = campaign.value;
  const [name, setName] = useState("");
  const [picking, setPicking] = useState(false);
  if (!open) return null;
  const fights = (id: string) => encounters.value.filter((e) => e.campaignId === id).length;
  const linked = new Set(open.party.flatMap((m) => (m.characterId ? [m.characterId] : [])));
  return (
    <div class="dm-campaigns">
      <aside class="dm-campaign-side">
        <h3>{ui("dm.campaigns")}</h3>
        <ul class="plain dm-campaign-list">
          {campaigns.value.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                class="dm-campaign-card"
                aria-pressed={c.id === open.id}
                onClick={() => void selectCampaign(c.id)}
              >
                <b>{c.name.trim() || ui("dm.unnamed")}</b>
                <small>
                  {ui("dm.campaign.meta", { players: c.party.length, fights: fights(c.id) })}
                </small>
              </button>
            </li>
          ))}
        </ul>
        <form
          class="dm-campaign-new"
          onSubmit={(e) => {
            e.preventDefault();
            void newCampaign(name);
            setName("");
          }}
        >
          <input
            type="text"
            value={name}
            maxLength={80}
            aria-label={ui("dm.campaign.new")}
            placeholder={ui("dm.campaign.new")}
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <button type="submit">{ui("dm.campaign.create")}</button>
        </form>
      </aside>
      <div class="dm-campaign-open">
        <input
          type="text"
          class="dm-campaign-title"
          value={open.name}
          maxLength={80}
          aria-label={ui("dm.campaign.name")}
          placeholder={ui("dm.campaign.namePlaceholder")}
          onInput={(e) => renameOpenCampaign(e.currentTarget.value)}
        />
        <section class="dm-party-section">
          <div class="dm-section-head">
            <h3>{ui("dm.party")}</h3>
            <div class="dm-party-actions">
              <button
                type="button"
                class="secondary"
                aria-expanded={picking}
                disabled={open.party.length >= MAX_PARTY}
                onClick={() => setPicking(!picking)}
              >
                {ui("dm.party.fromSaved")}
              </button>
              <button type="button" disabled={open.party.length >= MAX_PARTY} onClick={addPlayer}>
                + {ui("dm.party.add")}
              </button>
            </div>
          </div>
          {picking && <SavedCharacters taken={linked} done={() => setPicking(false)} />}
          {open.party.length === 0 ? (
            <p class="muted">{ui("dm.party.empty")}</p>
          ) : (
            <ul class="plain dm-party">
              {open.party.map((m) => (
                <Player key={m.id} m={m} />
              ))}
            </ul>
          )}
        </section>
        <div class="dm-campaign-grid">
          <EncounterList />
          <TableBlock campaignId={open.id} />
        </div>
        <div class="dm-campaign-danger">
          <button type="button" class="danger-btn" onClick={() => void removeCampaign()}>
            {ui("dm.campaign.delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
