import { changePlay } from "../../app/play";
import { character, content } from "../../app/store";
import { resourceLeft, setResourceUsed } from "../../engine/play";
import type { ClassResource } from "../../engine/resources";
import { type UiKey, ui } from "../../i18n/ui";
import { reserveName } from "../reserveName";

/** What a limited-use resource is called: a name written by the person, a free spell, its entry or its kind. */
export function resourceLabel(r: ClassResource): string {
  return (
    r.name ??
    (r.reserve && reserveName(r.reserve)) ??
    (r.spell && ui("resource.freeSpell", { name: content.value?.name(r.spell) ?? "" })) ??
    (r.entry && content.value?.name(r.entry)) ??
    ui(`resource.${r.kind}` as UiKey, { level: r.level ?? 0 })
  );
}

/** When the uses come back, as a short word. */
export const recoveryLabel = (r: ClassResource) =>
  ui(r.recovery === "short" ? "play.recoverShort" : "play.recoverLong");

/** The uses of a feature to tick off: gems to tap, or a counter for what is counted in points. */
export function ResourceControl({ r }: { r: ClassResource }) {
  const play = character.value.play;
  const left = resourceLeft(play, r.id, r.max);
  const label = resourceLabel(r);
  const spend = (change: number) =>
    changePlay((p) => setResourceUsed(p, r.id, (p.resourcesUsed?.[r.id] ?? 0) + change, r.max));

  if (r.unlimited) return <span class="muted">{ui("play.unlimited")}</span>;
  if (r.pool)
    return (
      <span class="res-control">
        <span class="counter">
          <button
            type="button"
            class="secondary"
            aria-label={`${label} −`}
            disabled={left === 0}
            onClick={() => spend(1)}
          >
            −
          </button>
          <b>{ui("play.slotLeft", { left, total: r.max })}</b>
          <button
            type="button"
            class="secondary"
            aria-label={`${label} +`}
            disabled={left === r.max}
            onClick={() => spend(-1)}
          >
            +
          </button>
        </span>
      </span>
    );
  return (
    <span class="res-control">
      <span class="pips-btns">
        {Array.from({ length: r.max }, (_, i) => {
          const available = i < left;
          return (
            <button
              type="button"
              key={`${r.id}-${i + 1}`}
              class={`pip-btn${available ? " on" : ""}`}
              aria-pressed={available}
              aria-label={`${label} ${i + 1}`}
              onClick={() => spend(available ? 1 : -1)}
            />
          );
        })}
      </span>
      <span class="muted">{ui("play.slotLeft", { left, total: r.max })}</span>
    </span>
  );
}
