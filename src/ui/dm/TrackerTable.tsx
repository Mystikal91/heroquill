import { encounter, infoFor, liveIds } from "../../app/dm";
import { type DmColumn, dmColumns, gridTemplate, visibleColumns } from "../../app/dmColumns";
import { typeText } from "../../app/monsterView";
import { content } from "../../app/store";
import {
  type Combatant,
  type Encounter,
  effectCount,
  initiativeOrder,
  isDown,
  rollInitiative,
} from "../../engine/encounter";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { DieIcon, InfoIcon, PawIcon, ShieldIcon } from "../icons";
import { CellPopover } from "./CellPopover";
import { EffectsEditor, HpEditor, InitEditor } from "./Editors";

/** The second line under a name: what the creature is. */
function kindLine(c: Combatant): string {
  if (c.kind === "character") return ui("dm.kind.character");
  if (c.kind === "monster" && c.source) {
    const type = (content.value?.index.get(c.source)?.data as { type?: string } | undefined)?.type;
    return type ? typeText(type) : "";
  }
  return "";
}

/** The slugs of the conditions in force, separated by spaces: what the row's colours key on. */
function conditionSlugs(c: Combatant): string {
  return c.conditions
    .map((id) => id.split("/")[1])
    .filter(Boolean)
    .join(" ");
}

function EffectsCell({ c }: { c: Combatant }) {
  const n = effectCount(c);
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
      {(close) => (
        <>
          <h4 class="dm-pop-title">{ui("play.activeEffects")}</h4>
          <EffectsEditor c={c} close={close} />
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

/** Initiative: a circle with the number, or a dashed circle with a die while it is not known. It opens the editor. */
function InitCell({ c }: { c: Combatant }) {
  const bonus = c.initiativeBonus >= 0 ? `+${c.initiativeBonus}` : String(c.initiativeBonus);
  return (
    <CellPopover
      title={ui("dm.initEdit", { name: c.name })}
      class="dm-init-button"
      align="start"
      trigger={
        <span class="dm-init-circle" data-empty={c.initiative === undefined || undefined}>
          {c.initiative === undefined ? <DieIcon /> : c.initiative}
        </span>
      }
    >
      {(close) => (
        <InitEditor c={c} bonus={bonus} close={close} roll={() => rollInitiative(c).total} />
      )}
    </CellPopover>
  );
}

function Cell({
  col,
  c,
  columns,
}: {
  col: DmColumn;
  c: Combatant;
  columns: readonly DmColumn[];
}) {
  switch (col) {
    case "init":
      return (
        <td data-col="init">
          <InitCell c={c} />
        </td>
      );
    case "name": {
      const sub = [kindLine(c), isDown(c) ? ui("dm.down") : ""].filter(Boolean).join(" · ");
      const live = liveIds.value.has(c.id);
      const label = live ? ui("dm.live") : ui("dm.manual");
      const player = c.kind === "character";
      return (
        <td data-col="name" class="dm-name">
          {/* The whole name opens the details of the creature. */}
          <button
            type="button"
            class="dm-name-button"
            title={ui("dm.info", { name: c.name })}
            aria-label={ui("dm.info", { name: c.name })}
            onClick={() => {
              infoFor.value = c.id;
            }}
          >
            <span
              class="dm-token"
              data-kind={player ? "player" : "creature"}
              title={player ? ui("dm.kind.character") : ui("dm.kind.creature")}
              aria-hidden="true"
            >
              {player ? <ShieldIcon /> : <PawIcon />}
            </span>
            <span class="dm-name-line">
              <span class="dm-name-text">{c.name}</span>
              <span class="dm-name-info" aria-hidden="true">
                <InfoIcon />
              </span>
              {player && (
                <span
                  class="dm-dot"
                  data-live={live || undefined}
                  role="img"
                  aria-label={label}
                  title={label}
                />
              )}
            </span>
            <span class="dm-sub">{sub}</span>
          </button>
          {/* On a narrow table armor class, speed and effects come here instead of columns of their own. */}
          <span class="dm-extra">
            {columns.includes("ac") && (
              <span>
                {ui("dm.col.ac")} {c.ac}
              </span>
            )}
            {columns.includes("speed") && c.speed !== undefined && <span>{distance(c.speed)}</span>}
            {columns.includes("cond") && <EffectsCell c={c} />}
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
          <EffectsCell c={c} />
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
                {ui(`dm.col.${col}` as UiKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {initiativeOrder(e.combatants).map((c) => (
            <tr
              key={c.id}
              data-active={c.id === turn || undefined}
              data-down={isDown(c) || undefined}
              data-kind={c.kind}
              data-conditions={conditionSlugs(c) || undefined}
              data-focus={c.effects.some((x) => x.concentration) || undefined}
              aria-current={c.id === turn ? "step" : undefined}
            >
              {columns.map((col) => (
                <Cell key={col} col={col} c={c} columns={columns} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
