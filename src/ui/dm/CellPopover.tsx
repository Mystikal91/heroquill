import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";

const supported = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;

/**
 * A small editor that opens under the cell that was touched: the hit points, the conditions, the
 * columns. Unlike the menu popover it stays open while a button inside is used (the quick chips
 * of the hit points); the content asks to close it by calling the function it is given. On a
 * phone the panel is a sheet from the bottom (see the CSS). It uses the browser's popover layer.
 */
export function CellPopover({
  trigger,
  title,
  class: extra,
  align = "start",
  id: fixedId,
  children,
}: {
  /**
   * An id of its own for the panel, for a popover drawn in a render root of its own (the pill of the header), where
   * `useId` starts again and would give the id of a popover of the app (the menu would open this panel).
   */
  id?: string;
  trigger: ComponentChildren;
  title: string;
  class?: string;
  align?: "start" | "end";
  children: (close: () => void) => ComponentChildren;
}) {
  const generated = useId();
  const id = fixedId ?? generated;
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // The content is drawn only while the panel is open: a table has many of them.
  const [open, setOpen] = useState(false);
  const close = () => {
    const box = panel.current;
    if (!box) return;
    if (supported) {
      if (box.matches(":popover-open")) box.hidePopover();
    } else {
      delete box.dataset.open;
      setOpen(false);
    }
  };

  useEffect(() => {
    const box = panel.current;
    const opener = button.current;
    if (!box || !opener) return;
    const place = () => {
      const at = opener.getBoundingClientRect();
      const room = window.innerHeight - at.bottom - 12;
      // Under the cell, or above it when there is more room there.
      if (room < 260 && at.top > room) {
        box.style.top = "auto";
        box.style.bottom = `${window.innerHeight - at.top + 6}px`;
        box.style.maxHeight = `${at.top - 12}px`;
      } else {
        box.style.bottom = "auto";
        box.style.top = `${at.bottom + 6}px`;
        box.style.maxHeight = `${room}px`;
      }
      // Lined up with the chosen edge of the button, and kept inside the screen.
      const width = box.offsetWidth;
      const wanted = align === "end" ? at.right - width : at.left;
      box.style.left = `${Math.max(8, Math.min(wanted, window.innerWidth - width - 8))}px`;
      box.style.right = "auto";
    };
    const toggled = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") {
        setOpen(true);
        // The content is drawn after this: place the panel once it has its size.
        requestAnimationFrame(place);
      }
    };
    const closed = (e: Event) => {
      if ((e as ToggleEvent).newState === "closed") setOpen(false);
    };
    const fallback = () => {
      if (supported) return;
      if (box.dataset.open) {
        delete box.dataset.open;
        setOpen(false);
      } else {
        box.dataset.open = "true";
        setOpen(true);
        requestAnimationFrame(place);
      }
    };
    const dismiss = (e: Event) => {
      if (supported || !box.dataset.open) return;
      if (!box.contains(e.target as Node) && !opener.contains(e.target as Node)) {
        delete box.dataset.open;
        setOpen(false);
      }
    };
    box.addEventListener("beforetoggle", toggled);
    box.addEventListener("toggle", closed);
    opener.addEventListener("click", fallback);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      box.removeEventListener("beforetoggle", toggled);
      box.removeEventListener("toggle", closed);
      opener.removeEventListener("click", fallback);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [align]);

  return (
    <>
      <button
        ref={button}
        type="button"
        class={`dm-cell-button${extra ? ` ${extra}` : ""}`}
        title={title}
        aria-label={title}
        popovertarget={id}
      >
        {trigger}
      </button>
      <div ref={panel} id={id} popover="auto" class="dm-pop">
        {open && children(close)}
      </div>
    </>
  );
}
