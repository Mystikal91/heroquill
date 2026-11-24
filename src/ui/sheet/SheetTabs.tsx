import { SHEET_GROUPS, type SheetGroup, sheetGroup, showSheetGroup } from "../../app/sheetView";
import { shownSheet } from "../../app/store";
import type { ExplainTarget } from "../../engine/explain";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { ExplainButton } from "../Explain";
import { CombatIcon, FeaturesIcon, MagicIcon, ProfileIcon, ResourcesIcon } from "../play/icons";

const ICONS: Record<SheetGroup, () => preact.JSX.Element> = {
  profile: ProfileIcon,
  combat: CombatIcon,
  magic: MagicIcon,
  bag: ResourcesIcon,
  features: FeaturesIcon,
};

/** A number of the summary row and what it is. */
const SumText = ({ label, value }: { label: string; value: string }) => (
  <>
    <b>{value}</b>
    <small>{label}</small>
  </>
);

/** The numbers needed most, in one row: armor class, initiative, speed, hit points, hit dice. */
function Summary() {
  const s = shownSheet.value;
  if (!s) return null;
  const hitDice = Object.entries(s.hitPoints.hitDice)
    .map(([die, n]) => `${n}${die}`)
    // It may break after a plus (a zero-width space), never inside a die.
    .join("+\u200b");
  const items: [string, string, ExplainTarget?][] = [
    [ui("play.ac"), String(s.armorClass.value), { kind: "ac" }],
    [ui("play.init"), signed(s.initiative), { kind: "initiative" }],
    [ui("sheet.speed"), s.speed === undefined ? "—" : distance(s.speed), { kind: "speed" }],
    [ui("play.hpShort"), String(s.hitPoints.max)],
    [ui("sheet.hitDice"), hitDice || "—"],
  ];
  return (
    <div class="sheet-summary">
      {items.map(([label, value, target]) => {
        return target ? (
          <ExplainButton key={label} class="sum" target={target}>
            <SumText label={label} value={value} />
          </ExplainButton>
        ) : (
          <div key={label} class="sum">
            <SumText label={label} value={value} />
          </div>
        );
      })}
    </div>
  );
}

/** On a phone: the key numbers and the tabs for the parts of the sheet, pinned under the top tabs. */
export function SheetTabs({ groups }: { groups: SheetGroup[] }) {
  const active = sheetGroup.value;
  return (
    <div class="sheet-sticky">
      <Summary />
      <div class="sheet-groups" role="tablist" aria-label={ui("sheet.groups")}>
        {SHEET_GROUPS.filter((g) => groups.includes(g)).map((g) => {
          const Picture = ICONS[g];
          return (
            <button
              type="button"
              role="tab"
              key={g}
              class={active === g ? "on" : ""}
              aria-selected={active === g}
              onClick={() => showSheetGroup(g)}
            >
              <Picture />
              <span>{ui(`sheet.group.${g}` as UiKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
