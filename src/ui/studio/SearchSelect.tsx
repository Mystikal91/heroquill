import { useEffect, useRef, useState } from "preact/hooks";
import { fold } from "../../app/search";
import { ui } from "../../i18n/ui";
import { announce } from "./announce";

export interface PickOption {
  id: string;
  label: string;
  /** A heading to list the option under. */
  group?: string | undefined;
  /** The colour group of the kinds of entry (see `.studio-dot`), shown as a dot before the name. */
  dot?: string | undefined;
}

/** From this many options on a menu is a search with a list, not a plain menu to scroll. */
export const LONG_LIST = 12;

type Row = {
  id: string | undefined;
  label: string;
  group?: string | undefined;
  dot?: string | undefined;
};

/**
 * The search box and the list it narrows, as one panel: type to narrow, the arrows move, Enter picks,
 * Esc leaves. Menus of long lists and the menu of new entries share it.
 */
export function PickerPanel({
  options,
  blank,
  onPick,
  onClose,
}: {
  options: PickOption[];
  /** A first choice that takes the value off (a dash, "none"). */
  blank?: string | undefined;
  onPick: (id: string | undefined) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const active = useRef<HTMLButtonElement>(null);

  const terms = fold(query).split(/\s+/).filter(Boolean);
  const found = options.filter((o) => terms.every((t) => fold(o.label).includes(t)));
  const rows: Row[] = [
    ...(blank !== undefined && terms.length === 0 ? [{ id: undefined, label: blank }] : []),
    ...found,
  ];

  // The row the arrows are on stays in view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it must run again each time the row changes
  useEffect(() => {
    active.current?.scrollIntoView({ block: "nearest" });
  }, [at]);

  // How many remain is said as the person types, since the list changes out of sight of a screen reader.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it must run when the query changes, and only then
  useEffect(() => {
    if (query)
      announce(
        found.length === 0 ? ui("studio.noMatch") : ui("studio.results", { n: found.length }),
      );
  }, [query]);

  let lastGroup: string | undefined;
  return (
    <div class="studio-picker">
      <div class="studio-picker-head">
        <input
          type="search"
          value={query}
          // biome-ignore lint/a11y/noAutofocus: the search opens because the person asked to pick
          autoFocus
          placeholder={ui("studio.pickerSearch")}
          aria-label={ui("studio.pickerSearch")}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const to = Math.max(
                0,
                Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)),
              );
              setAt(to);
              // The row the arrows are on is said, since the focus stays in the search box.
              const row = rows[to];
              if (row) announce(`${row.label}, ${to + 1} / ${rows.length}`);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const row = rows[at];
              if (row) onPick(row.id);
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }
          }}
        />
        <button type="button" class="link studio-picker-close" onClick={onClose}>
          {ui("hb.cancel")}
        </button>
      </div>
      <ul class="plain studio-picker-list">
        {rows.map((row, i) => {
          const heading = row.group !== undefined && row.group !== lastGroup;
          lastGroup = row.group;
          return (
            <li key={row.id ?? "blank"}>
              {heading && <b class="studio-picker-group">{row.group}</b>}
              <button
                type="button"
                class={i === at ? "on" : ""}
                aria-current={i === at}
                ref={i === at ? active : undefined}
                onMouseEnter={() => setAt(i)}
                onClick={() => onPick(row.id)}
              >
                {row.dot && <span class="studio-dot" data-group={row.dot} aria-hidden="true" />}
                {row.label}
              </button>
            </li>
          );
        })}
        {rows.length === 0 && <li class="muted">{ui("studio.noMatch")}</li>}
      </ul>
    </div>
  );
}

/**
 * A menu for a long list: a button that looks like a menu, and under it (on a phone, over the whole
 * screen) the search and the list. Used for what has hundreds of options (spells, items, languages),
 * where a plain menu is a scroll.
 */
export function SearchSelect({
  label,
  shown,
  options,
  blank,
  onPick,
}: {
  /** The text above the button, when it has one. */
  label?: string;
  /** What the button says: the option chosen, or what the menu is for. */
  shown: string;
  options: PickOption[];
  blank?: string;
  onPick: (id: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = (back = true) => {
    setOpen(false);
    if (back) button.current?.focus();
  };
  return (
    <div
      class="field studio-field studio-search-select"
      ref={root}
      onFocusOut={(e) => {
        // Leaving the whole thing closes it; moving inside it does not.
        if (open && !root.current?.contains(e.relatedTarget as Node | null)) close(false);
      }}
    >
      {label && <span>{label}</span>}
      <button
        type="button"
        class="studio-select-button"
        aria-expanded={open}
        ref={button}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span>{shown}</span>
      </button>
      {open && (
        <PickerPanel
          options={options}
          blank={blank}
          onPick={(id) => {
            onPick(id);
            close();
          }}
          onClose={() => close()}
        />
      )}
    </div>
  );
}
