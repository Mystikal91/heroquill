import type { ComponentChildren } from "preact";
import { ui } from "../../i18n/ui";
import { printedCharacter } from "./printSource";

/** The line at the foot of every page: whose rules these are, and what made the sheet. */
export function PageFoot() {
  const version = printedCharacter.value.ruleset === "srd52" ? "5.2.1" : "5.1";
  return (
    <footer class="p-foot">
      <span>{ui("print.credit", { version })}</span>
      <span class="p-foot-app">{ui("print.madeWith")}</span>
    </footer>
  );
}

/**
 * One sheet of paper: a fixed height, what is on it, and the footer at the bottom. Every printed
 * page is one of these, so the browser never has to cut a page and the PDF knows where each one is.
 */
export function Sheet({
  class: className = "",
  children,
}: {
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`p-page p-sheet ${className}`.trim()}>
      <div class="p-sheet-body">{children}</div>
      <PageFoot />
    </section>
  );
}
