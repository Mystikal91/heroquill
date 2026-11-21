import { useState } from "preact/hooks";
import { addPlayersToFight, campaign, encounter, missingPlayers, partyPrompt } from "../../app/dm";
import { ui } from "../../i18n/ui";
import { Modal } from "./Modal";

function Choice({ close }: { close: () => void }) {
  const missing = missingPlayers();
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(missing.map((m) => m.id)));
  // Only the ones still missing count: a player may have been added to the fight another way meanwhile.
  const wanted = missing.filter((m) => chosen.has(m.id)).map((m) => m.id);
  if (missing.length === 0) return <p class="muted">{ui("dm.party.allIn")}</p>;
  return (
    <div class="dm-party-prompt">
      <p class="muted">{ui("dm.partyDialog.hint", { name: encounter.value?.name ?? "" })}</p>
      <ul class="plain dm-party-choice">
        {missing.map((m) => (
          <li key={m.id}>
            <label class="dm-check">
              <input
                type="checkbox"
                checked={chosen.has(m.id)}
                onChange={(e) => {
                  const on = e.currentTarget.checked;
                  setChosen((now) => {
                    const next = new Set(now);
                    if (on) next.add(m.id);
                    else next.delete(m.id);
                    return next;
                  });
                }}
              />
              <span>
                <b>{m.name || ui("dm.unnamed")}</b>
                <small>{` · ${ui("dm.col.ac")} ${m.ac} · ${ui("dm.col.hp")} ${m.maxHp}`}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div class="dm-party-actions">
        <button
          type="button"
          class="primary"
          disabled={wanted.length === 0}
          onClick={() => void addPlayersToFight(wanted)}
        >
          {ui("dm.partyDialog.add", { n: wanted.length })}
        </button>
        <button type="button" class="secondary" onClick={close}>
          {ui("dm.partyDialog.skip")}
        </button>
      </div>
    </div>
  );
}

/** Asks which players of the campaign's party join the open encounter, all of them chosen at first. */
export function PartyDialog() {
  return (
    <Modal
      open={partyPrompt.value && campaign.value !== undefined}
      variant="center"
      title={ui("dm.partyDialog.title")}
      onClose={() => {
        partyPrompt.value = false;
      }}
    >
      <div class="dm-party-body">
        <Choice
          close={() => {
            partyPrompt.value = false;
          }}
        />
      </div>
    </Modal>
  );
}
