import { useEffect, useRef, useState } from "preact/hooks";
import {
  type CharacterPart,
  type CustomizePlan,
  closeCustomize,
  customizing,
  planCustomize,
  saveCustomItem,
} from "../app/customizeItem";
import { character, content } from "../app/store";
import { setText } from "../homebrew/entries";
import { ui } from "../i18n/ui";
import { entriesOfKind } from "./build/fields";
import { TextBox } from "./studio/Controls";
import { GenericForm } from "./studio/GenericForm";
import { EditProvider } from "./studio/scope";

function Form({ itemId, plan }: { itemId: string; plan: CustomizePlan }) {
  // The item is edited as a copy kept here; the pack is written only when the person saves.
  const [record, setRecord] = useState(plan.record);
  const held = character.value.inventory.find((i) => i.itemId === itemId);
  const [enchantment, setEnchantment] = useState(held?.enchantment ?? "");
  const [saving, setSaving] = useState(false);
  const c = content.value;
  const entry = record.pack.entries.find((e) => e.id === plan.id);
  const name = record.strings[`${plan.id}.name`] ?? "";
  const ready = name.trim() !== "";
  const weapon = Boolean((entry?.data as { weapon?: unknown } | undefined)?.weapon);
  const enchantments = c
    ? entriesOfKind("item").filter((o) => c.index.get(o.id)?.data.enchants)
    : [];

  const save = async () => {
    if (!ready || saving) return;
    setSaving(true);
    const part: CharacterPart = { enchantment };
    await saveCustomItem(itemId, plan, record, part);
    closeCustomize();
  };

  return (
    <EditProvider value={{ apply: (next) => setRecord(next) }}>
      <div class="item-dialog-head">
        <h3>{ui("item.customize.title", { name: c?.name(itemId) ?? itemId })}</h3>
        <button type="button" class="link" onClick={closeCustomize}>
          {ui("hb.cancel")}
        </button>
      </div>
      <div class="item-dialog-body">
        <p class="muted">
          {plan.editing
            ? ui("item.customize.hintEdit")
            : ui("item.customize.hintCopy", { pack: record.name })}
        </p>
        <section class="item-section">
          <h4>{ui("item.customize.basics")}</h4>
          <TextBox
            label={ui("hb.f.name")}
            value={name}
            onChange={(v) => setRecord(setText(record, plan.id, "name", v))}
          />
        </section>
        {entry && <GenericForm record={record} entry={entry} />}

        {weapon && enchantments.length > 0 && (
          <section class="item-section">
            <h4>{ui("item.customize.character")}</h4>
            <label class="field">
              <span>{ui("weapon.enchantment")}</span>
              <select value={enchantment} onChange={(e) => setEnchantment(e.currentTarget.value)}>
                <option value="">{ui("form.none")}</option>
                {enchantments.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </section>
        )}
      </div>
      <div class="item-dialog-actions">
        <button
          type="button"
          class="primary"
          disabled={!ready || saving}
          onClick={() => void save()}
        >
          {ui("hb.save")}
        </button>
        <button type="button" onClick={closeCustomize}>
          {ui("hb.cancel")}
        </button>
      </div>
    </EditProvider>
  );
}

/**
 * The window that changes a weapon or an armor of the inventory: the same form the studio has for an
 * item. The result is saved as an item of the homebrew pack, in place of the one in the inventory.
 */
export function CustomizeItemDialog() {
  const itemId = customizing.value;
  const dialog = useRef<HTMLDialogElement>(null);
  const [plan, setPlan] = useState<{ id: string; plan: CustomizePlan } | undefined>();

  // The form is made once for each item opened, from what the content says at that moment.
  useEffect(() => {
    if (!itemId) {
      setPlan(undefined);
      return;
    }
    const made = planCustomize(itemId);
    if (made) setPlan({ id: itemId, plan: made });
    else closeCustomize();
  }, [itemId]);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (plan && !node.open) node.showModal();
    if (!plan && node.open) node.close();
  }, [plan]);

  if (!itemId) return null;
  return (
    <dialog ref={dialog} class="quick-edit item-dialog" onClose={closeCustomize}>
      {plan && plan.id === itemId && <Form key={itemId} itemId={itemId} plan={plan.plan} />}
    </dialog>
  );
}
