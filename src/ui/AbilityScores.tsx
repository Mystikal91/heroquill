import { character, content, sheet, updateCharacter } from "../app/store";
import { ABILITIES, type Ability } from "../data/schema";
import {
  applyAbilityMethod,
  assignValue,
  assignableValues,
  canLower,
  canRaise,
  pointBuyCost,
  pointBuyRemaining,
  reroll,
  standardPointBuy,
} from "../engine/abilityScores";
import type { AbilityMethod } from "../engine/character";
import { checkNeeds, needsOf } from "../engine/optionNeeds";
import { type UiKey, signed, ui } from "../i18n/ui";
import { PointBuyRulesEditor } from "./PointBuyRules";
import { entriesOfKind } from "./build/fields";
import { needLabel } from "./needLabel";

const METHODS: AbilityMethod[] = ["manual", "standard", "pointbuy", "roll"];
const asNumber = (value: string, fallback: number) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

export function AbilityScores() {
  const c = character.value;
  const ct = content.value;
  const s = sheet.value;
  const ruleset = c.ruleset;
  const abbreviation = (a: Ability) => ct?.text(`${ruleset}:ability/${a}`, "abbreviation") ?? a;
  const fullName = (a: Ability) => ct?.name(`${ruleset}:ability/${a}`) ?? a;
  const rules = c.pointBuyRules ?? standardPointBuy();
  const values = [...new Set(assignableValues(c))].sort((a, b) => b - a);

  return (
    <fieldset>
      <legend>{ui("form.abilities")}</legend>

      <label class="field">
        <span>{ui("abilities.method")}</span>
        <select
          value={c.abilityMethod}
          onChange={(e) => {
            const method = e.currentTarget.value as AbilityMethod;
            updateCharacter((d) => applyAbilityMethod(d, method));
          }}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {ui(`abilities.method.${m}` as UiKey)}
            </option>
          ))}
        </select>
      </label>

      {c.abilityMethod === "pointbuy" && <PointsBar />}
      {c.abilityMethod === "pointbuy" && <PointBuyRulesEditor key={c.id} />}
      {c.abilityMethod === "roll" && (
        <button type="button" class="secondary" onClick={() => updateCharacter((d) => reroll(d))}>
          {ui("abilities.roll")}
        </button>
      )}

      <div class="ability-cards">
        {ABILITIES.map((ability) => {
          const derived = s?.abilities[ability];
          const bonus = derived?.bonus ?? 0;
          return (
            <div class="ability-card" key={ability}>
              <div class="ac-head">
                <b>{abbreviation(ability)}</b>
                <span class="ac-name">{fullName(ability)}</span>
              </div>
              <div class="ac-control">
                {c.abilityMethod === "manual" && (
                  <input
                    type="number"
                    min={1}
                    max={30}
                    aria-label={fullName(ability)}
                    value={c.abilityBase[ability]}
                    onInput={(e) => {
                      // An emptied field stays empty while the person types the new number.
                      if (e.currentTarget.value === "") return;
                      const n = asNumber(e.currentTarget.value, 10);
                      updateCharacter((d) => {
                        d.abilityBase[ability] = n;
                      });
                    }}
                    onBlur={(e) => {
                      e.currentTarget.value = String(c.abilityBase[ability]);
                    }}
                  />
                )}
                {(c.abilityMethod === "standard" || c.abilityMethod === "roll") && (
                  <select
                    aria-label={fullName(ability)}
                    value={String(c.abilityBase[ability])}
                    onChange={(e) => {
                      const n = asNumber(e.currentTarget.value, c.abilityBase[ability]);
                      updateCharacter((d) => {
                        d.abilityBase = assignValue(d.abilityBase, ability, n);
                      });
                    }}
                  >
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                )}
                {c.abilityMethod === "pointbuy" && (
                  <div class="stepper">
                    <button
                      type="button"
                      aria-label={ui("abilities.lower", { ability: fullName(ability) })}
                      disabled={!canLower(c.abilityBase, ability, rules)}
                      onClick={() =>
                        updateCharacter((d) => {
                          d.abilityBase[ability] -= 1;
                        })
                      }
                    >
                      −
                    </button>
                    <output>{c.abilityBase[ability]}</output>
                    <button
                      type="button"
                      aria-label={ui("abilities.raise", { ability: fullName(ability) })}
                      disabled={!canRaise(c.abilityBase, ability, rules)}
                      onClick={() =>
                        updateCharacter((d) => {
                          d.abilityBase[ability] += 1;
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              {derived && (
                <p class="ac-total">
                  {ui("abilities.total", { score: derived.score, mod: signed(derived.modifier) })}
                  {bonus !== 0 && (
                    <span class="bonus-hint">
                      {ui("abilities.bonus", { bonus: signed(bonus) })}
                    </span>
                  )}
                </p>
              )}
              {c.abilityMethod === "pointbuy" && (
                <p class="ac-cost">
                  {ui("abilities.cost", { points: pointBuyCost(c.abilityBase[ability], rules) })}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {s && s.asi.available > 0 && <ImprovementSlots />}
    </fieldset>
  );
}

/** Points left in the point buy, as words and as a bar that fills while they are spent. */
function PointsBar() {
  const base = character.value.abilityBase;
  const rules = character.value.pointBuyRules ?? standardPointBuy();
  const left = pointBuyRemaining(base, rules);
  const spent = rules.budget - left;
  return (
    <div class="points-bar">
      <p>
        <b>{ui("abilities.pointsLeft", { points: left })}</b>
        <span class="muted"> / {rules.budget}</span>
      </p>
      <div class="points-track" aria-hidden="true">
        <span style={{ width: `${Math.min(100, (spent / Math.max(1, rules.budget)) * 100)}%` }} />
      </div>
    </div>
  );
}

/** Feats can be taken in place of an ability score improvement, when the content has any. */
function FeatPicker() {
  const c = character.value;
  const s = sheet.value;
  const ct = content.value;
  if (!s || !ct) return null;
  const scores = Object.fromEntries(Object.entries(s.abilities).map(([id, a]) => [id, a.score]));
  const state = { level: s.level, held: new Set(s.held), scores };
  // A feat that asks for something the character lacks stays in the list, greyed, with what it asks.
  // The 2024 feats of other categories are given by a class or a background; the ability score
  // increase is the build screen's own steps.
  const pickable = (id: string) => {
    const data = ct.index.get(id)?.data;
    return data?.builtIn !== true && (data?.category === undefined || data.category === "general");
  };
  const options = entriesOfKind("feat")
    .filter((o) => !c.feats.includes(o.id) && pickable(o.id))
    .map((o) => {
      const expression = needsOf(ct.index.get(o.id));
      const unmet = expression && !checkNeeds(expression, state, (w) => ct.index.has(w)).met;
      const asks = unmet ? needLabel(ct, c.ruleset, o.id, expression) : "";
      return { ...o, blocked: Boolean(unmet), label: asks ? `${o.label} (${asks})` : o.label };
    });
  if (options.length === 0 && c.feats.length === 0) return null;
  const left = s.asi.available - s.asi.used;

  return (
    <div class="feats">
      <h5>{ui("asi.feats")}</h5>
      {c.feats.length > 0 && (
        <ul class="plain">
          {c.feats.map((id) => (
            <li class="row-between" key={id}>
              <span>{ct.name(id)}</span>
              <button
                type="button"
                class="link"
                onClick={() =>
                  updateCharacter((d) => {
                    d.feats = d.feats.filter((f) => f !== id);
                  })
                }
              >
                {ui("form.remove")}
              </button>
            </li>
          ))}
        </ul>
      )}
      {left > 0 && options.length > 0 && (
        <label class="field">
          <span>{ui("asi.addFeat")}</span>
          <select
            value=""
            onChange={(e) => {
              const id = e.currentTarget.value;
              if (!id) return;
              updateCharacter((d) => {
                d.feats = [...d.feats, id];
              });
            }}
          >
            <option value="">{ui("form.none")}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id} disabled={o.blocked}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

function ImprovementSlots() {
  const c = character.value;
  const s = sheet.value;
  const ct = content.value;
  if (!s || !ct) return null;
  const name = (a: Ability) => ct.name(`${c.ruleset}:ability/${a}`);

  const setSlot = (index: number, first: Ability | "", second: Ability | "") => {
    updateCharacter((d) => {
      const slot = [first, second].filter((a): a is Ability => a !== "" && a !== undefined);
      const unique = [...new Set(slot)];
      if (unique.length === 0) d.asi.splice(index, 1);
      else d.asi[index] = unique;
    });
  };

  return (
    <div class="asi">
      <h4>{ui("asi.title", { used: s.asi.used, available: s.asi.available })}</h4>
      <p class="muted">{ui("asi.hint")}</p>
      <FeatPicker />
      {Array.from({ length: Math.max(0, s.asi.available - c.feats.length) }, (_, i) => {
        const slot = c.asi[i] ?? [];
        const first = slot[0] ?? "";
        const second = slot[1] ?? "";
        const options = (exclude: string) =>
          ABILITIES.filter((a) => a !== exclude).map((a) => (
            <option key={a} value={a}>
              {name(a)}
            </option>
          ));
        return (
          <div class="asi-slot" key={`asi-${i + 1}`}>
            <label class="field">
              <span>
                {ui("asi.slot", { n: i + 1 })} · {ui("asi.first")}
              </span>
              <select
                value={first}
                onChange={(e) => setSlot(i, e.currentTarget.value as Ability | "", second)}
              >
                <option value="">{ui("form.none")}</option>
                {options("")}
              </select>
            </label>
            {first && (
              <label class="field">
                <span>{ui("asi.second")}</span>
                <select
                  value={second}
                  onChange={(e) => setSlot(i, first, e.currentTarget.value as Ability | "")}
                >
                  <option value="">{ui("form.none")}</option>
                  {options(first)}
                </select>
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
