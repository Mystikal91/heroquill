import { useEffect, useMemo, useState } from "preact/hooks";
import {
  addCharacter,
  addManual,
  addMonsters,
  dmRuleset,
  encounter,
  setDmRuleset,
} from "../../app/dm";
import { challengeText, typeText } from "../../app/monsterView";
import { content } from "../../app/store";
import { monstersOf } from "../../engine/companions";
import { MAX_COMBATANTS } from "../../engine/encounter";
import { ui } from "../../i18n/ui";
import { type CharacterSummary, listCharacters } from "../../storage/characters";
import { NumberField } from "./NumberField";

type Tab = "monsters" | "manual" | "characters";

const plain = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Monsters() {
  const c = content.value;
  const ruleset = dmRuleset.value;
  const [query, setQuery] = useState("");
  const [count, setCount] = useState<number | undefined>(1);
  const [rollHp, setRollHp] = useState(false);
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
  const shown = (wanted ? all.filter((m) => plain(m.name).includes(wanted)) : all).slice(0, 40);
  const room = MAX_COMBATANTS - (encounter.value?.combatants.length ?? 0);
  return (
    <div class="dm-add-body">
      <div class="dm-add-tools">
        <label class="field dm-search">
          <span>{ui("dm.search")}</span>
          <input
            type="search"
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
        <div class="field dm-count">
          <span>{ui("dm.count")}</span>
          <NumberField label={ui("dm.count")} min={1} max={30} value={count} onChange={setCount} />
        </div>
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
            return (
              <li key={entry.id}>
                <span class="dm-result-name">
                  <b>{name}</b>
                  <small>
                    {typeof data.challenge === "number"
                      ? `${ui("dm.cr", { n: challengeText(data.challenge) })}`
                      : ""}
                    {data.type ? ` · ${typeText(data.type)}` : ""}
                  </small>
                </span>
                <button
                  type="button"
                  disabled={room <= 0}
                  aria-label={`${ui("dm.addButton")}: ${name}`}
                  onClick={() => addMonsters(entry.id, count ?? 1, rollHp)}
                >
                  {ui("dm.addButton")}
                  {(count ?? 1) > 1 ? ` ×${count}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > shown.length && wanted === "" && <p class="muted">{ui("dm.searchMore")}</p>}
    </div>
  );
}

function ByHand() {
  const [name, setName] = useState("");
  const [maxHp, setMaxHp] = useState<number | undefined>(10);
  const [ac, setAc] = useState<number | undefined>(12);
  const [bonus, setBonus] = useState<number | undefined>(0);
  return (
    <form
      class="dm-add-body dm-manual"
      onSubmit={(e) => {
        e.preventDefault();
        addManual({ name, maxHp: maxHp ?? 1, ac: ac ?? 10, initiativeBonus: bonus ?? 0 });
        setName("");
      }}
    >
      <label class="field">
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
        <span>{ui("dm.field.bonus")}</span>
        <NumberField
          label={ui("dm.field.bonus")}
          min={-20}
          max={30}
          value={bonus}
          onChange={setBonus}
        />
      </div>
      <button type="submit">{ui("dm.addButton")}</button>
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
  if (!list) return <p class="muted">{ui("app.loading")}</p>;
  if (list.length === 0) return <p class="muted">{ui("dm.noCharacters")}</p>;
  return (
    <div class="dm-add-body">
      <p class="muted">{ui("dm.characterHint")}</p>
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

/** Where creatures come in: the monsters of the rules, a creature made up by hand, or a character of this device. */
export function AddCreatures() {
  const [tab, setTab] = useState<Tab>("monsters");
  const tabs: [Tab, string][] = [
    ["monsters", ui("dm.add.monsters")],
    ["manual", ui("dm.add.manual")],
    ["characters", ui("dm.add.characters")],
  ];
  return (
    <section class="dm-add" aria-labelledby="dm-add-title">
      <h3 id="dm-add-title">{ui("dm.add")}</h3>
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
      {tab === "monsters" ? <Monsters /> : tab === "manual" ? <ByHand /> : <Characters />}
    </section>
  );
}
