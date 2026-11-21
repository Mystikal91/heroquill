import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";

/**
 * A bar of tabs that is always in view: sticky at the top, a bar at the bottom of a phone. The bars that
 * stick below it (sheet, play, the turn bar of the DM mode) start where it ends (`--tabs-height`), and on a
 * phone the page and what is fixed to the bottom keep above it (`--tabs-bottom`).
 */
export function useTabsBar(nav: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const root = document.documentElement.style;
    const set = () => {
      const atBottom = getComputedStyle(el).position === "fixed";
      root.setProperty("--tabs-height", atBottom ? "0px" : `${el.offsetHeight}px`);
      root.setProperty("--tabs-bottom", atBottom ? `${el.offsetHeight}px` : "0px");
    };
    set();
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.removeProperty("--tabs-height");
      root.removeProperty("--tabs-bottom");
    };
  }, [nav]);
}
