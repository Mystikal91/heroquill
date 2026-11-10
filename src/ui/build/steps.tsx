import { character, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Coins } from "../Coins";
import { InventoryList, LoadLine } from "../InventoryList";
import { AddItemButton } from "../ItemPicker";
import { CustomItem } from "./CustomItem";
import { BackgroundInfo, SpeciesInfo } from "./EntryInfo";
import { OptionalRules } from "./OptionalRules";
import { StartingEquipment } from "./StartingEquipment";
import { Select, entriesOfKind } from "./fields";

/** Name, species, subspecies and background. */
export function OriginStep() {
  const c = character.value;
  return (
    <div class="step-split">
      <div class="step-fields">
        <label class="field">
          <span>{ui("form.name")}</span>
          <input
            type="text"
            value={c.name}
            onInput={(e) =>
              updateCharacter((d) => {
                d.name = e.currentTarget.value;
              })
            }
          />
        </label>

        <Select
          label={ui("form.species")}
          value={c.choices.species}
          options={entriesOfKind("species")}
          onChange={(id) =>
            updateCharacter((d) => {
              d.choices.species = id;
              d.choices.subspecies = undefined;
            })
          }
        />
        {c.choices.species && entriesOfKind("subspecies", c.choices.species).length > 0 && (
          <Select
            label={ui("form.subspecies")}
            value={c.choices.subspecies}
            options={entriesOfKind("subspecies", c.choices.species)}
            onChange={(id) =>
              updateCharacter((d) => {
                d.choices.subspecies = id;
              })
            }
          />
        )}

        <Select
          label={ui("form.background")}
          value={c.choices.background}
          options={entriesOfKind("background")}
          onChange={(id) =>
            updateCharacter((d) => {
              d.choices.background = id;
            })
          }
        />
        <OptionalRules />
      </div>
      <div class="step-info">
        <SpeciesInfo />
        <BackgroundInfo />
      </div>
    </div>
  );
}

/** Everything the character carries: add items, say how many, and what is worn or wielded. */
export function EquipmentStep() {
  return (
    <>
      <StartingEquipment />
      <div class="step-add-item">
        <AddItemButton primary />
      </div>
      <p class="muted">{ui("sheet.equipHint")}</p>
      <InventoryList removable />
      <LoadLine />
      <h4>{ui("coin.title")}</h4>
      <Coins />
      <CustomItem />
    </>
  );
}
