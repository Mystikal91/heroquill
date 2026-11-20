import { ClassFeaturesPanels, TraitsPanels, UsesPanel } from "./FrontPanels";
import { PageFoot } from "./PageFoot";
import {
  AbilityBlocks,
  AttacksPanel,
  Badges,
  BlankFeaturesPanels,
  CombatStats,
  CustomAndNotes,
  FrontHead,
  FrontSpellList,
  InspirationBox,
  ProficienciesPanel,
  SpellcastingPanel,
  spellListOnFront,
  useFitFront,
} from "./frontParts";
import { blank } from "./printSource";
import { printedSheet } from "./printSource";

/**
 * The front page of a character of the 2014 rules: the abilities down the left, what happens in a
 * fight in the middle (the spells have pages of their own, so the middle column is the weapons and
 * the numbers of the spellcasting), and what the character is and can do on the right.
 */
export function FrontPage() {
  const page = useFitFront();
  const s = printedSheet.value;
  if (!s) return null;
  // With nothing to list, the weapons take the room that is left; a caster's numbers take it when the
  // spells are on their pages.
  const caster = Boolean(s.spellcasting) || blank.value;

  return (
    <section class="p-page p-front" data-edition="2014" ref={page}>
      <FrontHead />

      <div class="p-cols">
        <div class="p-col">
          <Badges />
          <AbilityBlocks />
        </div>

        <div class="p-col">
          <CombatStats />
          <InspirationBox />
          <AttacksPanel grow={!caster} />
          <SpellcastingPanel grow={!spellListOnFront()} />
          <FrontSpellList />
        </div>

        <div class="p-col">
          <ProficienciesPanel />
          <TraitsPanels />
          <ClassFeaturesPanels />
          <UsesPanel />
          <BlankFeaturesPanels />
          <CustomAndNotes />
        </div>
      </div>
      <PageFoot />
    </section>
  );
}
