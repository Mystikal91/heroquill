import { printSheet } from "../../app/store";
import { ClassFeaturesPanels, TraitsPanels, UsesPanel } from "./FrontPanels";
import {
  AbilityBlocks,
  AttacksPanel,
  Badges,
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

/**
 * The front page of a character of the 2024 rules. The same three columns as the 2014 one, with what
 * the new rules put on a sheet: Heroic Inspiration, the mastery of each weapon beside its damage,
 * armor training, and the feats before the species traits (the background gives one, and so do the
 * Fighting Style and the Epic Boon).
 */
export function FrontPage2024() {
  const page = useFitFront();
  const s = printSheet.value;
  if (!s) return null;
  const caster = Boolean(s.spellcasting);

  return (
    <section class="p-page p-front" data-edition="2024" ref={page}>
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
          <TraitsPanels featsFirst />
          <ClassFeaturesPanels />
          <UsesPanel />
          <CustomAndNotes />
        </div>
      </div>
    </section>
  );
}
