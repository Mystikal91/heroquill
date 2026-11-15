import { useEffect, useRef, useState } from "preact/hooks";
import { addCustomSpell, customSpellFor, startCustomSpell } from "../app/customSpell";
import { setText } from "../homebrew/entries";
import { ui } from "../i18n/ui";
import { TextBox } from "./studio/Controls";
import { SpellForm } from "./studio/SpellForm";
import { EditProvider } from "./studio/scope";

const close = () => {
  customSpellFor.value = undefined;
};

function Form({ classId, list }: { classId: string; list: "known" | "prepared" }) {
  // The spell is made once, empty, and edited as it is until the person saves it.
  const [started] = useState(() => startCustomSpell(classId));
  const [record, setRecord] = useState(started.record);
  const [saving, setSaving] = useState(false);
  const id = started.id;
  const entry = record.pack.entries.find((e) => e.id === id);
  const name = record.strings[`${id}.name`] ?? "";
  const ready = name.trim() !== "";
  return (
    <EditProvider value={{ apply: (next) => setRecord(next) }}>
      <p class="muted">{ui("spells.createHint")}</p>
      <TextBox
        label={ui("hb.f.name")}
        value={name}
        onChange={(v) => setRecord(setText(record, id, "name", v))}
      />
      {entry && <SpellForm record={record} entry={entry} hideClasses />}
      <div class="quick-edit-actions">
        <button
          type="button"
          class="primary"
          disabled={!ready || saving}
          onClick={async () => {
            setSaving(true);
            await addCustomSpell(record, id, classId, list);
            close();
          }}
        >
          {ui("hb.save")}
        </button>
        <button type="button" onClick={close}>
          {ui("hb.cancel")}
        </button>
      </div>
    </EditProvider>
  );
}

/** The window to write a spell for a class of the character, which is added to its list. */
export function CustomSpellDialog() {
  const target = customSpellFor.value;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (target && !node.open) node.showModal();
    if (!target && node.open) node.close();
  }, [target]);
  if (!target) return null;
  const [classId = "", list = "known"] = target.split("|");
  return (
    <dialog ref={dialog} class="quick-edit custom-spell" onClose={close}>
      <h3>{ui("spells.create")}</h3>
      <Form classId={classId} list={list === "prepared" ? "prepared" : "known"} />
    </dialog>
  );
}
