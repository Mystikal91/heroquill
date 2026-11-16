import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import en from "../../../locales/en/ui.json";
import { type UiKey, ui } from "../../i18n/ui";

/** The line that says what a field of the editor is for, when someone has written one. */
export function fieldHelp(key: string): string | undefined {
  const text = `fdhelp.${key}`;
  return text in en ? ui(text as UiKey) : undefined;
}

/**
 * A field with a small "?" by its label: it opens a line under the field that says what it is for.
 * Without a help text the field is left as it is.
 */
export function Helped({
  help,
  children,
}: {
  help: string | undefined;
  children: ComponentChildren;
}) {
  const [open, setOpen] = useState(false);
  if (!help) return <>{children}</>;
  return (
    <div class="studio-helped">
      {children}
      <button
        type="button"
        class="studio-help-mark"
        aria-expanded={open}
        aria-label={ui("studio.helpWhat")}
        title={ui("studio.helpWhat")}
        onClick={() => setOpen(!open)}
      >
        ?
      </button>
      {open && <small class="studio-help-text">{help}</small>}
    </div>
  );
}
