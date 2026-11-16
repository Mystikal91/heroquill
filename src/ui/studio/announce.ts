let region: HTMLElement | undefined;

/**
 * Says something to a screen reader without moving the focus: a moved item, a field the person was taken to.
 * One hidden polite region serves the whole studio; the text is put in it again each time so that the
 * same sentence said twice is read twice.
 */
export function announce(text: string): void {
  if (typeof document === "undefined") return;
  if (!region || !region.isConnected) {
    region = document.createElement("div");
    region.className = "sr-only";
    region.setAttribute("aria-live", "polite");
    region.setAttribute("aria-atomic", "true");
    document.body.append(region);
  }
  const box = region;
  box.textContent = "";
  setTimeout(() => {
    box.textContent = text;
  }, 30);
}
