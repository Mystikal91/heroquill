import { useEffect, useMemo, useState } from "preact/hooks";
import {
  addCharacter,
  addEnvironment,
  addLair,
  addManual,
  addMonsters,
  addPlayersToFight,
  addedLog,
  adding,
  campaign,
  closeAdd,
  dmRuleset,
  encounter,
  missingPlayers,
  setDmRuleset,
} from "../../app/dm";
import { challengeText, typeText } from "../../app/monsterView";
import { content } from "../../app/store";
import { monstersOf } from "../../engine/companions";
import { MAX_COMBATANTS } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { type CharacterSummary, listCharacters } from "../../storage/characters";
import { Modal } from "./Modal";
import { NumberField } from "./NumberField";

type Tab = "monsters" | "manual" | "characters";

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A number with a minus and a plus: how many of a monster to add. */
function Stepper({
  value,
  onChange,
  label,
}: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <fieldset class="dm-stepper">
      <legend class="sr-only">{label}</legend>
      <button
        type="button"
        aria-label={ui("dm.fewer")}
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <output>{value}</output>
      <button
        type="button"
        aria-label={ui("dm.more")}
        disabled={value >= 30}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </fieldset>
  );
}

function Monsters() {
  const c = content.value;
  const ruleset = dmRuleset.value;
  const [query, setQuery] = useState("");
  const [rollHp, setRollHp] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const all = useMemo(
    () =>
      c
        ? monstersOf(c.index, ruleset)
            .map((e) => ({ entry: e, name: c.name(e.id) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [c, ruleset],
  );
  const wanted = plain(query.trim());
  const found = wanted ? all.filter((m) => plain(m.name).includes(wanted)) : all;
  const shown = found.slice(0, 60);
  const room = MAX_COMBATANTS - (encounter.value?.combatants.length ?? 0);
  return (
    <div class="dm-add-body">
      <div class="dm-add-tools">
        <label class="field dm-search">
          <span>{ui("dm.search")}</span>
          <input
            type="search"
            autofocus
            value={query}
            onInput={(e) => setQuery(e.currentTarget.value)}
            placeholder={ui("dm.searchPlaceholder")}
          />
        </label>
        <label class="field">
          <span>{ui("dm.edition")}</span>
          <select
            value={ruleset}
            onChange={(e) => setDmRuleset(e.currentTarget.value === "srd52" ? "srd52" : "srd51")}
          >
            <option value="srd51">{ui("edition.srd51.name")}</option>
            <option value="srd52">{ui("edition.srd52.name")}</option>
          </select>
        </label>
        <label class="dm-check">
          <input
            type="checkbox"
            checked={rollHp}
            onChange={(e) => setRollHp(e.currentTarget.checked)}
          />
          <span>{ui("dm.rollHp")}</span>
        </label>
      </div>
      {!c?.monsters ? (
        <p class="muted">{ui("dm.loadingMonsters")}</p>
      ) : shown.length === 0 ? (
        <p class="muted">{ui("dm.noMonsters")}</p>
      ) : (
        <ul class="plain dm-results">
          {shown.map(({ entry, name }) => {
            const data = entry.data as { challenge?: number; type?: string };
            const count = counts[entry.id] ?? 1;
            return (
              <li key={entry.id}>
                <span class="dm-result-name">
                  <b>{name}</b>
                  <small>
                    {typeof data.challenge === "number"
                      ? ui("dm.cr", { n: challengeText(data.challenge) })
                      : ""}
                    {data.type ? ` · ${typeText(data.type)}` : ""}
                  </small>
                </span>
                <Stepper
                  value={count}
                  label={`${ui("dm.count")}: ${name}`}
                  onChange={(n) => setCounts((x) => ({ ...x, [entry.id]: n }))}
                />
                <button
                  type="button"
                  class="dm-add-button"
                  disabled={room <= 0}
                  aria-label={`${ui("dm.addButton")}: ${name}`}
                  onClick={() => {
                    addMonsters(entry.id, count, rollHp);
                    setCounts((x) => ({ ...x, [entry.id]: 1 }));
                  }}
                >
                  {ui("dm.addButton")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {found.length > shown.length && <p class="muted">{ui("dm.searchMore")}</p>}
    </div>
  );
}

function ByHand() {
  const [name, setName] = useState("");
  const [maxHp, setMaxHp] = useState<number | undefined>(10);
  const [ac, setAc] = useState<number | undefined>(12);
  const [speed, setSpeed] = useState<number | undefined>(30);
  const [bonus, setBonus] = useState<number | undefined>(0);
  return (
    <form
      class="dm-add-body dm-manual"
      onSubmit={(e) => {
        e.preventDefault();
        addManual({
          name,
          maxHp: maxHp ?? 1,
          ac: ac ?? 10,
          initiativeBonus: bonus ?? 0,
          ...(speed !== undefined && { speed }),
        });
        setName("");
      }}
    >
      <button type="button" class="secondary dm-manual-name" onClick={addLair}>
        {ui("dm.lairAdd")}
      </button>
      <button type="button" class="secondary dm-manual-name" onClick={addEnvironment}>
        {ui("dm.env.add")}
      </button>
      <label class="field dm-manual-name">
        <span>{ui("dm.field.name")}</span>
        <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
      </label>
      <div class="field">
        <span>{ui("dm.field.maxHp")}</span>
        <NumberField
          label={ui("dm.field.maxHp")}
          min={1}
          max={99999}
          value={maxHp}
          onChange={setMaxHp}
        />
      </div>
      <div class="field">
        <span>{ui("sheet.armorClass")}</span>
        <NumberField label={ui("sheet.armorClass")} min={0} max={99} value={ac} onChange={setAc} />
      </div>
      <div class="field">
        <span>{`${ui("dm.field.speed")} (ft)`}</span>
        <NumberField
          label={ui("dm.field.speed")}
          min={0}
          max={999}
          value={speed}
          onChange={setSpeed}
        />
      </div>
      <div class="field">
        <span>{ui("dm.field.bonus")}</span>
        <NumberField
          label={ui("dm.field.bonus")}
          min={-20}
          max={30}
          value={bonus}
          onChange={setBonus}
        />
      </div>
      <button type="submit" class="dm-manual-add">
        {ui("dm.addButton")}
      </button>
    </form>
  );
}

function Characters() {
  const [list, setList] = useState<CharacterSummary[] | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void listCharacters().then((l) => current && setList(l));
    return () => {
      current = false;
    };
  }, []);
  const inFight = new Set(
    (encounter.value?.combatants ?? []).flatMap((x) => (x.source ? [x.source] : [])),
  );
  const party = campaign.value?.party ?? [];
  const waiting = new Set(missingPlayers().map((m) => m.id));
  const partyBlock = party.length > 0 && (
    <section class="dm-add-party">
      <h4>{ui("dm.party")}</h4>
      <ul class="plain dm-results">
        {party.map((m) => (
          <li key={m.id} data-in={!waiting.has(m.id) || undefined}>
            <span class="dm-result-name">
              <b>{m.name || ui("dm.unnamed")}</b>
              <small>{`${ui("dm.col.ac")} ${m.ac} · ${ui("dm.col.hp")} ${m.maxHp}`}</small>
            </span>
            <button
              type="button"
              class="dm-add-button"
              disabled={!waiting.has(m.id)}
              onClick={() => void addPlayersToFight([m.id])}
            >
              {waiting.has(m.id) ? ui("dm.addButton") : ui("dm.alreadyIn")}
            </button>
          </li>
        ))}
      </ul>
      {waiting.size > 1 && (
        <button
          type="button"
          class="secondary"
          onClick={() => void addPlayersToFight([...waiting])}
        >
          {ui("dm.addParty")}
        </button>
      )}
    </section>
  );
  if (!list) return <p class="muted">{ui("app.loading")}</p>;
  if (list.length === 0 && party.length === 0) return <p class="muted">{ui("dm.noCharacters")}</p>;
  return (
    <div class="dm-add-body">
      {partyBlock}
      {list.length > 0 && <p class="muted">{ui("dm.characterHint")}</p>}
      <ul class="plain dm-results">
        {list.map((ch) => (
          <li key={ch.id} data-in={inFight.has(ch.id) || undefined}>
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
              disabled={inFight.has(ch.id)}
              onClick={() => void addCharacter(ch.id)}
            >
              {inFight.has(ch.id) ? ui("dm.alreadyIn") : ui("dm.addButton")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Where creatures come in: monsters of the rules, a creature by hand, or a character of this device. It stays open to add several. */
export function AddDialog() {
  const [tab, setTab] = useState<Tab>("monsters");
  const log = addedLog.value;
  const tabs: [Tab, string][] = [
    ["monsters", ui("dm.add.monsters")],
    ["manual", ui("dm.add.manual")],
    ["characters", ui("dm.add.characters")],
  ];
  return (
    <Modal open={adding.value} variant="center" title={ui("dm.add")} onClose={closeAdd}>
      <div class="dm-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={tab === id}
            class="dm-tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="dm-add-scroll">
        {tab === "monsters" ? <Monsters /> : tab === "manual" ? <ByHand /> : <Characters />}
      </div>
      <footer class="dm-add-foot">
        <output class="dm-added">
          {log.length === 0
            ? ui("dm.addedNone")
            : `${ui("dm.added")} ${log.map((x) => (x.count > 1 ? `${x.count} ${x.name}` : x.name)).join(", ")}`}
        </output>
        <button type="button" class="primary" onClick={closeAdd}>
          {ui("dm.done")}
        </button>
      </footer>
    </Modal>
  );
}
