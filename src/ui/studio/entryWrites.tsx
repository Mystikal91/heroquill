import type { Entry } from "../../data/schema";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { setText, updateEntry } from "../../homebrew/entries";
import { syncItemData } from "../../homebrew/sync";
import type { UserPackRecord } from "../../storage/packs";
import { FieldControl } from "./Controls";
import { fieldHelp } from "./Help";
import { fieldLabel } from "./labels";
import { useEdit } from "./scope";

/** What the parts of the page of an entry write: a text, a field of the data, the effects. */
export function useEntryWrites(record: UserPackRecord, entry: Entry) {
  const { apply } = useEdit();
  const id = entry.id;
  const data = entry.data as Record<string, unknown>;
  const change = (changes: Record<string, unknown>, label: string) => {
    const next = { ...data };
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) delete next[key];
      else next[key] = value;
    }
    const patch = entry.kind === "item" ? syncItemData(next) : next;
    // Replace the whole data: a key taken away must be gone, which a merge cannot say.
    const cleared = Object.fromEntries(
      Object.keys(data)
        .filter((k) => !(k in patch))
        .map((k) => [k, undefined]),
    );
    apply(updateEntry(record, id, { data: { ...patch, ...cleared } }), `${id}.data.${label}`);
  };
  return {
    data,
    text: (field: string) => record.strings[`${id}.${field}`] ?? "",
    writeText: (field: string, value: string) =>
      apply(setText(record, id, field, value), `${id}.${field}`),
    writeData: (key: string, value: unknown) => change({ [key]: value }, key),
    /** Several fields of the data in one step (one undo): an `undefined` takes the field away. */
    writeDataMany: (changes: Record<string, unknown>) => change(changes, "many"),
    writeEffects: (effects: Entry["effects"]) =>
      apply(updateEntry(record, id, { effects }), `${id}.effects`),
  };
}

/** The fields of the data of an entry that the keys name, each with its own control, in that order. */
export function DataControls({
  record,
  entry,
  keys,
}: {
  record: UserPackRecord;
  entry: Entry;
  keys: readonly string[];
}) {
  const { data, writeData } = useEntryWrites(record, entry);
  const specs = DATA_FIELDS[entry.kind];
  return (
    <>
      {keys.map((key) => {
        const spec = specs.find((s) => s.key === key);
        if (!spec) return null;
        return (
          <FieldControl
            key={key}
            label={fieldLabel(key)}
            help={fieldHelp(key)}
            type={spec.type}
            value={data[key]}
            optional={spec.optional}
            onChange={(v) => writeData(key, v)}
          />
        );
      })}
    </>
  );
}
