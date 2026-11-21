import {
  type DM_COLUMNS,
  REQUIRED_COLUMNS,
  defaultColumns,
  dmColumns,
  moveColumn,
  setDmColumns,
  toggleColumn,
} from "../../app/dmColumns";
import { type UiKey, ui } from "../../i18n/ui";
import { ColumnsIcon } from "../icons";
import { CellPopover } from "./CellPopover";

/** The button that chooses which columns the table shows and in what order. */
export function ColumnsEditor() {
  return (
    <CellPopover
      align="end"
      class="dm-tool dm-tool-quiet"
      title={ui("dm.columns")}
      trigger={
        <>
          <ColumnsIcon />
          <span class="dm-tool-label">{ui("dm.columns")}</span>
        </>
      }
    >
      {() => {
        const settings = dmColumns.value;
        const name = (col: (typeof DM_COLUMNS)[number]) => ui(`dm.colName.${col}` as UiKey);
        return (
          <div class="dm-columns">
            <h4 class="dm-pop-title">{ui("dm.columns")}</h4>
            <p class="muted dm-columns-hint">{ui("dm.columns.hint")}</p>
            <ol class="plain dm-columns-list">
              {settings.order.map((col, i) => {
                const required = REQUIRED_COLUMNS.includes(col);
                return (
                  <li key={col}>
                    <label class="dm-columns-check">
                      <input
                        type="checkbox"
                        checked={!settings.hidden.includes(col)}
                        disabled={required}
                        onChange={() => setDmColumns(toggleColumn(settings, col))}
                      />
                      <span>{name(col)}</span>
                    </label>
                    <span class="dm-columns-move">
                      <button
                        type="button"
                        disabled={i === 0}
                        aria-label={ui("dm.columns.up", { name: name(col) })}
                        onClick={() => setDmColumns(moveColumn(settings, col, -1))}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={i === settings.order.length - 1}
                        aria-label={ui("dm.columns.down", { name: name(col) })}
                        onClick={() => setDmColumns(moveColumn(settings, col, 1))}
                      >
                        ↓
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>
            <button type="button" class="secondary" onClick={() => setDmColumns(defaultColumns())}>
              {ui("dm.columns.reset")}
            </button>
          </div>
        );
      }}
    </CellPopover>
  );
}
