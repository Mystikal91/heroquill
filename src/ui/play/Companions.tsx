import { useEffect, useState } from "preact/hooks";
import {
  addCompanion,
  changeCompanion,
  removeCompanion,
  restoreCompanion,
} from "../../app/companions";
import { currentOwner } from "../../app/owner";
import { monstersWanted } from "../../app/rulesView";
import { character, content } from "../../app/store";
import { offerUndo } from "../../app/undo";
import type { Companion } from "../../engine/character";
import {
  companionHp,
  companionMax,
  healCompanion,
  hurtCompanion,
  isFamiliar,
  monstersOf,
} from "../../engine/companions";
import { ui } from "../../i18n/ui";
import { MonsterBlock } from "../rules/MonsterBlock";
import { Panel } from "../sheet/parts";
import { DamageButtons } from "./DamageButtons";

/** Hit points of one companion: a bar, and buttons to take damage or heal. */
function CompanionHp({ companion, max }: { companion: Companion; max: number }) {
  const [amount, setAmount] = useState("");
  const n = Math.max(0, Number.parseInt(amount, 10) || 0);
  const hp = companionHp(companion, max);
  const percent = Math.round((hp / max) * 100);
  const hurt = (n: number) => changeCompanion(companion.id, (c) => hurtCompanion(c, max, n));
  const heal = (n: number) => changeCompanion(companion.id, (c) => healCompanion(c, max, n));
  return (
    <>
      <output class="hp-readout">
        <b class={hp === 0 ? "zero" : ""}>{hp}</b>
        <span>{ui("play.of", { max })}</span>
      </output>
      <div
        class="hp-bar"
        data-state={hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well"}
        role="img"
        aria-label={`${hp} ${ui("play.of", { max })}`}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div class="hp-quick companion-hp">
        {[5, 1].map((n) => (
          <button
            type="button"
            key={`d${n}`}
            class="danger-btn"
            aria-label={ui("play.damageBy", { n })}
            onClick={() => hurt(n)}
          >
            {"−"}
            {n}
          </button>
        ))}
        {[1, 5].map((n) => (
          <button
            type="button"
            key={`h${n}`}
            aria-label={ui("play.healBy", { n })}
            onClick={() => heal(n)}
          >
            +{n}
          </button>
        ))}
      </div>
      <div class="hp-controls">
        <label class="field">
          <span>{ui("play.amount")}</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={amount}
            onInput={(e) => setAmount(e.currentTarget.value)}
          />
        </label>
        <div class="btn-row">
          <DamageButtons
            amount={n}
            apply={(dealt) => {
              hurt(dealt);
              setAmount("");
            }}
          />
          <button
            type="button"
            disabled={n === 0}
            onClick={() => {
              heal(n);
              setAmount("");
            }}
          >
            {ui("play.heal")}
          </button>
        </div>
      </div>
    </>
  );
}

/** The creatures that travel with the character: a familiar, a beast, a defender. */
export function Companions() {
  const c = content.value;
  const list = character.value.companions ?? [];
  const owner = currentOwner();
  const [adding, setAdding] = useState(false);
  // The monsters of the rules are a large pack: they come once a companion is there or is wanted.
  useEffect(() => {
    if (list.length > 0 || adding) monstersWanted.value = true;
  }, [list.length, adding]);
  if (!c) return null;

  const monsters = monstersOf(c.index, character.value.ruleset)
    .map((e) => ({ id: e.id, name: c.name(e.id), familiar: isFamiliar(e) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const familiars = monsters.filter((m) => m.familiar);
  const others = monsters.filter((m) => !m.familiar);

  return (
    <Panel title={ui("play.companions")}>
      {list.length === 0 && !adding && <p class="muted">{ui("play.companions.hint")}</p>}
      {list.map((companion) => {
        const monster = c.index.get(companion.monster);
        const max = companionMax(companion, monster, owner);
        const kindName = c.name(companion.monster);
        const shown = companion.name?.trim() || kindName;
        return (
          <div key={companion.id} class="companion">
            <div class="companion-head">
              <input
                type="text"
                value={companion.name ?? ""}
                placeholder={kindName}
                aria-label={ui("play.companions.name")}
                onInput={(e) => {
                  const name = e.currentTarget.value;
                  changeCompanion(companion.id, (x) => ({ ...x, name: name || undefined }));
                }}
              />
              <button
                type="button"
                class="link"
                onClick={() => {
                  const at = list.findIndex((x) => x.id === companion.id);
                  removeCompanion(companion.id);
                  offerUndo(ui("undo.deleted", { name: shown }), () =>
                    restoreCompanion(companion, at),
                  );
                }}
              >
                {ui("play.companions.remove")}
              </button>
            </div>
            {shown !== kindName && <p class="muted companion-kind">{kindName}</p>}
            {max !== undefined ? (
              <CompanionHp companion={companion} max={max} />
            ) : (
              <label class="field">
                <span>{ui("play.companions.maxHp")}</span>
                <input
                  type="number"
                  min={1}
                  value={companion.maxHp ?? ""}
                  onInput={(e) => {
                    const n = Number.parseInt(e.currentTarget.value, 10);
                    changeCompanion(companion.id, (x) => ({
                      ...x,
                      maxHp: n > 0 ? n : undefined,
                    }));
                  }}
                />
                <small class="muted">{ui("play.companions.noMax")}</small>
              </label>
            )}
            <details class="companion-block">
              <summary>{ui("play.companions.statBlock")}</summary>
              {monster ? (
                <MonsterBlock id={companion.monster} owner={owner} />
              ) : (
                <p class="muted">…</p>
              )}
            </details>
          </div>
        );
      })}
      {adding ? (
        c.monsters ? (
          <label class="field">
            <span>{ui("play.companions.pick")}</span>
            <select
              value=""
              onChange={(e) => {
                const id = e.currentTarget.value;
                if (id) addCompanion(id);
                setAdding(false);
              }}
            >
              <option value="">{"—"}</option>
              <optgroup label={ui("play.companions.familiars")}>
                {familiars.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={ui("play.companions.others")}>
                {others.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
        ) : (
          <p class="muted">{ui("rules.loading")}</p>
        )
      ) : (
        <button type="button" class="secondary" onClick={() => setAdding(true)}>
          {ui("play.companions.add")}
        </button>
      )}
    </Panel>
  );
}
