import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

/** A mouse has to move this far before it counts as a drag and not as a click. */
const DRAG_START = 5;

/**
 * Lets a row that scrolls sideways be dragged with the mouse and moved with the wheel, as a finger
 * does on a phone: a mouse cannot grab a row that only has a scroll bar, and the wheel turns up
 * and down. Touch and pens already scroll it, so they are left alone. A drag does not click what
 * it started on. The wheel only moves the row while the row can still move that way, so the
 * page or the window under it scrolls on from the end.
 */
export function useDragScroll(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let from: { x: number; left: number; id: number } | undefined;
    let moved = false;

    const down = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      from = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
      moved = false;
    };
    const move = (e: PointerEvent) => {
      if (!from || e.pointerId !== from.id) return;
      const dx = e.clientX - from.x;
      if (!moved && Math.abs(dx) >= DRAG_START) {
        moved = true;
        el.setPointerCapture?.(e.pointerId);
        el.dataset.dragging = "";
      }
      if (moved) el.scrollLeft = from.left - dx;
    };
    const stop = (e: PointerEvent) => {
      if (!from || e.pointerId !== from.id) return;
      from = undefined;
      if (!moved) return;
      el.releasePointerCapture?.(e.pointerId);
      delete el.dataset.dragging;
      // The click that ends a drag belongs to the drag.
      const swallow = (ev: Event) => ev.stopPropagation();
      el.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => el.removeEventListener("click", swallow, { capture: true }), 0);
    };
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      const max = el.scrollWidth - el.clientWidth;
      const goes = e.deltaY > 0 ? el.scrollLeft < max : el.scrollLeft > 0;
      if (!goes) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", stop);
    el.addEventListener("pointercancel", stop);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", stop);
      el.removeEventListener("pointercancel", stop);
      el.removeEventListener("wheel", wheel);
    };
  }, [ref]);
}
