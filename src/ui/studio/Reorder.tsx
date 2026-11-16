import { useRef, useState } from "preact/hooks";
import { ui } from "../../i18n/ui";
import { announce } from "./announce";

/** Moves one item of a list to another place, the rest keeping their order. */
export function moved<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

let groups = 0;

/**
 * What a list needs to be put in another order: by dragging an item by its handle, with the arrows
 * once the handle has the focus, or with the two small buttons that a touch screen shows (it cannot drag).
 * `item(i)` goes on the element of each item, `handle(i)` is the handle to put in it.
 */
export function useReorder(count: number, move: (from: number, to: number) => void) {
  const id = useRef(++groups).current;
  const dragging = useRef<number | undefined>(undefined);
  const [over, setOver] = useState<number | undefined>(undefined);

  const item = (i: number) => ({
    onDragOver: (e: DragEvent) => {
      if (dragging.current === undefined) return;
      e.preventDefault();
      if (over !== i) setOver(i);
    },
    onDragLeave: () => setOver(undefined),
    onDrop: (e: DragEvent) => {
      const from = dragging.current;
      if (from === undefined) return;
      e.preventDefault();
      e.stopPropagation();
      dragging.current = undefined;
      setOver(undefined);
      if (from !== i) move(from, i);
    },
    "data-over":
      over === i && dragging.current !== undefined && dragging.current !== i ? "on" : undefined,
  });

  const go = (from: number, to: number) => {
    if (to < 0 || to >= count) return;
    move(from, to);
    announce(ui("studio.itemMoved", { n: to + 1, total: count }));
    // The handle that was used follows the item, so the arrows can be pressed again.
    setTimeout(() => {
      document
        .querySelector<HTMLElement>(`.studio-move-handle[data-gid="${id}"][data-slot="${to}"]`)
        ?.focus();
    }, 60);
  };

  const handle = (i: number) =>
    count < 2 ? null : (
      <span class="studio-move" data-reorder>
        <button
          type="button"
          class="studio-move-handle"
          data-gid={id}
          data-slot={i}
          draggable
          title={ui("studio.move")}
          aria-label={ui("studio.move")}
          onDragStart={(e) => {
            dragging.current = i;
            e.dataTransfer?.setData("text/plain", String(i));
            if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
          }}
          onDragEnd={() => {
            dragging.current = undefined;
            setOver(undefined);
          }}
          onClick={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              // The arrows of the studio change the open entry: here they only move the item.
              e.stopPropagation();
              go(i, i + (e.key === "ArrowUp" ? -1 : 1));
            }
          }}
        >
          ⠿
        </button>
        <button
          type="button"
          class="studio-move-step"
          disabled={i === 0}
          aria-label={ui("studio.moveUp")}
          onClick={(e) => {
            e.preventDefault();
            go(i, i - 1);
          }}
        >
          ▲
        </button>
        <button
          type="button"
          class="studio-move-step"
          disabled={i === count - 1}
          aria-label={ui("studio.moveDown")}
          onClick={(e) => {
            e.preventDefault();
            go(i, i + 1);
          }}
        >
          ▼
        </button>
      </span>
    );

  return { item, handle };
}
