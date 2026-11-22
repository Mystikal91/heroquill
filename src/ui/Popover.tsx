import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";

interface PopoverProps {
  /** The button that opens it. */
  label: ComponentChildren;
  /** Text for screen readers when the label is only an icon. */
  title: string;
  /** Which edge of the button the panel lines up with. */
  align?: "start" | "end";
  class?: string;
  /** A panel to work in (a form, a list with buttons): a button inside does not close it. */
  keepOpen?: boolean;
  /** Called when the panel opens. */
  onOpen?: () => void;
  children: ComponentChildren;
}

const supported = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

/**
 * A small menu that opens under its button, closes on a tap outside and on Escape, and closes
 * when something inside it is chosen (a button or a link). It uses the browser's popover layer,
 * so a frame with a clipped edge (the fantasy cards) or a sticky bar cannot cut or cover it.
 */
export function Popover({
  label,
  title,
  align = "end",
  class: extra,
  keepOpen,
  onOpen,
  children,
}: PopoverProps) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = panel.current;
    const opener = button.current;
    if (!box || !opener) return;

    /** Puts the panel under the button, lined up with the chosen edge and inside the screen. */
    const place = () => {
      const at = opener.getBoundingClientRect();
      box.style.top = `${at.bottom + 6}px`;
      box.style.maxHeight = `${window.innerHeight - at.bottom - 16}px`;
      if (align === "end") {
        box.style.right = `${Math.max(8, window.innerWidth - at.right)}px`;
        box.style.left = "auto";
      } else {
        box.style.left = `${Math.max(8, at.left)}px`;
        box.style.right = "auto";
      }
    };
    const close = () => {
      if (supported) box.hidePopover();
      else delete box.dataset.open;
    };
    const chosen = (e: Event) => {
      if (!keepOpen && (e.target as HTMLElement).closest("button, a")) close();
    };
    const toggled = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        place();
        onOpen?.();
      }
    };
    // Without the popover layer the button opens and closes the panel itself.
    const fallback = () => {
      if (supported) return;
      place();
      if (box.dataset.open) delete box.dataset.open;
      else box.dataset.open = "true";
    };
    const dismiss = (e: Event) => {
      if (supported || !box.dataset.open) return;
      if (!box.contains(e.target as Node) && !opener.contains(e.target as Node)) close();
    };

    box.addEventListener("click", chosen);
    box.addEventListener("beforetoggle", toggled);
    opener.addEventListener("click", fallback);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      box.removeEventListener("click", chosen);
      box.removeEventListener("beforetoggle", toggled);
      opener.removeEventListener("click", fallback);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [align, keepOpen, onOpen]);

  return (
    <div class={`popover${extra ? ` ${extra}` : ""}`}>
      <button
        ref={button}
        type="button"
        class="popover-button"
        aria-label={title}
        title={title}
        popovertarget={id}
      >
        {label}
      </button>
      <div ref={panel} id={id} popover="auto" class="popover-panel">
        {children}
      </div>
    </div>
  );
}
