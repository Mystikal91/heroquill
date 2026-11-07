import { useState } from "preact/hooks";
import { isHomebrewId } from "../../app/homebrew";
import { character, content, editionsAvailable, sheet, updateCharacter } from "../../app/store";
import { itemData } from "../../data/items";
import { proficiencyKeys } from "../../engine/equipment";
import { addToInventory, itemKind, packContents } from "../../engine/gear";
import { ui } from "../../i18n/ui";
import { Coins } from "../Coins";
import { InventoryList, LoadLine } from "../InventoryList";
import { itemLabel } from "../ItemTag";
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

        {editionsAvailable.value.length > 1 && (
          <p class="muted edition-current">
            {ui("edition.current", { name: ui(`edition.${c.ruleset}.name`) })}
          </p>
        )}
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

const PICKER_GROUPS = [
  ["homebrew", "inv.group.homebrew"],
  ["armor", "form.armorGroup"],
  ["weapon", "form.weaponGroup"],
  ["pack", "form.packGroup"],
  ["gear", "inv.group.gear"],
  ["tool", "inv.group.tool"],
  ["mount", "inv.group.mount"],
  ["magic", "form.magicGroup"],
] as const;

/** Everything the character carries: add items, say how many, and what is worn or wielded. */
export function EquipmentStep() {
  const index = content.value?.index;
  const [filter, setFilter] = useState("");
  const [onlyProficient, setOnlyProficient] = useState(false);
  const held = sheet.value ? proficiencyKeys(sheet.value.proficiencies) : undefined;
  const wanted = filter.trim().toLowerCase();

  // With the tick on, armor and weapons the character is not proficient with are left out.
  const proficientIn = (id: string) => {
    const entry = index?.get(id);
    if (!onlyProficient || !held || !entry) return true;
    const data = itemData(entry);
    const keys = (data.armor ?? data.weapon)?.proficiency;
    return keys === undefined || keys.some((k) => held.has(k));
  };
  const options = entriesOfKind("item").flatMap((o) => {
    const entry = index?.get(o.id);
    if (!entry) return [];
    const kind = itemKind(entry);
    const label = itemLabel(o.id);
    const shown = (!wanted || label.toLowerCase().includes(wanted)) && proficientIn(o.id);
    // What the person wrote is listed apart, first.
    const group = isHomebrewId(o.id) ? ("homebrew" as const) : kind;
    return shown && kind !== "enchantment" ? [{ id: o.id, kind: group, label }] : [];
  });

  return (
    <>
      <StartingEquipment />
      <label class="field">
        <span>{ui("form.searchItems")}</span>
        <input type="search" value={filter} onInput={(e) => setFilter(e.currentTarget.value)} />
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={onlyProficient}
          onChange={(e) => setOnlyProficient(e.currentTarget.checked)}
        />
        <span>{ui("form.onlyProficient")}</span>
      </label>
      <label class="field">
        <span>{ui("form.addItem")}</span>
        <select
          value=""
          onChange={(e) => {
            const itemId = e.currentTarget.value;
            if (!itemId) return;
            // A pack adds everything it holds instead of itself.
            const entry = index?.get(itemId);
            const contents = entry ? packContents(entry) : [];
            updateCharacter((d) => {
              if (contents.length > 0)
                for (const part of contents) addToInventory(d.inventory, part.item, part.quantity);
              else addToInventory(d.inventory, itemId, 1);
            });
          }}
        >
          <option value="">{ui("form.chooseItem")}</option>
          {PICKER_GROUPS.map(([kind, label]) => {
            const group = options.filter((o) => o.kind === kind);
            return group.length > 0 ? (
              <optgroup key={kind} label={ui(label)}>
                {group.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
      </label>
      <p class="muted">{ui("sheet.equipHint")}</p>
      <InventoryList removable />
      <LoadLine />
      <h4>{ui("coin.title")}</h4>
      <Coins />
      <CustomItem />
    </>
  );
}
