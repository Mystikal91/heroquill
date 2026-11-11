import { damageCharacter, rollCheck, vitals } from "../../app/play";
import { changePlay, hpUndo, undoHp } from "../../app/play";
import { PLAY_GROUPS, type PlayGroup, playGroup, showPlayGroup } from "../../app/playView";
import { character, content, sheet } from "../../app/store";
import { applyHealing, currentHp } from "../../engine/play";
import { beastPool, healBeast } from "../../engine/wildShape";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { ExplainButton } from "../Explain";
import { useHoldRepeat } from "../useHoldRepeat";
import { MoreButton } from "./MoreStats";
import { beastArmorClass } from "./beastArmorClass";
import { ChecksIcon, CombatIcon, MagicIcon, ResourcesIcon } from "./icons";

const ICONS: Record<PlayGroup, () => preact.JSX.Element> = {
  combat: CombatIcon,
  checks: ChecksIcon,
  magic: MagicIcon,
  resources: ResourcesIcon,
};

/**
 * What matters at every moment, pinned under the tabs: hit points with a tap to hurt or heal,
 * armor class, the roll for initiative, and flags for conditions and concentration.
 */
export function StatusBar() {
  const hold = useHoldRepeat();
  const s = sheet.value;
  const v = vitals();
  const play = character.value.play;
  const c = content.value;
  if (!s || !v || !c) return null;
  // In the shape of a beast the bar shows the beast: its hit points and its armor class.
  // A 2014 beast has hit points of its own; a 2024 shape has none (the druid's own show, with the temporary ones).
  const shape = beastPool(play);
  const beastAc = beastArmorClass(c, play);
  const max = shape ? shape.max : v.max;
  const hp = shape ? shape.hp : currentHp(play, v.max);
  const percent = max > 0 ? hp / max : 0;
  const state = hp === 0 ? "down" : percent <= 0.25 ? "low" : percent <= 0.5 ? "hurt" : "well";

  const undo = hpUndo.value;
  return (
    <>
      <div class="play-status" data-hp={state}>
        <div class="ps-hp">
          <button
            type="button"
            class="ps-step hold"
            aria-label={ui("play.damageBy", { n: 1 })}
            {...hold(() => damageCharacter(1))}
          >
            {"−"}
          </button>
          <button type="button" class="ps-value" onClick={() => showPlayGroup("combat")}>
            <b>{hp}</b>
            <span>/{max}</span>
            {!shape && play.tempHp > 0 && <em>+{play.tempHp}</em>}
          </button>
          <button
            type="button"
            class="ps-step hold"
            aria-label={ui("play.healBy", { n: 1 })}
            {...hold(() =>
              shape
                ? changePlay((p) => healBeast(p, 1), { undo: false })
                : changePlay((p) => applyHealing(p, v.max, 1)),
            )}
          >
            +
          </button>
        </div>
        {beastAc !== undefined ? (
          <span class="ps-stat">
            <small>{ui("play.ac")}</small>
            <b>{beastAc}</b>
          </span>
        ) : (
          <ExplainButton class="ps-stat" target={{ kind: "ac" }}>
            <small>{ui("play.ac")}</small>
            <b>{s.armorClass.value}</b>
          </ExplainButton>
        )}
        <button
          type="button"
          class="ps-stat ps-roll"
          onClick={() => rollCheck(ui("play.initiative"), s.initiative)}
        >
          <small>{ui("play.init")}</small>
          <b>{signed(s.initiative)}</b>
        </button>
        <MoreButton />
        {play.conditions.length > 0 && (
          <button
            type="button"
            class="ps-flag"
            aria-label={ui("play.conditionsCount", { n: play.conditions.length })}
            onClick={() => showPlayGroup("combat")}
          >
            {"⚠"} {play.conditions.length}
          </button>
        )}
        {play.concentration && (
          <button
            type="button"
            class="ps-flag"
            title={c.name(play.concentration)}
            onClick={() => showPlayGroup("magic")}
          >
            {"◎"}
          </button>
        )}
      </div>
      {undo && (
        <output class="hp-undo" key={undo.change}>
          <span>
            {undo.change > 0 ? "+" : "−"}
            {Math.abs(undo.change)} {ui("play.hpShort")}
          </span>
          <button type="button" class="link" onClick={undoHp}>
            {"↶"} {ui("play.undo")}
          </button>
        </output>
      )}
    </>
  );
}

/** The parts of the play screen on a phone, as tabs with a small picture each. */
export function GroupTabs({ groups }: { groups: PlayGroup[] }) {
  const active = playGroup.value;
  return (
    <div class="play-groups" role="tablist" aria-label={ui("play.groups")}>
      {PLAY_GROUPS.filter((g) => groups.includes(g)).map((g) => {
        const Picture = ICONS[g];
        return (
          <button
            type="button"
            role="tab"
            key={g}
            class={active === g ? "on" : ""}
            aria-selected={active === g}
            onClick={() => showPlayGroup(g)}
          >
            <Picture />
            <span>{ui(`play.group.${g}` as UiKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
