import { useEffect, useRef } from "preact/hooks";
import { helpOpen } from "../../app/studio";
import { ui } from "../../i18n/ui";

const ROWS: [string, () => string][] = [
  ["Ctrl+K", () => ui("studio.palette")],
  ["Ctrl+S", () => ui("studio.keys.save")],
  ["Ctrl+Z · Ctrl+Y", () => `${ui("studio.undo")} · ${ui("studio.redo")}`],
  [
    "Ctrl+C · Ctrl+X · Ctrl+V",
    () => `${ui("studio.copy")} · ${ui("studio.cut")} · ${ui("studio.paste")}`,
  ],
  ["Ctrl+D", () => ui("studio.duplicate")],
  ["↑ ↓", () => ui("studio.keys.move")],
  ["?", () => ui("studio.keys.help")],
];

/** The keys of the studio, in a short list: shown with `?`. */
export function Shortcuts() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);
  const close = () => {
    helpOpen.value = false;
  };
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog"
      aria-labelledby="studio-keys-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="spell-dialog-body">
        <button type="button" class="close" onClick={close}>
          {ui("credits.back")}
        </button>
        <h3 id="studio-keys-title">{ui("studio.keys.title")}</h3>
        <dl class="studio-keys">
          {ROWS.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{label()}</dd>
            </div>
          ))}
        </dl>
      </div>
    </dialog>
  );
}
