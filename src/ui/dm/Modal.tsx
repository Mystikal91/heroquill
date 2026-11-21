import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { ui } from "../../i18n/ui";

/**
 * A window of the DM mode over the page: a side panel on a wide screen, the whole screen on a phone
 * (`variant`), closed by the button, Escape, the back button of a phone or a tap on the backdrop.
 * Its content is drawn only while it is open.
 */
export function Modal({
  open,
  onClose,
  title,
  variant,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  variant: "side" | "center";
  children: ComponentChildren;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="dm-dialog"
      data-variant={variant}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div class="dm-dialog-body">
          <header class="dm-dialog-head">
            <h3>{title}</h3>
            <button type="button" class="dm-dialog-close" onClick={onClose}>
              {ui("spells.closeInfo")}
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}
