import { useRef, useState } from "preact/hooks";
import { createHomebrewPack } from "../../app/homebrew";
import { editingPackId } from "../../app/homebrew";
import { openStudioPack } from "../../app/studio";
import { offerUndo } from "../../app/undo";
import {
  addUserPack,
  importPackFile,
  packError,
  removeUserPack,
  userPacks,
} from "../../app/userPacks";
import { KIND_META } from "../../homebrew/catalog";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";

/** How many entries a pack shows in its list: the ones that belong to others (traits, features) are not counted. */
export const visibleEntries = (record: UserPackRecord) =>
  record.pack.entries.filter((e) => KIND_META[e.kind].role !== "owned");

/** The packs the person has, to open, start or add; always on screen at the left. */
export function Library() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const packs = userPacks.value.filter((p) => p.origin === "homebrew");
  const error = packError.value;

  return (
    <nav class="studio-library" aria-label={ui("studio.packs")}>
      <h3>{ui("studio.packs")}</h3>
      {packs.length === 0 ? (
        <p class="muted">{ui("studio.noPacks")}</p>
      ) : (
        <ul class="plain studio-packs">
          {packs.map((record) => (
            <li key={record.id}>
              <button
                type="button"
                class={editingPackId.value === record.id ? "studio-pack on" : "studio-pack"}
                aria-current={editingPackId.value === record.id}
                onClick={() => void openStudioPack(record.id)}
              >
                <b>{record.name}</b>
                <span class="muted">{visibleEntries(record).length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        class="studio-newpack"
        onSubmit={(e) => {
          e.preventDefault();
          void createHomebrewPack(name);
          setName("");
        }}
      >
        <input
          type="text"
          value={name}
          placeholder={ui("studio.newPackName")}
          aria-label={ui("studio.newPackName")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" class="primary">
          {ui("studio.create")}
        </button>
      </form>

      <button type="button" class="studio-link" onClick={() => fileInput.current?.click()}>
        {ui("hb.addFile")}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void importPackFile(file);
        }}
      />
      {(error === "exists" || error === "invalid") && (
        <p class="note" role="alert">
          {ui(error === "exists" ? "packs.exists" : "packs.invalid")}
        </p>
      )}
    </nav>
  );
}

/** Removes a pack, with a way back for a few seconds. */
export function removePack(record: UserPackRecord) {
  void removeUserPack(record.id).then(() =>
    offerUndo(ui("undo.packRemoved", { name: record.name }), () => addUserPack(record)),
  );
}
