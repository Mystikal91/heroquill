import { character, editionsAvailable, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Choices } from "../Choices";
import { Coins } from "../Coins";
import { InventoryList, LoadLine } from "../InventoryList";
import { AddItemButton } from "../ItemPicker";
import { CardSelect, backgroundFact, speciesFact } from "./CardSelect";
import { CustomItem } from "./CustomItem";
import { BackgroundInfo, SpeciesInfo } from "./EntryInfo";
import { OptionalRules } from "./OptionalRules";
import { StartingEquipment } from "./StartingEquipment";
import { Select, entriesOfKind } from "./fields";

/** Name, species and subspecies, with what the species asks to choose. */
export function SpeciesStep() {
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

        {editionsAvailable.value.length > 1 && (
          <p class="edition-current">
            <span class="edition-tag">{ui(`edition.${c.ruleset}.name`)}</span>
          </p>
        )}
        <CardSelect
          label={ui("form.species")}
          fact={speciesFact}
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
        {/* What the species asks to choose (a lineage, a skill), asked here and not three steps on. */}
        <Choices only="species" />
      </div>
      <div class="step-info">
        <SpeciesInfo />
      </div>
    </div>
  );
}

/** The background, with what it asks to choose and the optional rules of origin. */
export function BackgroundStep() {
  const c = character.value;
  return (
    <div class="step-split">
      <div class="step-fields">
        <CardSelect
          label={ui("form.background")}
          fact={backgroundFact}
          value={c.choices.background}
          options={entriesOfKind("background")}
          onChange={(id) =>
            updateCharacter((d) => {
              d.choices.background = id;
            })
          }
        />
        <Choices only="background" />
        <OptionalRules />
      </div>
      <div class="step-info">
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
