import { signal } from "@preact/signals";

/**
 * When each pack was last exported, and since when it has changes that no copy has. A pack lives on
 * this device only, so the studio reminds the person to keep a copy: once a pack has gone a day
 * with changes and no export, a gentle bar offers one, and "later" holds it for a week.
 */
interface BackupInfo {
  /** When the pack was last exported. */
  exportedAt?: number;
  /** When the first change after that was made. */
  dirtySince?: number;
  /** The reminder stays quiet until then. */
  snoozedUntil?: number;
}

const KEY = "hq-backup-v1";
const DAY = 24 * 60 * 60 * 1000;

function load(): Record<string, BackupInfo> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, BackupInfo>) : {};
  } catch {
    return {};
  }
}

export const backups = signal<Record<string, BackupInfo>>(load());

function save(next: Record<string, BackupInfo>) {
  backups.value = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage that is full or blocked: the reminder is a convenience, so it simply stays in memory.
  }
}

const update = (id: string, fn: (info: BackupInfo) => BackupInfo) =>
  save({ ...backups.value, [id]: fn(backups.value[id] ?? {}) });

/** A pack changed: the first change after a copy starts the clock. */
export function noteChange(id: string, now = Date.now()): void {
  if (backups.value[id]?.dirtySince !== undefined) return;
  update(id, (info) => ({ ...info, dirtySince: now }));
}

/** A pack was exported: it is safe as of now. */
export function noteExport(id: string, now = Date.now()): void {
  save({ ...backups.value, [id]: { exportedAt: now } });
}

/** "Later": no reminder about this pack for a week. */
export function snoozeBackup(id: string, now = Date.now()): void {
  update(id, (info) => ({ ...info, snoozedUntil: now + 7 * DAY }));
}

/** How many days a pack has had changes without a copy, when it is time to say so. */
export function backupDue(id: string, now = Date.now()): number | undefined {
  const info = backups.value[id];
  if (info?.dirtySince === undefined) return undefined;
  if (info.snoozedUntil !== undefined && now < info.snoozedUntil) return undefined;
  const days = Math.floor((now - info.dirtySince) / DAY);
  return days >= 1 ? days : undefined;
}

/** When a pack was last exported, if ever. */
export const lastExport = (id: string): number | undefined => backups.value[id]?.exportedAt;
