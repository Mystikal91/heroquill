import { canHide, customizing } from "../../app/playLayout";
import { type UiKey, ui } from "../../i18n/ui";

type Dir = "up" | "down" | "left" | "right";

const name = (panel: string) => ui(`play.panel.${panel}` as UiKey);

/**
 * The button that opens the arranging of the panels: at the end of the strip of quick numbers on
 * a wide screen, under the last panel on a phone, where it takes no room from the play.
 */
export function CustomizeButton() {
  return (
    <button
      type="button"
      class="customize-open"
      title={ui("play.customize")}
      onClick={() => {
        customizing.value = true;
        window.scrollTo({ top: 0 });
      }}
    >
      <span aria-hidden="true">{"⇄"}</span>
      <span class="customize-word">{ui("play.customize")}</span>
    </button>
  );
}

/** What the person can do while arranging: leave, choose the columns, go back to the plan. */
export function CustomizeToolbar({
  count,
  choice,
  arranged,
  onChoice,
  onReset,
}: {
  /** The columns on screen. */
  count: 1 | 2 | 3;
  /** Whether the person can choose between two and three (a wide screen). */
  choice: boolean;
  /** Whether this number of columns has an arrangement of the person's. */
  arranged: boolean;
  onChoice: (columns: 2 | 3) => void;
  onReset: () => void;
}) {
  return (
    <section class="customize-bar" aria-label={ui("play.customize")}>
      <div class="customize-head">
        <h3>{ui("play.customize")}</h3>
        <button
          type="button"
          class="customize-done"
          onClick={() => {
            customizing.value = false;
          }}
        >
          {ui("play.customize.done")}
        </button>
      </div>
      <p class="note">{ui(count === 1 ? "play.customize.phone" : "play.customize.hint")}</p>
      <div class="customize-tools">
        {choice && (
          <fieldset class="segmented customize-columns">
            <legend>{ui("play.customize.columns")}</legend>
            {([2, 3] as const).map((n) => (
              <button
                type="button"
                key={n}
                class={count === n ? "on" : ""}
                aria-pressed={count === n}
                onClick={() => onChoice(n)}
              >
                {n}
              </button>
            ))}
          </fieldset>
        )}
        <button type="button" disabled={!arranged} onClick={onReset}>
          {ui("play.customize.reset")}
        </button>
      </div>
    </section>
  );
}

/** The bar of a panel while arranging: its name and the buttons that move or hide it. */
export function PanelBar({
  panel,
  columns,
  can,
  onMove,
  onHide,
  onGrab,
}: {
  panel: string;
  /** More than one column: the panel can go left and right. */
  columns: boolean;
  can: Record<Dir, boolean>;
  onMove: (dir: Dir) => void;
  onHide: () => void;
  /** A press on the grip and the name: the start of a drag. */
  onGrab: (event: PointerEvent) => void;
}) {
  const steps: { dir: Dir; mark: string; label: UiKey }[] = [
    { dir: "up", mark: "↑", label: "play.customize.up" },
    { dir: "down", mark: "↓", label: "play.customize.down" },
    ...(columns
      ? [
          { dir: "left" as const, mark: "←", label: "play.customize.left" as const },
          { dir: "right" as const, mark: "→", label: "play.customize.right" as const },
        ]
      : []),
  ];
  return (
    <div class="panel-bar" data-locked={!canHide(panel) || undefined}>
      <div class="panel-grip" onPointerDown={onGrab} title={ui("play.customize.drag")}>
        <span class="grip" aria-hidden="true">
          {"⠿"}
        </span>
        <span class="panel-name">{name(panel)}</span>
      </div>
      <div class="panel-tools">
        {steps.map((s) => (
          <button
            type="button"
            key={s.dir}
            aria-label={`${ui(s.label)}: ${name(panel)}`}
            title={ui(s.label)}
            disabled={!can[s.dir]}
            onClick={() => onMove(s.dir)}
          >
            {s.mark}
          </button>
        ))}
        {canHide(panel) ? (
          <button
            type="button"
            class="panel-hide"
            aria-label={`${ui("play.customize.hide")}: ${name(panel)}`}
            title={ui("play.customize.hide")}
            onClick={onHide}
          >
            {"✕"}
          </button>
        ) : (
          <span
            class="panel-locked"
            title={ui("play.customize.locked")}
            role="img"
            aria-label={ui("play.customize.locked")}
          >
            {"●"}
          </span>
        )}
      </div>
    </div>
  );
}

/** The panels the person has hidden, each with a button to bring it back. */
export function HiddenPanels({
  panels,
  onShow,
  onShowAll,
}: {
  panels: string[];
  onShow: (panel: string) => void;
  onShowAll: () => void;
}) {
  if (panels.length === 0) return null;
  return (
    <section class="hidden-panels">
      <div class="customize-head">
        <h3>{ui("play.customize.hidden")}</h3>
        <button type="button" onClick={onShowAll}>
          {ui("play.customize.showAll")}
        </button>
      </div>
      <ul class="plain">
        {panels.map((panel) => (
          <li key={panel}>
            <span>{name(panel)}</span>
            <button type="button" onClick={() => onShow(panel)}>
              {ui("play.customize.show")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
