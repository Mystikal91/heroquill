import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { type SheetGroup, sheetGroup, showSheetGroup } from "../app/sheetView";
import { character, content, shownSheet } from "../app/store";
import { SpellSheet } from "./SpellSheet";
import { AbilityTiles, Skills } from "./sheet/AbilityBlocks";
import { ClassFeatures } from "./sheet/ClassFeatures";
import { Attacks } from "./sheet/CoreStats";
import { CustomFeaturesPanel } from "./sheet/CustomFeaturesPanel";
import { Defenses, Feats, Inventory, Notes, Proficiencies, SpeciesTraits } from "./sheet/Details";
import { FormToggle } from "./sheet/FormToggle";
import { SheetHeader } from "./sheet/SheetHeader";
import { SheetTabs } from "./sheet/SheetTabs";
import { SpellcastingPanel } from "./sheet/SpellcastingPanel";
import { StoryPanel } from "./sheet/Story";
import { collectSpellRows } from "./spellRows";
import { neighbour, useSwipe } from "./useSwipe";

/**
 * A panel and the part of the sheet it belongs to. On a phone only the part that is open is
 * shown (`all` always is) and `order` says where each panel sits in it; on a wide screen the
 * panels sit in their columns as if the wrapper was not there.
 */
const Part = ({
  group,
  order,
  children,
}: {
  group: SheetGroup | "all";
  order: number;
  children: ComponentChildren;
}) => (
  <div class="sg" data-g={group} style={{ "--o": order }}>
    {children}
  </div>
);

/**
 * The character sheet on screen: a band with who they are and the key numbers, the six
 * abilities, then three columns when there is room (skills, combat and spells, features by level), two or one when there is not. On a phone it is one
 * column split into parts behind tabs, under a row with the key numbers.
 */
export function Sheet() {
  const c = content.value;
  const s = shownSheet.value;
  const root = useRef<HTMLDivElement>(null);
  const parts = useRef<{ groups: SheetGroup[]; open: SheetGroup }>({
    groups: [],
    open: "profile",
  });
  useSwipe(
    root,
    () => {
      const bar = root.current?.querySelector(".sheet-sticky");
      return bar ? getComputedStyle(bar).display !== "none" : false;
    },
    (delta) => {
      const next = neighbour(parts.current.groups, parts.current.open, delta);
      if (next) showSheetGroup(next);
      return next !== undefined;
    },
  );
  if (!c || !s) return null;
  const hasMagic = s.spellcasters.length > 0 || collectSpellRows(c, s).length > 0;
  const groups: SheetGroup[] = hasMagic
    ? ["profile", "combat", "magic", "bag", "features"]
    : ["profile", "combat", "bag", "features"];
  // A part that is not there (no magic) opens the first one.
  const open = groups.includes(sheetGroup.value) ? sheetGroup.value : "profile";
  parts.current = { groups, open };
  // The character is read here only so a change of the sheet is shown at once.
  void character.value;

  return (
    <div class="sheet" data-group={open} ref={root}>
      <SheetHeader />
      <FormToggle />
      <SheetTabs groups={groups} />
      <Part group="profile" order={0}>
        <AbilityTiles />
      </Part>
      <div class="sheet-grid">
        <div class="sheet-col col-left">
          <Part group="profile" order={2}>
            <Skills />
          </Part>
          <Part group="profile" order={3}>
            <Proficiencies />
          </Part>
          <Part group="profile" order={4}>
            <Defenses />
          </Part>
        </div>
        <div class="sheet-col col-center">
          <Part group="combat" order={2}>
            <Attacks />
          </Part>
          <Part group="magic" order={1}>
            <SpellcastingPanel />
          </Part>
          <Part group="magic" order={2}>
            <SpellSheet />
          </Part>
          <Part group="bag" order={1}>
            <Inventory />
          </Part>
          <Part group="all" order={0}>
            <Notes />
          </Part>
        </div>
        <div class="sheet-col col-right">
          <Part group="features" order={1}>
            <SpeciesTraits />
          </Part>
          <Part group="features" order={2}>
            <Feats />
          </Part>
          <Part group="features" order={3}>
            <ClassFeatures />
          </Part>
          <Part group="features" order={4}>
            <CustomFeaturesPanel />
          </Part>
          <Part group="profile" order={5}>
            <StoryPanel />
          </Part>
        </div>
      </div>
    </div>
  );
}
