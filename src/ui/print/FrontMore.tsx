import { ui } from "../../i18n/ui";
import { ClassFeaturesPanels, TraitsPanels, UsesPanel } from "./FrontPanels";
import { frontSpill } from "./frontSpill";

/** What did not fit on the front page, in the order it left it. Nothing when the front fits. */
export function FrontMore() {
  const spill = frontSpill.value;
  if (spill === 0) return null;
  return (
    <section class="p-page p-more">
      <h2 class="p-title">{ui("print.more")}</h2>
      <div class="p-more-grid">
        {spill >= 1 && <UsesPanel />}
        {spill >= 2 && <TraitsPanels />}
        {spill >= 3 && <ClassFeaturesPanels />}
      </div>
    </section>
  );
}
