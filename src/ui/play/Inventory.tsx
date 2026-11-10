import { content } from "../../app/store";
import { ui } from "../../i18n/ui";
import { EquipmentBoard } from "../equipment/EquipmentBoard";
import { Panel } from "../sheet/parts";

/**
 * What the character wears, holds and carries, at the table: the places of the body and the
 * backpack. It is there with nothing carried too: the backpack has the button that adds things.
 */
export function PlayInventory() {
  if (!content.value) return null;
  return (
    <Panel title={ui("play.inventory")} className="equipment-panel">
      <EquipmentBoard mode="play" />
    </Panel>
  );
}
