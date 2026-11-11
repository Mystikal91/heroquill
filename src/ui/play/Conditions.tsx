import { addLog, changePlay } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { offerUndo } from "../../app/undo";
import {
  MAX_EXHAUSTION,
  exhaustionLevel,
  isExhaustionCondition,
  setExhaustion,
} from "../../engine/exhaustion";
import {
  MAX_ROUNDS,
  advanceRound,
  endConcentration,
  endRage,
  endSacredWeapon,
  endShillelagh,
  roundsLeft,
  setRounds,
  toggleCondition,
} from "../../engine/play";
import { inRuleset } from "../../engine/rulesets";
import { type UiKey, ui } from "../../i18n/ui";
import { Panel, Paragraphs } from "../sheet/parts";
import { useHoldRepeat } from "../useHoldRepeat";
import { ConditionIcon } from "./icons";

/** The slug of a condition: `srd51:condition/blinded` is `blinded`. */
const slugOf = (id: string) => id.split("/")[1] ?? "";

/** How many rounds a condition has left: a number to type, with buttons to change it; nothing is no limit. */
function RoundsField({ id, name }: { id: string; name: string }) {
  const hold = useHoldRepeat();
  const left = roundsLeft(character.value.play, id) ?? 0;
  const set = (n: number) => changePlay((p) => setRounds(p, id, n), { undo: false });
  return (
    <div class="cond-rounds">
      <span>{ui("play.conditionRounds")}</span>
      <button
        type="button"
        class="card-btn hold"
        aria-label={ui("play.roundsFewer", { name })}
        disabled={left === 0}
        {...hold(() => set(Math.max(0, (roundsLeft(character.value.play, id) ?? 0) - 1)))}
      >
        −
      </button>
      <input
        type="number"
        min={0}
        max={MAX_ROUNDS}
        inputMode="numeric"
        placeholder="—"
        aria-label={`${ui("play.conditionRounds")}: ${name}`}
        value={left === 0 ? "" : left}
        onInput={(e) => set(Number.parseInt(e.currentTarget.value, 10) || 0)}
      />
      <button
        type="button"
        class="card-btn hold"
        aria-label={ui("play.roundsMore", { name })}
        {...hold(() => set(Math.min(MAX_ROUNDS, (roundsLeft(character.value.play, id) ?? 0) + 1)))}
      >
        +
      </button>
    </div>
  );
}

/**
 * Exhaustion is not a switch like the other conditions: it has levels (1 to 6), each with its effects, that a long rest
 * takes off one at a time. Its button in the list gives the first level and shows this card, with the level to change
 * and what the level does; taking off the first level (or a long rest) removes the card.
 */
function Exhaustion() {
  const play = character.value.play;
  const ruleset = character.value.ruleset;
  const level = exhaustionLevel(play);
  const set = (n: number) => changePlay((p) => setExhaustion(p, n), { undo: false });
  const lines =
    ruleset === "srd52"
      ? level > 0
        ? [ui("play.exhaustion24", { d20: 2 * level, feet: 5 * level })]
        : []
      : Array.from({ length: level }, (_, i) => ui(`play.exhaustion14.${i + 1}` as UiKey));
  return (
    <ul class="plain card-list">
      <li
        class="play-card cond-card exhaustion-card"
        data-condition="exhaustion"
        data-level={level}
      >
        <span class="card-badge" aria-hidden="true">
          <ConditionIcon />
        </span>
        <div class="card-head">
          <b class="feat-name">{ui("play.exhaustion")}</b>
          <span class="card-meta">
            {ui("play.exhaustionLevel", { n: level, max: MAX_EXHAUSTION })}
          </span>
        </div>
        <div class="cond-rounds">
          <button
            type="button"
            class="card-btn"
            aria-label={ui("play.exhaustionFewer")}
            disabled={level === 0}
            onClick={() => set(level - 1)}
          >
            −
          </button>
          <output>{level}</output>
          <button
            type="button"
            class="card-btn"
            aria-label={ui("play.exhaustionMore")}
            disabled={level >= MAX_EXHAUSTION}
            onClick={() => set(level + 1)}
          >
            +
          </button>
        </div>
        <ul class="plain exhaustion-effects">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {level >= MAX_EXHAUSTION && <li>{ui("play.exhaustionDead")}</li>}
        </ul>
        <p class="muted">{ui("play.exhaustionRest")}</p>
      </li>
    </ul>
  );
}

/**
 * The conditions of the rules: the ones in force first, as cards with their rules and a button that
 * removes them; the list of all of them stays folded until a new one is wanted.
 */
export function Conditions() {
  const c = content.value;
  const play = character.value.play;
  if (!c) return null;
  const conditions = [...c.index.values()]
    .filter((e) => e.kind === "condition" && inRuleset(e.id, character.value.ruleset))
    .sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));
  // Exhaustion has its own card, which is there from the first level on; the button of the list gives that level.
  const tired = exhaustionLevel(play) > 0;
  const active = conditions.filter(
    (e) => play.conditions.includes(e.id) && !isExhaustionCondition(e.id),
  );
  const others = conditions.filter(
    (e) => !active.includes(e) && !(isExhaustionCondition(e.id) && tired),
  );
  const toggle = (id: string) =>
    changePlay((p) => (isExhaustionCondition(id) ? setExhaustion(p, 1) : toggleCondition(p, id)));
  const immune = sheet.value?.conditionImmunities ?? [];
  // What else runs by rounds: the concentration, the rage and the cantrip Shillelagh.
  const running = (["concentration", "rage", "shillelagh", "sacredWeapon"] as const).filter(
    (id) => roundsLeft(play, id) !== undefined,
  );
  const timed = Object.keys(play.rounds ?? {}).length > 0;
  // The button is there whenever something is in force, and greyed while nothing counts rounds: it
  // does not appear under the finger of someone who is still setting the first number.
  const showRound = timed || active.length > 0 || running.length > 0;
  const stop = (id: "concentration" | "rage" | "shillelagh" | "sacredWeapon") =>
    changePlay(
      (p) =>
        id === "concentration"
          ? endConcentration(p)
          : id === "rage"
            ? endRage(p)
            : id === "sacredWeapon"
              ? endSacredWeapon(p)
              : endShillelagh(p),
      { undo: false },
    );
  const nameOf = (id: string): string =>
    id === "concentration"
      ? ui("play.concentrating", { spell: c.name(play.concentration ?? "") })
      : id === "rage"
        ? c.name(
            character.value.ruleset === "srd52"
              ? "srd52:feature/barbarian-rage"
              : "srd51:feature/rage",
          )
        : id === "shillelagh"
          ? ui("play.shillelagh")
          : id === "sacredWeapon"
            ? ui("play.sacredWeapon")
            : c.name(id);
  // Passing the round takes one off every condition that has a limit, and ends those that run out.
  const passRound = () => {
    const before = structuredClone(character.value.play);
    const { play: after, ended } = advanceRound(before);
    changePlay(() => after, { undo: false });
    const names = ended.map(nameOf).join(", ");
    for (const id of ended) addLog({ label: nameOf(id), detail: ui("play.conditionEnded") });
    offerUndo(names ? ui("play.roundPassedEnded", { names }) : ui("play.roundPassed"), () =>
      changePlay(() => before, { undo: false }),
    );
  };

  return (
    <Panel title={ui("play.conditions")} className="conditions-panel">
      {immune.length > 0 && (
        <p class="muted">
          {ui("sheet.immunities")}: {immune.map((id) => c.name(id)).join(", ")}
        </p>
      )}
      {showRound && (
        <button
          type="button"
          class="card-btn card-primary next-round"
          disabled={!timed}
          title={timed ? undefined : ui("play.nextRoundHint")}
          onClick={passRound}
        >
          {ui("play.nextRound")}
        </button>
      )}
      {running.length > 0 && (
        <ul class="plain round-strip">
          {running.map((id) => {
            const n = roundsLeft(play, id) ?? 0;
            return (
              <li key={id} data-timer={id}>
                <b>{nameOf(id)}</b>
                <span>{ui(n === 1 ? "play.roundsLeftOne" : "play.roundsLeft", { n })}</span>
                <button
                  type="button"
                  class="card-btn cond-remove"
                  aria-label={`${ui("play.conditionRemove")}: ${nameOf(id)}`}
                  title={ui("play.conditionRemove")}
                  onClick={() => stop(id)}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {tired && <Exhaustion />}
      {active.length > 0 && (
        <ul class="plain card-list">
          {active.map((e) => (
            <li class="play-card cond-card" data-condition={slugOf(e.id)} key={e.id}>
              <span class="card-badge" aria-hidden="true">
                <ConditionIcon />
              </span>
              <div class="card-head">
                <b class="feat-name">{c.name(e.id)}</b>
                <span class="card-meta">
                  {ui("play.conditionActive")}
                  {roundsLeft(play, e.id) !== undefined &&
                    ` · ${ui(roundsLeft(play, e.id) === 1 ? "play.roundsLeftOne" : "play.roundsLeft", { n: roundsLeft(play, e.id) ?? 0 })}`}
                </span>
              </div>
              <button
                type="button"
                class="card-btn cond-remove"
                aria-label={`${ui("play.conditionRemove")}: ${c.name(e.id)}`}
                title={ui("play.conditionRemove")}
                onClick={() => toggle(e.id)}
              >
                ✕
              </button>
              <RoundsField id={e.id} name={c.name(e.id)} />
              <details class="cond-rules">
                <summary>{ui("play.conditionRules")}</summary>
                <Paragraphs text={c.text(e.id, "desc")} />
              </details>
            </li>
          ))}
        </ul>
      )}
      <details class="add-condition" open={active.length === 0}>
        <summary>{ui("play.addCondition")}</summary>
        <p class="muted">{ui("play.conditionsHint")}</p>
        <div class="cond-picks">
          {others.map((e) => (
            <button
              type="button"
              key={e.id}
              class="card-btn cond-pick"
              data-condition={slugOf(e.id)}
              aria-pressed={false}
              onClick={() => toggle(e.id)}
            >
              {c.name(e.id)}
            </button>
          ))}
        </div>
      </details>
    </Panel>
  );
}
