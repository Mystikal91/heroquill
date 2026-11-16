import { backupDue, snoozeBackup } from "../../app/backup";
import { flushStudio } from "../../app/studio";
import { exportPack } from "../../app/userPacks";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";

/**
 * A quiet bar over the editor when the open pack has had changes for a day or more and no copy:
 * the packs live on this device only, so one export is the difference between a lost browser and
 * nothing lost.
 */
export function BackupNudge({ record }: { record: UserPackRecord | undefined }) {
  if (!record) return null;
  const days = backupDue(record.id);
  if (days === undefined) return null;
  return (
    <aside class="studio-nudge">
      <p>{ui("studio.backup.text", { name: record.name, n: days })}</p>
      <div class="studio-nudge-actions">
        <button
          type="button"
          class="primary"
          onClick={() => void flushStudio().then(() => exportPack(record))}
        >
          {ui("studio.backup.export")}
        </button>
        <button type="button" class="link" onClick={() => snoozeBackup(record.id)}>
          {ui("studio.backup.later")}
        </button>
      </div>
    </aside>
  );
}
