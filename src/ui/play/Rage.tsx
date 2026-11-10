import { startRage, stopRage } from "../../app/play";
import { character, sheet } from "../../app/store";
import { resourceLeft } from "../../engine/play";
import { ui } from "../../i18n/ui";
import { Panel } from "../sheet/parts";
import { FlameIcon } from "./icons";

/** A line that says the barbarian is raging: the whole screen turns red as a reminder. */
export function RageStrip({ wide = false }: { wide?: boolean }) {
  if (!character.value.play.raging) return null;
  return (
    <output class={`form-strip rage${wide ? " wide" : ""}`}>
      <FlameIcon />
      <span>{ui("play.rage.active")}</span>
      <FlameIcon />
    </output>
  );
}

/** Rage: one button to enter it (spending a use) and one to end it, with what it does. */
export function Rage() {
  const s = sheet.value;
  const play = character.value.play;
  const resource = s?.resources.find((r) => r.kind === "rage");
  if (!s || !resource) return null;
  const left = resourceLeft(play, resource.id, resource.max);
  const bonus = s.extraDamage.find((e) => e.kind === "rage");
  const canEnter = resource.unlimited || left > 0;

  return (
    <Panel title={ui("play.rage")}>
      {play.raging ? (
        <>
          <p class="muted">
            {ui(character.value.ruleset === "srd52" ? "play.rage.rules2024" : "play.rage.rules", {
              n: bonus?.kind === "rage" ? bonus.bonus : 0,
            })}
          </p>
          <button type="button" class="secondary" onClick={stopRage}>
            {ui("play.rage.end")}
          </button>
        </>
      ) : (
        <>
          <p class="muted">
            {resource.unlimited
              ? ui("play.rage.unlimited")
              : ui("play.rage.uses", { left, max: resource.max })}
          </p>
          {canEnter ? (
            <button type="button" class="rage-btn" onClick={startRage}>
              <FlameIcon /> {ui("play.rage.enter")}
            </button>
          ) : (
            <p class="muted">{ui("play.rage.noUses")}</p>
          )}
        </>
      )}
    </Panel>
  );
}
