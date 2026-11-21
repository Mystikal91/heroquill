import { encounter, infoFor, liveIds, updateEncounter } from "../../app/dm";
import { type DmColumn, dmColumns, gridTemplate, visibleColumns } from "../../app/dmColumns";
import { typeText } from "../../app/monsterView";
import { content } from "../../app/store";
import {
  type Combatant,
  type Encounter,
  initiativeOrder,
  isDown,
  rollInitiative,
  setInitiative,
} from "../../engine/encounter";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { InfoIcon } from "../icons";
import { CellPopover } from "./CellPopover";
import { ConditionsEditor, HpEditor } from "./Editors";
import { NumberField } from "./NumberField";

/** The second line under a name: what the creature is. */
function kindLine(c: Combatant): string {
  if (c.kind === "character") return ui("dm.kind.character");
  if (c.kind === "monster" && c.source) {
    const type = (content.value?.index.get(c.source)?.data as { type?: string } | undefined)?.type;
    return type ? typeText(type) : "";
  }
  return "";
}

function ConditionsCell({ c }: { c: Combatant }) {
  const n = c.conditions.length;
  return (
    <CellPopover
      title={ui("dm.editConditions", { name: c.name })}
      class="dm-pill-button"
      trigger={
        <span class="dm-pill" data-on={n > 0 || undefined}>
          {n}
        </span>
      }
    >
      {() => (
        <>
          <h4 class="dm-pop-title">{ui("play.conditions")}</h4>
          <ConditionsEditor c={c} />
        </>
      )}
    </CellPopover>
  );
}

function HpCell({ c }: { c: Combatant }) {
  const percent = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
  const state = c.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  return (
    <CellPopover
      title={ui("dm.editHp", { name: c.name })}
      class="dm-hp-button"
      trigger={
        <>
          <span class="dm-hp-num">
            <b>{c.hp}</b>
            <span>/ {c.maxHp}</span>
            {c.tempHp > 0 && <em>+{c.tempHp}</em>}
          </span>
          <span class="dm-hp-bar" data-state={state} aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        </>
      }
    >
      {(close) => <HpEditor c={c} close={close} />}
    </CellPopover>
  );
}

function InitCell({ c }: { c: Combatant }) {
  const bonus = c.initiativeBonus >= 0 ? `+${c.initiativeBonus}` : String(c.initiativeBonus);
  return (
    <div class="dm-init">
      <NumberField
        class="dm-init-input"
        label={ui("dm.initiative")}
        placeholder="—"
        min={-99}
        max={999}
        value={c.initiative}
        onChange={(n) => updateEncounter((e) => setInitiative(e, c.id, n))}
      />
      {c.initiative === undefined && (
        <button
          type="button"
          class="dm-roll"
          title={ui("dm.rollOne", { bonus })}
          aria-label={ui("dm.rollOne", { bonus })}
          onClick={() => updateEncounter((e) => setInitiative(e, c.id, rollInitiative(c).total))}
        >
          d20
        </button>
      )}
    </div>
  );
}

function Cell({ col, c, columns }: { col: DmColumn; c: Combatant; columns: readonly DmColumn[] }) {
  switch (col) {
    case "live": {
      if (c.kind !== "character") return <td data-col="live" />;
      const live = liveIds.value.has(c.id);
      const label = live ? ui("dm.live") : ui("dm.manual");
      return (
        <td data-col="live">
          <span
            class="dm-dot"
            data-live={live || undefined}
            role="img"
            aria-label={label}
            title={label}
          />
        </td>
      );
    }
    case "init":
      return (
        <td data-col="init">
          <InitCell c={c} />
        </td>
      );
    case "name": {
      const sub = [kindLine(c), isDown(c) ? ui("dm.down") : ""].filter(Boolean).join(" · ");
      return (
        <td data-col="name" class="dm-name">
          <span class="dm-name-text">{c.name}</span>
          <span class="dm-sub">
            {sub}
            {/* On a narrow table speed and conditions come here instead of columns of their own. */}
            <span class="dm-extra">
              {columns.includes("ac") && (
                <span>
                  {ui("dm.col.ac")} {c.ac}
                </span>
              )}
              {columns.includes("speed") && c.speed !== undefined && (
                <span>{distance(c.speed)}</span>
              )}
              {columns.includes("cond") && <ConditionsCell c={c} />}
            </span>
          </span>
        </td>
      );
    }
    case "hp":
      return (
        <td data-col="hp">
          <HpCell c={c} />
        </td>
      );
    case "ac":
      return (
        <td data-col="ac" class="dm-num">
          {c.ac}
        </td>
      );
    case "speed":
      return (
        <td data-col="speed" class="dm-num">
          {c.speed !== undefined ? distance(c.speed) : "—"}
        </td>
      );
    case "cond":
      return (
        <td data-col="cond">
          <ConditionsCell c={c} />
        </td>
      );
  }
}

/** The initiative table: one row for each creature, in turn order, with what is read at a glance. */
export function TrackerTable({ e }: { e: Encounter }) {
  const columns = visibleColumns(dmColumns.value);
  const style = `--cols:${gridTemplate(columns)};--cols-narrow:${gridTemplate(columns, true)}`;
  const turn = encounter.value?.turn;
  return (
    <div class="dm-table-wrap">
      <table class="dm-table" style={style}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} data-col={col} scope="col">
                {col === "live" ? (
                  <span class="sr-only">{ui("dm.live")}</span>
                ) : (
                  ui(`dm.col.${col}` as UiKey)
                )}
              </th>
            ))}
            <th data-col="info" scope="col">
              <span class="sr-only">{ui("dm.infoHeader")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {initiativeOrder(e.combatants).map((c) => (
            <tr
              key={c.id}
              data-active={c.id === turn || undefined}
              data-down={isDown(c) || undefined}
              data-kind={c.kind}
              aria-current={c.id === turn ? "step" : undefined}
            >
              {columns.map((col) => (
                <Cell key={col} col={col} c={c} columns={columns} />
              ))}
              <td data-col="info">
                <button
                  type="button"
                  class="dm-info"
                  title={ui("dm.info", { name: c.name })}
                  aria-label={ui("dm.info", { name: c.name })}
                  onClick={() => {
                    infoFor.value = c.id;
                  }}
                >
                  <InfoIcon />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
