import { useEffect, useRef, useState } from "preact/hooks";
import { showView } from "../../app/navigation";
import { fold } from "../../app/search";
import {
  flushStudio,
  paletteOpen,
  redoChange,
  selectedEntry,
  setSidebarOpen,
  sidebarOpen,
  startFromOpen,
  undoChange,
  workingPack,
} from "../../app/studio";
import { openStudioPack } from "../../app/studio";
import { exportPack, userPacks } from "../../app/userPacks";
import { ui } from "../../i18n/ui";
import { visibleEntries } from "./Explorer";
import { kindName } from "./names";
import { NEW_KINDS, startNew } from "./newKinds";

interface Command {
  id: string;
  label: string;
  hint: string;
  run: () => void;
}

/** Everything the palette can do right now, from the entries of the open pack to the modes of the studio. */
function commands(): Command[] {
  const record = workingPack();
  const list: Command[] = [];
  if (record) {
    for (const e of visibleEntries(record))
      list.push({
        id: `entry:${e.id}`,
        label: record.strings[`${e.id}.name`] || ui("studio.unnamed"),
        hint: kindName(e),
        run: () => {
          selectedEntry.value = e.id;
        },
      });
    for (const k of NEW_KINDS)
      list.push({
        id: `new:${k.id}`,
        label: ui("studio.cmd.new", { kind: k.label() }),
        hint: "",
        run: () => startNew(record, k.id),
      });
    list.push(
      {
        id: "start",
        label: ui("studio.startFrom"),
        hint: "",
        run: () => {
          startFromOpen.value = true;
        },
      },
      {
        id: "print",
        label: ui("studio.print"),
        hint: "",
        run: () => void flushStudio().then(() => showView("homebrewPrint")),
      },
      {
        id: "export",
        label: ui("bar.export"),
        hint: "",
        run: () => void flushStudio().then(() => exportPack(record)),
      },
      { id: "undo", label: ui("studio.undo"), hint: "Ctrl+Z", run: undoChange },
      { id: "redo", label: ui("studio.redo"), hint: "Ctrl+Y", run: redoChange },
    );
  }
  list.push({
    id: "sidebar",
    label: ui(sidebarOpen.value ? "studio.hideSidebar" : "studio.showSidebar"),
    hint: "",
    run: () => setSidebarOpen(!sidebarOpen.value),
  });
  for (const p of userPacks.value.filter((x) => x.origin === "homebrew"))
    list.push({
      id: `pack:${p.id}`,
      label: ui("studio.cmd.pack", { name: p.name }),
      hint: "",
      run: () => void openStudioPack(p.id),
    });
  return list;
}

/**
 * A search box for everything: type a few letters of an entry to open it, or of a command to run it.
 * Ctrl+K opens it; the arrows choose, Enter does it, Esc leaves.
 */
export function Palette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const all = commands();
  const words = fold(query).split(/\s+/).filter(Boolean);
  const found = all.filter((c) => words.every((w) => fold(c.label).includes(w))).slice(0, 12);

  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);

  const close = () => {
    paletteOpen.value = false;
  };
  const run = (c: Command | undefined) => {
    if (!c) return;
    close();
    c.run();
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape is the keyboard way out
    <dialog
      ref={dialog}
      class="spell-dialog studio-palette"
      aria-label={ui("studio.palette")}
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="spell-dialog-body">
        <input
          type="search"
          class="studio-search"
          value={query}
          // biome-ignore lint/a11y/noAutofocus: the palette opens to type in it
          autoFocus
          placeholder={ui("studio.palette")}
          aria-label={ui("studio.palette")}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setAt(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAt(Math.min(found.length - 1, at + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAt(Math.max(0, at - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              run(found[at]);
            }
          }}
        />
        {found.length === 0 ? (
          <p class="muted">{ui("studio.noMatch")}</p>
        ) : (
          <ul class="plain studio-palette-list">
            {found.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  class={i === at ? "on" : ""}
                  aria-current={i === at}
                  onMouseEnter={() => setAt(i)}
                  onClick={() => run(c)}
                >
                  <span>{c.label}</span>
                  <span class="muted">{c.hint}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
