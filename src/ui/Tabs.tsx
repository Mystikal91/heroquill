import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { type Tab, showView, view } from "../app/navigation";
import { type UiKey, ui } from "../i18n/ui";
import { BookIcon, DieIcon, PrinterIcon, QuillIcon, SheetIcon } from "./icons";

const TABS: { id: Tab; label: UiKey; icon: () => JSX.Element }[] = [
  { id: "build", label: "tab.build", icon: QuillIcon },
  { id: "sheet", label: "tab.sheet", icon: SheetIcon },
  { id: "play", label: "tab.play", icon: DieIcon },
  { id: "rules", label: "tab.rules", icon: BookIcon },
  { id: "print", label: "tab.print", icon: PrinterIcon },
];

/** Switch between building the character, reading the sheet and printing it. */
export function Tabs() {
  const current = view.value;
  const nav = useRef<HTMLElement>(null);
  // The bars that stick below the tabs (sheet, play) start where the tabs end, whatever height
  // the tabs have in this width and style (`--tabs-height`; `--tabs-bottom` when they are below).
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const root = document.documentElement.style;
    // On a phone the tabs are a bar at the bottom of the window: nothing sticks under them, and
    // what is fixed to the bottom (the dice button, the notices) and the page end above them.
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
  }, []);
  return (
    <nav class="tabs main-tabs no-print" aria-label={ui("tab.label")} ref={nav}>
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          class={`tab${current === tab.id ? " active" : ""}`}
          aria-current={current === tab.id ? "page" : undefined}
          onClick={() => showView(tab.id)}
        >
          <tab.icon />
          <span class="tab-label">{ui(tab.label)}</span>
        </button>
      ))}
    </nav>
  );
}
