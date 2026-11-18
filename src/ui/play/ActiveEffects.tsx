import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { changePlay } from "../../app/play";
import { fold } from "../../app/search";
import { character, content } from "../../app/store";
import type { Effect } from "../../data/schema";
import { addCustomEffect, removeCustomEffect, setSpellActive } from "../../engine/play";
import { inRuleset } from "../../engine/rulesets";
import { EFFECT_TYPES } from "../../homebrew/catalog";
import { signed, ui } from "../../i18n/ui";
import { damageName } from "../damageName";
import { EffectList, summarize } from "../studio/Effects";
import { optionLabel } from "../studio/labels";
import { ConditionIcon } from "./icons";

/** Whether the window that adds an effect is open. */
export const addEffectOpen = signal(false);

/** The effects the window offers to write by hand: the ones that change a number or a defense of the sheet. */
const FREE_TYPES = new Set([
  "modifier",
  "defense",
  "damageReduction",
  "armorClassFloor",
  "abilityBonus",
  "abilityFloor",
  "movement",
  "sense",
  "conditionImmunity",
  "unarmoredDefense",
]);
const NOT_FREE = EFFECT_TYPES.filter((t) => !FREE_TYPES.has(t));

/** What an effect does, in a few words: "Armor class +2", "Resistances: fire". The rest is as the studio says it. */
export function effectLine(effect: Effect): string {
  switch (effect.type) {
    case "modifier":
      return effect.plus === undefined && effect.when === undefined && effect.minLevel === undefined
        ? `${optionLabel(effect.target)} ${signed(effect.value)}`
        : summarize(effect);
    case "defense":
      return `${ui(
        effect.kind === "resistance"
          ? "sheet.resistances"
          : effect.kind === "immunity"
            ? "sheet.immunities"
            : "sheet.vulnerabilities",
      )}: ${damageName(effect.damage)}`;
    case "damageReduction":
      return effect.plus === undefined
        ? `${ui("sheet.damageReduction")} \u2212${effect.value}${effect.damage ? ` (${effect.damage.map(damageName).join(", ")})` : ""}`
        : summarize(effect);
    case "armorClassFloor":
      return `${ui("fx.armorClassFloor")}: ${effect.value}`;
    default:
      return summarize(effect);
  }
}

/** The button of the panel: it opens the window to add an effect. */
export function AddEffectButton() {
  return (
    <button
      type="button"
      class="card-btn card-primary add-effect"
      aria-haspopup="dialog"
      onClick={() => {
        addEffectOpen.value = true;
      }}
    >
      {ui("play.addEffect")}
    </button>
  );
}

/** The effects in force that are not conditions: the spells turned on and the ones written by hand. */
export function ActiveEffectsList() {
  const c = content.value;
  const play = character.value.play;
  if (!c) return null;
  const spells = play.activeSpells ?? [];
  const custom = play.customEffects ?? [];
  if (spells.length === 0 && custom.length === 0) return null;
  return (
    <ul class="plain card-list">
      {spells.map((id) => (
        <li class="play-card cond-card effect-card" data-kind="spell" key={id}>
          <span class="card-badge" aria-hidden="true">
            <ConditionIcon />
          </span>
          <div class="card-head">
            <b class="feat-name">{c.name(id)}</b>
            <span class="card-meta">
              {[ui("play.spellEffect"), ...(c.index.get(id)?.effects ?? []).map(effectLine)].join(
                " · ",
              )}
            </span>
          </div>
          <button
            type="button"
            class="card-btn cond-remove"
            aria-label={`${ui("play.effectRemove")}: ${c.name(id)}`}
            title={ui("play.effectRemove")}
            onClick={() => changePlay((p) => setSpellActive(p, id, false))}
          >
            ✕
          </button>
        </li>
      ))}
      {custom.map((e) => (
        <li class="play-card cond-card effect-card" data-kind="custom" key={e.id}>
          <span class="card-badge" aria-hidden="true">
            <ConditionIcon />
          </span>
          <div class="card-head">
            <b class="feat-name">{e.name}</b>
            <span class="card-meta">{e.effects.map(effectLine).join(" · ")}</span>
          </div>
          <button
            type="button"
            class="card-btn cond-remove"
            aria-label={`${ui("play.effectRemove")}: ${e.name}`}
            title={ui("play.effectRemove")}
            onClick={() => changePlay((p) => removeCustomEffect(p, e.id))}
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The spells of the game that change a number of the sheet, by name: any of them can be put on the character. */
function effectSpells(): { id: string; name: string; level: number }[] {
  const c = content.value;
  if (!c) return [];
  return [...c.index.values()]
    .filter(
      (e) => e.kind === "spell" && e.effects.length > 0 && inRuleset(e.id, character.value.ruleset),
    )
    .map((e) => ({ id: e.id, name: c.name(e.id), level: Number(e.data.level ?? 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The window that adds an effect to the character: the spells that apply one (cast by another player or
 * the DM, so the character need not have them), and an effect of one's own. Mount it once, in the Play tab.
 */
export function AddEffectDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = addEffectOpen.value;
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [effects, setEffects] = useState<Effect[]>([]);
  const c = content.value;
  const play = character.value.play;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    addEffectOpen.value = false;
  };
  const spells = open
    ? effectSpells().filter((s) => fold(s.name).includes(fold(query.trim())))
    : [];
  const on = new Set(play.activeSpells ?? []);
  const add = () => {
    changePlay((p) => addCustomEffect(p, name, effects));
    setName("");
    setEffects([]);
    close();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog add-effect-dialog"
      aria-labelledby="add-effect-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {open && c && (
        <div class="spell-dialog-body">
          <button type="button" class="secondary close" onClick={close}>
            {ui("spells.closeInfo")}
          </button>
          <h3 id="add-effect-title">{ui("play.effectTitle")}</h3>
          <p class="muted">{ui("play.effectHint")}</p>

          <h4>{ui("play.effectSpells")}</h4>
          <input
            type="search"
            class="effect-search"
            value={query}
            placeholder={ui("play.effectSearch")}
            aria-label={ui("play.effectSearch")}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
          {spells.length === 0 ? (
            <p class="muted">{ui("play.effectNone")}</p>
          ) : (
            <div class="cond-picks effect-spells">
              {spells.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  class="card-btn cond-pick"
                  aria-pressed={on.has(s.id)}
                  onClick={() => changePlay((p) => setSpellActive(p, s.id, !on.has(s.id)))}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <h4>{ui("play.effectCustom")}</h4>
          <label class="field">
            <span>{ui("play.effectName")}</span>
            <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
          </label>
          <EffectList effects={effects} onChange={setEffects} hidden={NOT_FREE} />
          <button
            type="button"
            class="card-btn card-primary"
            disabled={name.trim() === "" || effects.length === 0}
            onClick={add}
          >
            {ui("play.effectAdd")}
          </button>
        </div>
      )}
    </dialog>
  );
}
