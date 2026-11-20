import { printSettings } from "../../app/printSettings";
import { ui } from "../../i18n/ui";
import { ClassFeaturesPanels, TraitsPanels, UsesPanel } from "./FrontPanels";
import { Sheet } from "./PageFoot";
import { frontSpill } from "./frontSpill";

/** The panels that did not fit on the front page, in the order they left it. Nothing when it fits. */
export function SpilledPanels() {
  const spill = frontSpill.value;
  if (spill === 0) return null;
  return (
    <div class="p-more-grid">
      {spill >= 1 && <ClassFeaturesPanels />}
      {spill >= 2 && <UsesPanel />}
      {spill >= 3 && <TraitsPanels />}
    </div>
  );
}

/**
 * A page of its own for what did not fit on the front. When the pages of features are printed they
 * take it at the top of their first page instead (`FeatureText`), so there is no page for it here.
 */
export function FrontMore() {
  if (frontSpill.value === 0 || printSettings.value.includeFeatureText) return null;
  return (
    <Sheet class="p-more">
      <h2 class="p-title">{ui("print.more")}</h2>
      <SpilledPanels />
    </Sheet>
  );
}
