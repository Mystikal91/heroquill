import { useEffect, useState } from "preact/hooks";
import {
  addPlayer,
  addPlayerFromCharacter,
  campaign,
  campaigns,
  changePlayer,
  dmSection,
  encounters,
  newCampaign,
  removeCampaign,
  removePlayer,
  renameOpenCampaign,
  selectCampaign,
} from "../../app/dm";
import { content } from "../../app/store";
import { MAX_PARTY, type PartyMember } from "../../engine/campaign";
import { MAX_SPEED } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { feetFrom, feetTo, metricUnits } from "../../i18n/units";
import { type CharacterSummary, listCharacters } from "../../storage/characters";
import { NumberField } from "./NumberField";

/** One player of the party: the numbers the fight needs. */
function Player({ m }: { m: PartyMember }) {
  const metric = metricUnits.value;
  return (
    <li class="dm-player">
      <label class="field dm-player-name">
        <span>{ui("dm.field.name")}</span>
        <input
          type="text"
          value={m.name}
          maxLength={80}
          onInput={(e) => {
            const name = e.currentTarget.value;
            changePlayer(m.id, (x) => ({ ...x, name }));
          }}
        />
      </label>
      <div class="field">
        <span>{ui("dm.field.maxHp")}</span>
        <NumberField
          label={ui("dm.field.maxHp")}
          min={1}
          max={99999}
          value={m.maxHp}
          onChange={(n) => n !== undefined && changePlayer(m.id, (x) => ({ ...x, maxHp: n }))}
        />
      </div>
      <div class="field">
        <span>{ui("sheet.armorClass")}</span>
        <NumberField
          label={ui("sheet.armorClass")}
          min={0}
          max={99}
          value={m.ac}
          onChange={(n) => n !== undefined && changePlayer(m.id, (x) => ({ ...x, ac: n }))}
        />
      </div>
      <div class="field">
        <span>{`${ui("dm.field.speed")} (${metric ? "m" : "ft"})`}</span>
        <NumberField
          label={ui("dm.field.speed")}
          min={0}
          max={metric ? Math.floor(feetTo(MAX_SPEED, true)) : MAX_SPEED}
          value={m.speed === undefined ? undefined : Math.round(feetTo(m.speed, metric) * 10) / 10}
          onChange={(n) =>
            changePlayer(m.id, (x) => {
              const { speed: _old, ...rest } = x;
              return n === undefined ? rest : { ...rest, speed: Math.round(feetFrom(n, metric)) };
            })
          }
        />
      </div>
      <div class="field">
        <span>{ui("dm.field.bonus")}</span>
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
      <button
        type="button"
        class="secondary dm-player-remove"
        aria-label={ui("dm.party.remove", { name: m.name || ui("dm.unnamed") })}
        title={ui("dm.party.remove", { name: m.name || ui("dm.unnamed") })}
        onClick={() => removePlayer(m.id)}
      >
        ✕
      </button>
    </li>
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
      <section>
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
          <label class="field">
            <span>{ui("dm.campaign.new")}</span>
            <input
              type="text"
              value={name}
              maxLength={80}
              placeholder={ui("dm.campaign.namePlaceholder")}
              onInput={(e) => setName(e.currentTarget.value)}
            />
          </label>
          <button type="submit">{ui("dm.campaign.create")}</button>
        </form>
      </section>
      <section class="dm-campaign-open">
        <header>
          <label class="field">
            <span>{ui("dm.campaign.name")}</span>
            <input
              type="text"
              value={open.name}
              maxLength={80}
              onInput={(e) => renameOpenCampaign(e.currentTarget.value)}
            />
          </label>
          <button
            type="button"
            class="primary"
            onClick={() => {
              dmSection.value = "encounter";
            }}
          >
            {ui("dm.campaign.toEncounters")}
          </button>
        </header>
        <h3>{ui("dm.party")}</h3>
        {open.party.length === 0 ? (
          <p class="muted">{ui("dm.party.empty")}</p>
        ) : (
          <ul class="plain dm-party">
            {open.party.map((m) => (
              <Player key={m.id} m={m} />
            ))}
          </ul>
        )}
        <div class="dm-party-actions">
          <button type="button" disabled={open.party.length >= MAX_PARTY} onClick={addPlayer}>
            {ui("dm.party.add")}
          </button>
          <button
            type="button"
            class="secondary"
            aria-expanded={picking}
            disabled={open.party.length >= MAX_PARTY}
            onClick={() => setPicking(!picking)}
          >
            {ui("dm.party.fromSaved")}
          </button>
        </div>
        {picking && <SavedCharacters taken={linked} done={() => setPicking(false)} />}
        <div class="dm-campaign-danger">
          <button type="button" class="danger-btn" onClick={() => void removeCampaign()}>
            {ui("dm.campaign.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
