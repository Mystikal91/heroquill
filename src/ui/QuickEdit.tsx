import { useEffect, useRef, useState } from "preact/hooks";
import { copyFromRules } from "../app/arrange";
import {
  closeQuickEdit,
  openQuickEdit,
  quickEditId,
  restoreQuickEdit,
  saveQuickEdit,
} from "../app/quickEdit";
import { content } from "../app/store";
import { KIND_META } from "../homebrew/catalog";
import { type UiKey, ui } from "../i18n/ui";

/** The pencil next to a name or a text: opens Quick edit for that entry. */
export function EditPencil({ id }: { id: string }) {
  const c = content.value;
  if (!c?.index.has(id)) return null;
  return (
    <button
      type="button"
      class="edit-pencil no-print"
      title={ui("quickEdit.open")}
      aria-label={ui("quickEdit.open")}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openQuickEdit(id);
      }}
    >
      ✎
    </button>
  );
}

const FIRST = ["name", "desc"];

/** Text fields in reading order: the name and the description first. */
function orderedFields(found: string[]): string[] {
  const rest = found.filter((f) => !FIRST.includes(f)).sort();
  return [...FIRST, ...rest];
}

const camelToWords = (field: string) => {
  const words = field.replace(/([A-Z])/g, " $1").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The fields that have a name in every language; the others show their key in words. */
const FIELD_LABELS: Record<string, UiKey> = {
  name: "quickEdit.f.name",
  desc: "quickEdit.f.desc",
  higherLevel: "spells.higherLevel",
  castingTime: "spells.castingTime",
  range: "spells.range",
  duration: "spells.duration",
  material: "quickEdit.f.material",
  age: "quickEdit.f.age",
  alignment: "quickEdit.f.alignment",
  sizeDescription: "quickEdit.f.sizeDescription",
  languageDescription: "quickEdit.f.languageDescription",
  flavor: "quickEdit.f.flavor",
  featureName: "quickEdit.f.featureName",
  featureDesc: "quickEdit.f.featureDesc",
  abbreviation: "quickEdit.f.abbreviation",
};

function fieldLabel(field: string): string {
  const key = FIELD_LABELS[field];
  return key ? ui(key) : camelToWords(field);
}

/** Open while an entry is being edited. */
export function QuickEditDialog() {
  const id = quickEditId.value;
  if (!id || !content.value) return null;
  return <Editor key={id} id={id} />;
}

function Editor({ id }: { id: string }) {
  const c = content.value;
  const dialog = useRef<HTMLDialogElement>(null);
  const fields = c ? orderedFields(c.fields(id)) : [];
  // The boxes start from what is on screen (a machine translation, or the English original if
  // that is what is shown); only the ones the person changes are saved.
  const [initial] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f, c?.displayed(id, f) ?? c?.raw(id, f) ?? ""])),
  );
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  if (!c) return null;
  const anyEdited = fields.some((f) => c.isEdited(id, f));
  const entry = c.index.get(id);
  const canCopy = entry !== undefined && KIND_META[entry.kind].role !== "owned";

  const finish = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      closeQuickEdit();
    }
  };

  return (
    <dialog ref={dialog} class="quick-edit" onClose={closeQuickEdit}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const changed = Object.fromEntries(
            Object.entries(values).filter(([field, text]) => text !== initial[field]),
          );
          void finish(() => saveQuickEdit(id, changed));
        }}
      >
        <h3>{ui("quickEdit.title", { name: c.name(id) })}</h3>
        <p class="muted">{ui("quickEdit.hint")}</p>
        {fields.map((field) => {
          const value = values[field] ?? "";
          const original = c.base(id, field);
          return (
            <div class="field" key={field}>
              <label htmlFor={`qe-${field}`}>{fieldLabel(field)}</label>
              {field === "name" ? (
                <input
                  id={`qe-${field}`}
                  type="text"
                  value={value}
                  onInput={(e) => setValues({ ...values, [field]: e.currentTarget.value })}
                />
              ) : (
                <textarea
                  id={`qe-${field}`}
                  rows={Math.min(12, Math.max(3, Math.ceil(value.length / 55) + 1))}
                  value={value}
                  onInput={(e) => setValues({ ...values, [field]: e.currentTarget.value })}
                />
              )}
              {c.isEdited(id, field) && original && (
                <small class="muted">
                  {ui("quickEdit.original")}:{" "}
                  {original.length > 160 ? `${original.slice(0, 160)}…` : original}
                </small>
              )}
            </div>
          );
        })}
        <div class="quick-edit-actions">
          <button type="submit" class="primary" disabled={busy}>
            {ui("quickEdit.save")}
          </button>
          <button type="button" onClick={closeQuickEdit} disabled={busy}>
            {ui("quickEdit.cancel")}
          </button>
          {canCopy && (
            <button
              type="button"
              disabled={busy}
              title={ui("quickEdit.copyHint")}
              onClick={() =>
                void finish(async () => {
                  await copyFromRules([id]);
                })
              }
            >
              {ui("quickEdit.copy")}
            </button>
          )}
          {anyEdited && (
            <button
              type="button"
              class="danger"
              disabled={busy}
              onClick={() => void finish(() => restoreQuickEdit(id))}
            >
              {ui("quickEdit.restore")}
            </button>
          )}
        </div>
      </form>
    </dialog>
  );
}
