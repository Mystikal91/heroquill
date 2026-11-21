import { updateEncounter } from "../../app/dm";
import type { Encounter } from "../../engine/encounter";
import { ui } from "../../i18n/ui";

/** Notes on the encounter itself: tactics, treasure, what to remember. Closed until wanted, with a mark when it has some. */
export function EncounterNotes({ e }: { e: Encounter }) {
  const has = e.notes.trim() !== "";
  return (
    <details class="dm-notes" data-has={has || undefined}>
      <summary>
        {ui("dm.encounterNotes")}
        {has && <span class="dm-notes-dot" aria-hidden="true" />}
      </summary>
      <textarea
        rows={4}
        maxLength={5000}
        value={e.notes}
        aria-label={ui("dm.encounterNotes")}
        placeholder={ui("dm.encounterNotesPlaceholder")}
        onInput={(ev) => {
          const notes = ev.currentTarget.value;
          updateEncounter((x) => ({ ...x, notes }));
        }}
      />
    </details>
  );
}
