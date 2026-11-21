import { useState } from "preact/hooks";
import { character, updateCharacter } from "../app/store";
import {
  type PointBuyRules,
  defaultPointCost,
  pointBuyProblem,
  restartPointBuy,
  standardPointBuy,
} from "../engine/abilityScores";
import { ui } from "../i18n/ui";

/** The fields as the person types them: text, so a half-written number is not forced to a value. */
interface Draft {
  budget: string;
  min: string;
  max: string;
  /** What each score costs in all, by score. */
  costs: Record<string, string>;
}

const draftOf = (rules: PointBuyRules): Draft => ({
  budget: String(rules.budget),
  min: String(rules.min),
  max: String(rules.max),
  costs: Object.fromEntries(
    Object.entries(rules.costs).map(([score, cost]) => [score, String(cost)]),
  ),
});

/** The scores the table lists: from the lowest to the highest, when both make sense. */
function scoresOf(draft: Draft): number[] {
  const min = Number.parseInt(draft.min, 10);
  const max = Number.parseInt(draft.max, 10);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max > 30 || min > max) return [];
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

const costText = (draft: Draft, score: number) =>
  draft.costs[score] ?? String(defaultPointCost(score));

function rulesOf(draft: Draft): PointBuyRules {
  const scores = scoresOf(draft);
  return {
    budget: Number(draft.budget === "" ? Number.NaN : draft.budget),
    min: Number(draft.min === "" ? Number.NaN : draft.min),
    max: Number(draft.max === "" ? Number.NaN : draft.max),
    costs: Object.fromEntries(
      scores.map((n) => {
        const text = costText(draft, n);
        return [n, Number(text === "" ? Number.NaN : text)];
      }),
    ),
  };
}

/**
 * The point buy's own rules, closed by default: the points to spend, the lowest and highest score and
 * the price of each. Changes wait for "Apply", which starts the point buy again at the lowest score.
 */
export function PointBuyRulesEditor() {
  const c = character.value;
  const current = c.pointBuyRules ?? standardPointBuy();
  const [draft, setDraft] = useState<Draft>(() => draftOf(current));
  const rules = rulesOf(draft);
  const problem = scoresOf(draft).length === 0 ? "range" : pointBuyProblem(rules);
  const changed = JSON.stringify(rules) !== JSON.stringify(current);
  const custom = c.pointBuyRules !== undefined;

  const set = (field: "budget" | "min" | "max", value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  return (
    <details class="pb-rules">
      <summary>{ui("abilities.custom")}</summary>
      <div class="pb-fields">
        <label class="field">
          <span>{ui("abilities.custom.budget")}</span>
          <input
            type="number"
            value={draft.budget}
            onInput={(e) => set("budget", e.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>{ui("abilities.custom.min")}</span>
          <input
            type="number"
            value={draft.min}
            onInput={(e) => set("min", e.currentTarget.value)}
          />
        </label>
        <label class="field">
          <span>{ui("abilities.custom.max")}</span>
          <input
            type="number"
            value={draft.max}
            onInput={(e) => set("max", e.currentTarget.value)}
          />
        </label>
      </div>

      {scoresOf(draft).length > 0 && (
        <table class="pb-costs">
          <thead>
            <tr>
              <th scope="col">{ui("abilities.custom.score")}</th>
              <th scope="col">{ui("abilities.custom.cost")}</th>
            </tr>
          </thead>
          <tbody>
            {scoresOf(draft).map((score) => (
              <tr key={score}>
                <th scope="row">{score}</th>
                <td>
                  <input
                    type="number"
                    aria-label={ui("abilities.custom.costOf", { score })}
                    value={costText(draft, score)}
                    onInput={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((d) => ({ ...d, costs: { ...d.costs, [score]: value } }));
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p class="muted pb-note">{ui("abilities.custom.note")}</p>
      {problem && changed && (
        <p class="pb-problem" role="alert">
          {ui(problem === "range" ? "abilities.custom.badRange" : "abilities.custom.badBudget")}
        </p>
      )}
      <div class="pb-actions">
        <button
          type="button"
          disabled={!changed || problem !== undefined}
          onClick={() => updateCharacter((d) => restartPointBuy(d, rules))}
        >
          {ui("abilities.custom.apply")}
        </button>
        <button
          type="button"
          class="secondary"
          disabled={!custom && !changed}
          onClick={() => {
            if (custom) updateCharacter((d) => restartPointBuy(d, undefined));
            setDraft(draftOf(standardPointBuy()));
          }}
        >
          {ui("abilities.custom.reset")}
        </button>
      </div>
    </details>
  );
}
