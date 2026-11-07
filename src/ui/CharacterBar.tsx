import {
  character,
  characters,
  content,
  deleteCurrentCharacter,
  deletedCharacter,
  duplicateCharacter,
  importFailed,
  importNotice,
  openCharacter,
  saveStatus,
  shareNotice,
  startNewCharacter,
  undoDelete,
} from "../app/store";
import { transferDialog } from "../app/transferState";
import { ui } from "../i18n/ui";
import { Popover } from "./Popover";

// Nothing is said while idle, so that state has no text to translate.
const STATUS_KEYS = {
  saving: "bar.saving",
  saved: "bar.saved",
  failed: "bar.notSaved",
} as const;

export function CharacterBar() {
  const current = character.value;
  const c = content.value;
  const unnamed = ui("sheet.unnamed");

  /** "Elowen · Wizard 3": the name and what the character is, so unnamed ones can be told apart. */
  const label = (name: string, classes: { classId: string; level: number }[]) => {
    const what = classes.map((cl) => `${c?.name(cl.classId) ?? ""} ${cl.level}`.trim()).join(" / ");
    return [name || unnamed, what].filter(Boolean).join(" · ");
  };

  // The list is saved data; the open character may be newer, so show its live name and classes.
  const live = { id: current.id, name: current.name, updatedAt: 0, classes: current.classes };
  const options = characters.value.some((s) => s.id === current.id)
    ? characters.value.map((s) => (s.id === current.id ? { ...s, ...live } : s))
    : [live, ...characters.value];

  return (
    <div class="card bar no-print">
      <div class="bar-head">
        <label for="character-select">{ui("bar.character")}</label>
        <output class={`bar-status status-${saveStatus.value}`}>
          {saveStatus.value === "idle" ? "" : ui(STATUS_KEYS[saveStatus.value])}
        </output>
      </div>
      <div class="bar-row">
        <select
          id="character-select"
          value={current.id}
          onChange={(e) => void openCharacter(e.currentTarget.value)}
        >
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {label(s.name, s.classes)}
            </option>
          ))}
        </select>
        <button type="button" class="bar-new" onClick={() => void startNewCharacter()}>
          {ui("bar.new")}
        </button>
        <Popover label={<span aria-hidden="true">⋯</span>} title={ui("bar.more")}>
          <ul class="menu-list">
            <li>
              <button type="button" onClick={() => void duplicateCharacter()}>
                {ui("bar.duplicate")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  transferDialog.value = "exportCharacter";
                }}
              >
                {ui("bar.share")}
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  transferDialog.value = "start";
                }}
              >
                {ui("io.menu")}
              </button>
            </li>
            <li>
              <button type="button" class="danger" onClick={() => void deleteCurrentCharacter()}>
                {ui("bar.delete")}
              </button>
            </li>
          </ul>
        </Popover>
      </div>
      {deletedCharacter.value && (
        <output class="note bar-undo">
          <span>{ui("bar.deleted", { name: deletedCharacter.value.name || unnamed })}</span>
          <button type="button" class="link" onClick={() => void undoDelete()}>
            {ui("bar.undo")}
          </button>
        </output>
      )}
      {shareNotice.value && (
        <p class="note" role={shareNotice.value === "failed" ? "alert" : "status"}>
          {ui(shareNotice.value === "failed" ? "share.openFailed" : "share.opened")}
        </p>
      )}
      {importNotice.value && (
        <output class="note">
          {ui(importNotice.value.packs === undefined ? "bar.restored" : "bar.withPacks", {
            ...importNotice.value,
            packs: importNotice.value.packs ?? 0,
          })}
        </output>
      )}
      {importFailed.value && (
        <p class="note" role="alert">
          {ui("bar.importError")}
        </p>
      )}
    </div>
  );
}
