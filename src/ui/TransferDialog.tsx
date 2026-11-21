import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { characterFile, exportCharacterWithPacks } from "../app/carry";
import {
  driveConfigured,
  driveProblem,
  driveState,
  listFromDrive,
  loadSignIn,
  readFromDrive,
  saveCharacterToDrive,
  saveToDrive,
} from "../app/drive";
import { type ConflictPolicy, character, countConflicts, importText } from "../app/store";
import {
  type TransferReport,
  applyTransfer,
  currentCounts,
  downloadLinks,
  exportTransfer,
} from "../app/transfer";
import { type TransferStep, transferDialog, transferInbox } from "../app/transferState";
import { importProgress } from "../app/userPacks";
import { parseCharacter } from "../engine/characterSchema";
import { type UiKey, ui } from "../i18n/ui";
import {
  type Bundle,
  DEFAULT_SECTIONS,
  SECTIONS,
  type Section,
  describeBundle,
  openSealed,
  openTransfer,
} from "../storage/bundle";
import { WrongPassphrase } from "../storage/crypto";
import { type DriveListing, characterDriveName, driveFileKind } from "../storage/drive";
import { ShareCharacter } from "./ShareCharacter";

const close = () => {
  transferDialog.value = undefined;
  transferInbox.value = undefined;
};

function save(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function Rows({
  counts,
  chosen,
  onChange,
  only,
}: {
  counts: Record<Section, number>;
  chosen: Set<Section>;
  onChange: (next: Set<Section>) => void;
  /** Show only the parts that have something. */
  only?: boolean;
}) {
  return (
    <ul class="plain transfer-rows">
      {SECTIONS.filter((s) => !only || counts[s] > 0).map((section) => (
        <li key={section} class={counts[section] === 0 ? "empty" : ""}>
          <label class="check">
            <input
              type="checkbox"
              checked={chosen.has(section)}
              disabled={counts[section] === 0}
              onChange={(e) => {
                const next = new Set(chosen);
                if (e.currentTarget.checked) next.add(section);
                else next.delete(section);
                onChange(next);
              }}
            />
            <span>{ui(`transfer.sec.${section}` as UiKey, { n: counts[section] })}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/** What the Drive buttons are doing or have done, under them. */
export function DriveMessage() {
  const state = driveState.value;
  if (!driveConfigured || state === "idle") return null;
  const text =
    state === "working"
      ? ui("transfer.drive.working")
      : state === "saved"
        ? ui("transfer.drive.saved")
        : state === "none"
          ? ui("transfer.drive.none")
          : ui("transfer.drive.failed", { why: driveProblem.value ?? "" });
  return (
    <p class="note" aria-live="polite">
      {text}
    </p>
  );
}

const Back = ({ to = "start" }: { to?: TransferStep }) => (
  <button
    type="button"
    class="link transfer-back"
    onClick={() => {
      transferDialog.value = to;
      transferInbox.value = undefined;
    }}
  >
    ← {ui("transfer.back")}
  </button>
);

/** A big button with an arrow, a title and a line saying what it does. */
function Card({
  arrow,
  title,
  hint,
  onClick,
  disabled,
}: {
  arrow: string;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" class="transfer-card" disabled={disabled} onClick={onClick}>
      <span class="transfer-arrow" aria-hidden="true">
        {arrow}
      </span>
      <b>{title}</b>
      <small>{hint}</small>
    </button>
  );
}

/** The first screen: import or export. */
function Start() {
  return (
    <>
      <p class="muted">{ui("io.intro")}</p>
      <div class="transfer-cards">
        <Card
          arrow="↓"
          title={ui("io.import")}
          hint={ui("io.importHint")}
          onClick={() => {
            transferDialog.value = "importFrom";
          }}
        />
        <Card
          arrow="↑"
          title={ui("io.export")}
          hint={ui("io.exportHint")}
          onClick={() => {
            transferDialog.value = "exportWhat";
          }}
        />
      </div>
    </>
  );
}

/** Export, step two: this character alone, or everything on this device. */
function ExportWhat() {
  const name = character.value.name || ui("sheet.unnamed");
  return (
    <>
      <Back />
      <h4>{ui("io.exportWhat")}</h4>
      <div class="transfer-cards">
        <Card
          arrow="♞"
          title={ui("io.thisCharacter")}
          hint={ui("io.thisCharacterHint", { name })}
          onClick={() => {
            transferDialog.value = "exportCharacter";
          }}
        />
        <Card
          arrow="⇅"
          title={ui("io.everything")}
          hint={ui("io.everythingHint")}
          onClick={() => {
            transferDialog.value = "export";
          }}
        />
      </div>
    </>
  );
}

/** Export, step three for one character: a file, the Drive, a link or a QR code. */
function ExportCharacter() {
  const [saved, setSaved] = useState<string | undefined>(undefined);
  useEffect(() => {
    driveState.value = "idle";
    if (driveConfigured) void loadSignIn().catch(() => undefined);
  }, []);
  const current = character.value;
  return (
    <>
      <Back to="exportWhat" />
      <h4>{ui("io.characterHow", { name: current.name || ui("sheet.unnamed") })}</h4>
      <div class="share-actions">
        <button
          type="button"
          class="primary"
          onClick={() => {
            exportCharacterWithPacks();
            setSaved(characterFile().name);
          }}
        >
          {ui("transfer.save")}
        </button>
        {driveConfigured && (
          <button
            type="button"
            disabled={driveState.value === "working"}
            onClick={() =>
              void saveCharacterToDrive(
                characterDriveName(current.name, current.id),
                characterFile().text,
              )
            }
          >
            {ui("transfer.drive.save")}
          </button>
        )}
      </div>
      {saved && (
        <p class="note" aria-live="polite">
          {ui("io.fileSaved", { name: saved })}
        </p>
      )}
      <DriveMessage />
      <ShareCharacter />
    </>
  );
}

/**
 * Hands the text of a file to the app, which finds out by itself what it is. A transfer file moves
 * on to its own step; a single character or an old backup is put in at once and the window closes.
 */
async function openText(text: string, setFailed: (failed: boolean) => void) {
  const result = await importText(text);
  setFailed(result === "failed");
  if (result === "done") close();
}

/** Import, step two: a file on this device, or a file in Google Drive. */
function ImportFrom() {
  const picker = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    driveState.value = "idle";
    if (driveConfigured) void loadSignIn().catch(() => undefined);
  }, []);
  return (
    <>
      <Back />
      <h4>{ui("io.importFrom")}</h4>
      <input
        ref={picker}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) await openText(await file.text(), setFailed);
        }}
      />
      <div class="transfer-cards">
        <Card
          arrow="▤"
          title={ui("io.fromFile")}
          hint={ui("io.fromFileHint")}
          onClick={() => picker.current?.click()}
        />
        {driveConfigured && (
          <Card
            arrow="☁"
            title={ui("io.fromDrive")}
            hint={ui("io.fromDriveHint")}
            onClick={() => {
              transferDialog.value = "importDrive";
            }}
          />
        )}
      </div>
      {failed && (
        <p class="note" role="alert">
          {ui("bar.importError")}
        </p>
      )}
    </>
  );
}

/** What a Drive file is, in words: a character (named after its file) or the whole account. */
function driveLabel(file: DriveListing): string {
  if (driveFileKind(file.name) === "account") return ui("io.driveAccount");
  const words = file.name
    .replace(/^dnd-character-maker-/, "")
    .replace(/\.dndchar\.json$/, "")
    .replace(/-[a-z0-9]{8}$/i, "")
    .replace(/-/g, " ")
    .trim();
  return ui("io.driveCharacter", { name: words || ui("sheet.unnamed") });
}

/** Import from the Drive: the files the app made there, and the person picks which to bring in. */
function ImportDrive() {
  const [files, setFiles] = useState<DriveListing[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    driveState.value = "idle";
    void listFromDrive().then(setFiles);
  }, []);
  return (
    <>
      <Back to="importFrom" />
      <h4>{ui("io.pickDrive")}</h4>
      <p class="muted">{ui("transfer.drive.hint")}</p>
      {files && files.length > 0 && (
        <ul class="plain drive-files">
          {files.map((file) => (
            <li key={file.id}>
              <button
                type="button"
                class="transfer-card"
                disabled={driveState.value === "working"}
                onClick={async () => {
                  const text = await readFromDrive(file.id);
                  if (text !== undefined) await openText(text, setFailed);
                }}
              >
                <b>{driveLabel(file)}</b>
                <small>
                  {ui("io.driveModified", { date: new Date(file.modifiedTime).toLocaleString() })}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <p class="note" role="alert">
          {ui("bar.importError")}
        </p>
      )}
      <DriveMessage />
    </>
  );
}

function ExportPane() {
  const info = currentCounts();
  const [chosen, setChosen] = useState<Set<Section>>(
    () => new Set(DEFAULT_SECTIONS.filter((s) => info.counts[s] > 0 || s === "settings")),
  );
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | undefined>(undefined);
  const canShare = typeof navigator.canShare === "function" && typeof File !== "undefined";

  const make = async () => {
    setBusy(true);
    try {
      return await exportTransfer(chosen, pass);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Back to="exportWhat" />
      <h4>{ui("transfer.takeWhat")}</h4>
      <Rows counts={info.counts} chosen={chosen} onChange={setChosen} />
      {chosen.has("links") && info.files.length > 0 && (
        <p class="muted">{ui("transfer.filesNote", { names: info.files.join(", ") })}</p>
      )}
      <details class="transfer-protect" open={chosen.has("deeplKey")}>
        <summary>{ui("transfer.protect")}</summary>
        <label class="field">
          <span>{ui("transfer.passphrase")}</span>
          <input
            type="password"
            autocomplete="new-password"
            value={pass}
            onInput={(e) => setPass(e.currentTarget.value)}
          />
        </label>
        <p class="muted">{ui("transfer.passphraseHint")}</p>
      </details>
      {chosen.has("deeplKey") && !pass && <p class="note">{ui("transfer.deeplWarn")}</p>}
      {chosen.size === 0 && <p class="muted">{ui("transfer.nothing")}</p>}
      {saved && (
        <p class="note" aria-live="polite">
          {ui("transfer.saved", { name: saved })}
        </p>
      )}
      <DriveMessage />
      <div class="quick-edit-actions">
        <button
          type="button"
          class="primary"
          disabled={busy || chosen.size === 0}
          onClick={async () => {
            const file = await make();
            save(file.name, file.text);
            setSaved(file.name);
          }}
        >
          {ui("transfer.save")}
        </button>
        {driveConfigured && (
          <button
            type="button"
            disabled={busy || chosen.size === 0 || driveState.value === "working"}
            onClick={async () => {
              const file = await make();
              await saveToDrive(file.text);
            }}
          >
            {ui("transfer.drive.save")}
          </button>
        )}
        {canShare && (
          <button
            type="button"
            disabled={busy || chosen.size === 0}
            onClick={async () => {
              const file = await make();
              const shared = new File([file.text], file.name, { type: "application/json" });
              if (!navigator.canShare({ files: [shared] })) {
                save(file.name, file.text);
                setSaved(file.name);
                return;
              }
              try {
                await navigator.share({ files: [shared], title: file.name });
                setSaved(file.name);
              } catch {
                // The person closed the share sheet: nothing to do.
              }
            }}
          >
            {ui("transfer.share")}
          </button>
        )}
      </div>
    </>
  );
}

function Report({ report }: { report: TransferReport }) {
  const progress = importProgress.value;
  const [downloading, setDownloading] = useState(false);
  const [left, setLeft] = useState(report.links);
  return (
    <div class="note" aria-live="polite">
      <p>
        <b>{ui("transfer.done")}</b>
      </p>
      <ul class="plain">
        {report.characters && (
          <li>
            {ui("transfer.report.characters", {
              added: report.characters.added,
              skipped: report.characters.skipped,
            })}
            {report.characters.replaced > 0 &&
              ` ${ui("transfer.report.replaced", { n: report.characters.replaced })}`}
          </li>
        )}
        {report.encounters && (
          <li>
            {ui("transfer.report.encounters", {
              added: report.encounters.added,
              skipped: report.encounters.skipped,
            })}
            {report.encounters.replaced > 0 &&
              ` ${ui("transfer.report.replaced", { n: report.encounters.replaced })}`}
          </li>
        )}
        {report.packs !== undefined && <li>{ui("transfer.report.packs", { n: report.packs })}</li>}
        {report.edits !== undefined && <li>{ui("transfer.report.edits", { n: report.edits })}</li>}
        {report.settings && <li>{ui("transfer.report.settings")}</li>}
        {report.deeplKey && <li>{ui("transfer.report.deeplKey")}</li>}
        {report.translations !== undefined && (
          <li>{ui("transfer.report.translations", { n: report.translations })}</li>
        )}
        {report.unreadable > 0 && (
          <li>{ui("transfer.report.unreadable", { n: report.unreadable })}</li>
        )}
      </ul>
      {left.length > 0 && (
        <>
          <p>{ui("transfer.report.links", { n: left.length })}</p>
          <ul class="plain muted">
            {left.map((l) => (
              <li key={l.url}>{l.name}</li>
            ))}
          </ul>
          <button
            type="button"
            class="primary"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              await downloadLinks(left);
              setDownloading(false);
              setLeft([]);
            }}
          >
            {downloading && progress
              ? ui("packs.progress", { done: progress.done, total: progress.total })
              : ui("transfer.download")}
          </button>
        </>
      )}
    </div>
  );
}

function ImportPane() {
  const text = transferInbox.value;
  const [bundle, setBundle] = useState<Bundle | undefined>(undefined);
  const [sealed, setSealed] = useState(false);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<"wrong" | "unreadable" | undefined>(undefined);
  const [chosen, setChosen] = useState<Set<Section>>(new Set());
  const [report, setReport] = useState<TransferReport | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [conflicts, setConflicts] = useState(0);
  const [policy, setPolicy] = useState<ConflictPolicy>("newest");

  const take = useCallback((found: Bundle) => {
    const counts = describeBundle(found);
    setBundle(found);
    setChosen(new Set(SECTIONS.filter((s) => counts[s] > 0)));
    // Characters that are here already, with other content, need a word from the person.
    const list = (found.characters ?? []).flatMap((raw) => {
      try {
        return [parseCharacter(raw)];
      } catch {
        return [];
      }
    });
    void countConflicts(list).then(setConflicts);
  }, []);

  useEffect(() => {
    setBundle(undefined);
    setSealed(false);
    setError(undefined);
    setReport(undefined);
    if (!text) return;
    const opened = openTransfer(text);
    if (!opened) setError("unreadable");
    else if (opened.kind === "sealed") setSealed(true);
    else take(opened.bundle);
  }, [text, take]);

  const unlock = async () => {
    const opened = text ? openTransfer(text) : undefined;
    if (opened?.kind !== "sealed") return;
    try {
      take(await openSealed(opened.sealed, pass));
      setSealed(false);
      setError(undefined);
    } catch (e) {
      setError(e instanceof WrongPassphrase ? "wrong" : "unreadable");
    }
  };

  if (report) return <Report report={report} />;

  return (
    <>
      <Back />
      {error === "unreadable" && <p class="note">{ui("transfer.unreadable")}</p>}
      {sealed && (
        <>
          <p>{ui("transfer.sealed")}</p>
          <label class="field">
            <span>{ui("transfer.passphrase")}</span>
            <input
              type="password"
              autocomplete="current-password"
              value={pass}
              onInput={(e) => setPass(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pass) void unlock();
              }}
            />
          </label>
          {error === "wrong" && <p class="note">{ui("transfer.wrong")}</p>}
          <button type="button" class="primary" disabled={!pass} onClick={() => void unlock()}>
            {ui("transfer.open")}
          </button>
        </>
      )}
      {bundle && (
        <>
          <h4>{ui("transfer.bringWhat")}</h4>
          <p class="muted">
            {ui("transfer.madeOn", { date: new Date(bundle.exportedAt).toLocaleDateString() })}
          </p>
          <Rows counts={describeBundle(bundle)} chosen={chosen} onChange={setChosen} only />
          {conflicts > 0 && chosen.has("characters") && (
            <fieldset class="conflicts">
              <legend>{ui("transfer.conflict.title", { n: conflicts })}</legend>
              {(
                [
                  ["newest", "transfer.conflict.newest"],
                  ["keep", "transfer.conflict.keep"],
                  ["copy", "transfer.conflict.copy"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} class="check">
                  <input
                    type="radio"
                    name="conflict-policy"
                    checked={policy === value}
                    onChange={() => setPolicy(value)}
                  />
                  <span>{ui(label)}</span>
                </label>
              ))}
              {policy === "newest" && !bundle.characterTimes && (
                <p class="muted">{ui("transfer.conflict.undated")}</p>
              )}
            </fieldset>
          )}
          {bundle.files && bundle.files.length > 0 && (
            <p class="muted">{ui("transfer.filesNote", { names: bundle.files.join(", ") })}</p>
          )}
          <div class="quick-edit-actions">
            <button
              type="button"
              class="primary"
              disabled={busy || chosen.size === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  setReport(await applyTransfer(bundle, chosen, policy));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {ui("transfer.doImport")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

/** The window for moving the app's data to another device: prepare a file here, open it there. */
export function TransferDialog() {
  const mode = transferDialog.value;
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (mode && !node.open) node.showModal();
    if (!mode && node.open) node.close();
  }, [mode]);
  if (!mode) return null;
  return (
    <dialog ref={dialog} class="quick-edit transfer" onClose={close}>
      <header class="transfer-head">
        <h3>{ui("io.title")}</h3>
        <button type="button" class="link" aria-label={ui("transfer.close")} onClick={close}>
          ✕
        </button>
      </header>
      {mode === "start" ? (
        <Start />
      ) : mode === "exportWhat" ? (
        <ExportWhat />
      ) : mode === "exportCharacter" ? (
        <ExportCharacter />
      ) : mode === "export" ? (
        <ExportPane />
      ) : mode === "importFrom" ? (
        <ImportFrom />
      ) : mode === "importDrive" ? (
        <ImportDrive />
      ) : (
        <ImportPane />
      )}
    </dialog>
  );
}
