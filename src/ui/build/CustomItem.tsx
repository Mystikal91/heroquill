import { useState } from "preact/hooks";
import { updateCharacter } from "../../app/store";
import { newCustomItemId } from "../../engine/gear";
import { ui } from "../../i18n/ui";
import { metricUnits, toPounds } from "../../i18n/units";

/** An item the rules do not list: a name, how heavy it is, a note. */
export function CustomItem() {
  const [name, setName] = useState("");
  const [heavy, setHeavy] = useState("");
  const [note, setNote] = useState("");

  const add = () => {
    const label = name.trim();
    if (!label) return;
    const parsed = Number(heavy.replace(",", "."));
    const pounds =
      heavy.trim() && Number.isFinite(parsed) && parsed >= 0 ? toPounds(parsed) : undefined;
    const id = newCustomItemId();
    updateCharacter((d) => {
      d.inventory.push({
        itemId: id,
        quantity: 1,
        equipped: false,
        custom: {
          name: label,
          ...(pounds !== undefined && { weight: pounds }),
          ...(note.trim() && { note: note.trim() }),
        },
      });
    });
    setName("");
    setHeavy("");
    setNote("");
  };

  return (
    <details class="custom-item">
      <summary>{ui("inv.custom.title")}</summary>
      <p class="muted">{ui("inv.custom.hint")}</p>
      <label class="field" htmlFor="custom-name">
        <span>{ui("inv.custom.name")}</span>
      </label>
      <input
        id="custom-name"
        type="text"
        maxLength={80}
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      <label class="field" htmlFor="custom-weight">
        <span>{ui("inv.custom.weight", { unit: metricUnits.value ? "kg" : "lb" })}</span>
      </label>
      <input
        id="custom-weight"
        type="text"
        inputMode="decimal"
        value={heavy}
        onInput={(e) => setHeavy(e.currentTarget.value)}
      />
      <label class="field" htmlFor="custom-note">
        <span>{ui("inv.custom.note")}</span>
      </label>
      <input
        id="custom-note"
        type="text"
        value={note}
        onInput={(e) => setNote(e.currentTarget.value)}
      />
      <button type="button" class="secondary" disabled={!name.trim()} onClick={add}>
        {ui("inv.custom.add")}
      </button>
    </details>
  );
}
