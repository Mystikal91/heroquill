import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext, useRef, useState } from "preact/hooks";
import en from "../../../locales/en/ui.json";
import { type UiKey, ui } from "../../i18n/ui";

/** The line that says what a field of the editor is for, when someone has written one. */
export function fieldHelp(key: string): string | undefined {
  const text = `fdhelp.${key}`;
  return text in en ? ui(text as UiKey) : undefined;
}

interface HelpState {
  open: boolean;
  toggle: () => void;
  id: string;
}

/** What the label of a field asks for to draw its small "i": the state of the help of that field. */
const HelpCtx = createContext<HelpState | null>(null);

/** What sits inside a field that has help but is not that field (the boxes of a group): no "i" of its own. */
export function NoHelp({ children }: { children: ComponentChildren }) {
  return <HelpCtx.Provider value={null}>{children}</HelpCtx.Provider>;
}

let counter = 0;

/**
 * The small "i" that sits right after the text of a label: it opens a line under the field that says
 * what the field is for. A control puts it after its label; with no help for the field it is nothing.
 */
export function HelpMark() {
  const help = useContext(HelpCtx);
  if (!help) return null;
  return (
    <button
      type="button"
      class="studio-help-mark"
      aria-expanded={help.open}
      aria-controls={help.id}
      aria-label={ui("studio.helpWhat")}
      title={ui("studio.helpWhat")}
      onClick={(e) => {
        // Inside a label, a click must not also go to the box the label belongs to.
        e.preventDefault();
        e.stopPropagation();
        help.toggle();
      }}
    >
      i
    </button>
  );
}

/**
 * A field that has help: the mark is drawn by its label (see `HelpMark`), the line it opens comes
 * under the field. Without help the field is left as it is, and what it holds draws no mark of this one.
 */
export function Helped({
  help,
  children,
}: {
  help: string | undefined;
  children: ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  const id = useRef(`help-${++counter}`).current;
  if (!help) return <HelpCtx.Provider value={null}>{children}</HelpCtx.Provider>;
  return (
    <HelpCtx.Provider value={{ open, toggle: () => setOpen(!open), id }}>
      <div class="studio-helped">
        {children}
        {open && (
          <small class="studio-help-text" id={id}>
            {help}
          </small>
        )}
      </div>
    </HelpCtx.Provider>
  );
}
