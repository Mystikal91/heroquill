import { applyArea, areaAmount, areaPicks, areaType, leaveArea, pickCreatures } from "../../app/dm";
import { ui } from "../../i18n/ui";
import { DamageTypeChips } from "./Editors";
import { NumberField } from "./NumberField";

/** Damage to several creatures at once: the amount and kind, who is hit in full and who saved, and the button that deals it. */
export function AreaPanel() {
  const picks = Object.values(areaPicks.value);
  const full = picks.filter((p) => p === "fail").length;
  const half = picks.filter((p) => p === "save").length;
  const ready = areaAmount.value > 0 && picks.length > 0;
  return (
    <section class="dm-area" aria-label={ui("dm.area")}>
      <h4>{ui("dm.area")}</h4>
      <p class="muted">{ui("dm.area.hint")}</p>
      <div class="dm-area-amount">
        <div class="field">
          <span>{ui("play.amount")}</span>
          <NumberField
            label={ui("play.amount")}
            min={0}
            max={99999}
            value={areaAmount.value || undefined}
            onChange={(n) => {
              areaAmount.value = n ?? 0;
            }}
          />
        </div>
        <DamageTypeChips
          value={areaType.value}
          onChange={(k) => {
            areaType.value = k;
          }}
        />
      </div>
      <div class="dm-area-actions">
        <button type="button" onClick={pickCreatures}>
          {ui("dm.area.all")}
        </button>
        <button
          type="button"
          onClick={() => {
            areaPicks.value = {};
          }}
        >
          {ui("dm.area.clear")}
        </button>
        <output class="dm-area-count">{ui("dm.area.count", { full, half })}</output>
        <button type="button" class="primary" disabled={!ready} onClick={applyArea}>
          {ui("dm.area.apply", { n: picks.length })}
        </button>
        <button type="button" class="secondary" onClick={leaveArea}>
          {ui("confirm.cancel")}
        </button>
      </div>
    </section>
  );
}
