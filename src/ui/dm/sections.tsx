import type { DmSection } from "../../app/dm";
import { BookIcon, FlagIcon, SlidersIcon, SwordsIcon } from "../icons";

/** The parts of the DM page: the tabs of its bar on a wide screen, the bar at the bottom of a phone. */
export const SECTIONS: {
  id: DmSection;
  label: "dm.section.campaign" | "dm.section.encounter" | "tab.rules" | "dm.section.settings";
  icon: typeof BookIcon;
}[] = [
  { id: "campaign", label: "dm.section.campaign", icon: FlagIcon },
  { id: "encounter", label: "dm.section.encounter", icon: SwordsIcon },
  { id: "rules", label: "tab.rules", icon: BookIcon },
  { id: "settings", label: "dm.section.settings", icon: SlidersIcon },
];
