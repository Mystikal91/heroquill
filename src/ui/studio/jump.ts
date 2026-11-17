/** The place in the editor of a field that the label names: the label itself, a box's title, a section's heading. */
function find(label: string): Element | undefined {
  const root = document.querySelector(".studio-editor");
  if (!root) return undefined;
  const marks = [...root.querySelectorAll("label.field > span, legend, summary, h4")];
  return marks.find((m) => m.textContent?.trim() === label);
}

/** Opens what holds the field (folded sections, "more options"), so that it can be seen. */
function reveal(mark: Element) {
  let box = mark.closest("details");
  while (box) {
    box.open = true;
    box = box.parentElement?.closest("details") ?? null;
  }
}

function show(mark: Element) {
  reveal(mark);
  const target = mark.closest("label, fieldset, details") ?? mark;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target
    .querySelector<HTMLElement>(
      "input:not([type=checkbox]):not([type=hidden]), textarea, select, .studio-select-button, button",
    )
    ?.focus({ preventScroll: true });
  target.classList.add("studio-flash");
  setTimeout(() => target.classList.remove("studio-flash"), 1600);
}

/**
 * Takes the person to a field by its label: scrolls to it, opens what hides it, puts the cursor
 * in it and lights it for a moment. A field only the advanced mode shows turns that mode on.
 */
export function jumpToField(label: string): void {
  const mark = find(label);
  if (mark) {
    show(mark);
    return;
  }
}
