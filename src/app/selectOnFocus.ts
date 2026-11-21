/**
 * A number field selects all its text when it gets the focus, so a click and a new value replace the old
 * one instead of adding to it (a 4 and a typed 5 made 45). One listener on the document covers every
 * number field, the ones a dialog draws later included.
 */
export function selectNumberOnFocus(doc: Document = document): () => void {
  let fresh: HTMLInputElement | undefined;

  const isNumber = (target: EventTarget | null): target is HTMLInputElement =>
    target instanceof HTMLInputElement &&
    target.type === "number" &&
    !target.readOnly &&
    !target.disabled;

  const onFocusIn = (event: Event) => {
    if (!isNumber(event.target)) return;
    fresh = event.target;
    event.target.select();
  };
  // The mouse button going up would put the caret back and drop the selection (Chrome): once is enough.
  const onMouseUp = (event: Event) => {
    if (fresh && event.target === fresh) event.preventDefault();
    fresh = undefined;
  };
  const onFocusOut = () => {
    fresh = undefined;
  };

  doc.addEventListener("focusin", onFocusIn);
  doc.addEventListener("mouseup", onMouseUp);
  doc.addEventListener("focusout", onFocusOut);
  return () => {
    doc.removeEventListener("focusin", onFocusIn);
    doc.removeEventListener("mouseup", onMouseUp);
    doc.removeEventListener("focusout", onFocusOut);
  };
}
