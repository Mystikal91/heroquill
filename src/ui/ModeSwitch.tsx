import { mode, setMode } from "../app/navigation";
import { ui } from "../i18n/ui";

/**
 * Player or Dungeon Master: the two sides of the app. In the header on a wide screen, at the top of the
 * menu on a phone (`place`), where the header has no room for it.
 */
export function ModeSwitch({ place }: { place: "header" | "menu" }) {
  const current = mode.value;
  return (
    <fieldset class={`mode-switch mode-switch-${place}`}>
      <legend class="sr-only">{ui("mode.label")}</legend>
      <button type="button" aria-pressed={current === "player"} onClick={() => setMode("player")}>
        {ui("mode.player")}
      </button>
      <button type="button" aria-pressed={current === "master"} onClick={() => setMode("master")}>
        {ui("mode.master")}
      </button>
    </fieldset>
  );
}

/** On a phone the switch is in the menu: a small mark beside the name of the app says which side is open. */
export function ModeBadge() {
  if (mode.value !== "master") return null;
  return <span class="mode-badge">{ui("mode.master")}</span>;
}
