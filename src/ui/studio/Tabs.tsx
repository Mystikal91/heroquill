import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";

export interface TabSpec {
  id: string;
  label: string;
  /** A small number beside the label (the checks to look at). */
  badge?: number | undefined;
  body: () => ComponentChildren;
}

let counter = 0;

/**
 * Sections of one page as tabs: only the open one is drawn. The arrows, Home and End move between the
 * tabs, as in any tab list, and the open one is announced to a screen reader.
 */
export function Tabs({
  tabs,
  current,
  onChange,
  label,
}: {
  tabs: TabSpec[];
  current: string;
  onChange: (id: string) => void;
  /** What the tabs are of ("The pack"), for the screen reader. */
  label: string;
}) {
  const group = useRef(`tabs-${++counter}`).current;
  const here = tabs.find((t) => t.id === current) ?? tabs[0];
  const bar = useRef<HTMLDivElement>(null);

  const move = (to: number) => {
    const next = tabs[(to + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.id);
    bar.current?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus();
  };

  return (
    <div class="studio-tabs">
      <div class="studio-tablist" role="tablist" aria-label={label} ref={bar}>
        {tabs.map((tab, i) => {
          const on = tab.id === here?.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              id={`${group}-${tab.id}`}
              data-tab={tab.id}
              class={on ? "studio-tab on" : "studio-tab"}
              aria-selected={on}
              aria-controls={`${group}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  e.stopPropagation();
                  move(i + 1);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  e.stopPropagation();
                  move(i - 1);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  move(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  move(tabs.length - 1);
                }
              }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span class="studio-tab-badge">{tab.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div
        class="studio-tabpanel"
        role="tabpanel"
        id={`${group}-panel`}
        aria-labelledby={here ? `${group}-${here.id}` : undefined}
      >
        {here?.body()}
      </div>
    </div>
  );
}
