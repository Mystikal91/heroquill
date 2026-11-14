import { useRef, useState } from "preact/hooks";
import { showHomebrewList } from "../app/homebrew";
import { language } from "../app/language";
import { leavePage } from "../app/navigation";
import { content } from "../app/store";
import { offerUndo } from "../app/undo";
import {
  addUserPack,
  importAuroraFiles,
  importAuroraUrl,
  importProgress,
  importReport,
  isStale,
  keepEditions,
  packError,
  reimportPack,
  reimportStalePacks,
  removeUserPack,
  sameAddressPack,
  userPacks,
} from "../app/userPacks";
import { guidePath } from "../content/news";
import { brokenReferences } from "../data/schema";
import { type UiKey, ui } from "../i18n/ui";
import { type UserPackRecord, addressesOf, shortAddress } from "../storage/packs";

/** The names the packs that come with the app are shown with. */
const BUILT_IN_NAMES: Record<string, string> = {
  srd51: "SRD 5.1 (2014)",
  srd52: "SRD 5.2.1 (2024)",
};

/** How many entries of each kind a pack has, e.g. `3 spell, 2 item`. */
function summary(record: UserPackRecord): string {
  if (record.origin === "edits")
    return ui("packs.editedTexts", { n: Object.keys(record.strings).length });
  const counts = new Map<string, number>();
  for (const entry of record.pack.entries)
    counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, n]) => `${n} ${kind}`).join(", ");
}

/** The entries of a pack that depend on content it does not have, by kind, with their names. */
function incompleteByKind(record: UserPackRecord): [string, string[]][] {
  const kinds = new Map(record.pack.entries.map((e) => [e.id, e.kind]));
  const found = new Map<string, string[]>();
  for (const id of Object.keys(record.unresolved ?? {})) {
    const kind = kinds.get(id) ?? "other";
    found.set(kind, [...(found.get(kind) ?? []), record.strings[`${id}.name`] ?? id]);
  }
  return [...found.entries()]
    .map(([kind, names]) => [kind, names.sort((a, b) => a.localeCompare(b))] as [string, string[]])
    .sort(([a], [b]) => a.localeCompare(b));
}

/** The content packs the user added: what they hold, where they came from, and how to remove them. */
export function PacksPage() {
  const auroraInput = useRef<HTMLInputElement>(null);
  const [address, setAddress] = useState("");
  // The pack being made again when its address is not known: typed or chosen from files.
  const [target, setTarget] = useState<string | undefined>(undefined);
  const progress = importProgress.value;
  const report = importReport.value;
  // The homebrew packs are in the Homebrew editor: this page is for what comes from other files.
  const packs = userPacks.value.filter((p) => p.origin !== "homebrew");
  const error = packError.value;
  // The built-in content is spread over several files: count entries per pack id.
  const totals = new Map<string, number>();
  for (const p of content.value?.packs ?? []) {
    if (p.manifest.ruleset === "custom") continue;
    totals.set(p.manifest.id, (totals.get(p.manifest.id) ?? 0) + p.entries.length);
  }
  const builtIn = [...totals.entries()];

  const stale = packs.filter(isStale);
  // References to content that is not here: a pack that needs another one that was removed.
  const missing = new Map<string, { from: string; ref: string }[]>();
  for (const problem of brokenReferences(content.value?.packs ?? [])) {
    const pack = problem.from.split(":")[0] ?? "";
    missing.set(pack, [...(missing.get(pack) ?? []), problem]);
  }
  const targetPack = packs.find((p) => p.id === target);
  const chooseFiles = (id?: string) => {
    setTarget(id);
    auroraInput.current?.click();
  };

  const remove = (record: UserPackRecord) => {
    void removeUserPack(record.id).then(() =>
      offerUndo(ui("undo.packRemoved", { name: record.name }), () => addUserPack(record)),
    );
  };

  return (
    <article class="card packs">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("packs.title")}</h2>
      <p>{ui("packs.intro")}</p>
      <p class="note">{ui("packs.rights")}</p>
      <p>
        {ui("packs.homebrewHint")}{" "}
        <button type="button" class="link" onClick={showHomebrewList}>
          {ui("packs.openHomebrew")}
        </button>
      </p>

      <h3>{ui("packs.builtIn")}</h3>
      <ul class="plain">
        {builtIn.map(([id, count]) => (
          <li key={id}>
            <b>{BUILT_IN_NAMES[id] ?? id.toUpperCase()}</b> · {count} {ui("packs.entries")}
          </li>
        ))}
      </ul>

      <h3>{ui("packs.yours")}</h3>
      <p class="muted">{ui("packs.priority")}</p>
      {packs.length === 0 ? (
        <p class="muted">{ui("packs.none")}</p>
      ) : (
        <ul class="plain pack-list">
          {packs.map((record) => (
            <li key={record.id} class="pack">
              <div>
                <b>
                  {record.origin === "edits"
                    ? `${ui("packs.origin.edits")} (${record.lang})`
                    : record.name}
                </b>
                <span class={`pack-tag ${record.origin}`}>
                  {ui(`packs.origin.${record.origin}` as UiKey)}
                </span>
                {isStale(record) && (
                  <span class="pack-tag stale" title={ui("packs.staleHint")}>
                    {ui("packs.stale")}
                  </span>
                )}
                {(missing.get(record.id)?.length ?? 0) > 0 && (
                  <details class="pack-problems">
                    <summary class="pack-tag stale">
                      {ui("packs.problems", { n: missing.get(record.id)?.length ?? 0 })}
                    </summary>
                    <p class="muted">{ui("packs.problemsHint")}</p>
                    <ul class="plain muted">
                      {(missing.get(record.id) ?? []).slice(0, 20).map((p) => (
                        <li key={`${p.from}>${p.ref}`}>
                          {record.strings[`${p.from}.name`] ?? p.from} → {p.ref}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {Object.keys(record.unresolved ?? {}).length > 0 && (
                  <details class="pack-problems">
                    <summary class="pack-tag stale">
                      {ui("packs.unresolved", { n: Object.keys(record.unresolved ?? {}).length })}
                    </summary>
                    <p class="muted">{ui("packs.unresolvedHint")}</p>
                    {incompleteByKind(record).map(([kind, names]) => (
                      <p class="muted" key={kind}>
                        <b>{kind}</b>: {names.join(", ")}
                      </p>
                    ))}
                  </details>
                )}
                <div class="muted">{summary(record)}</div>
                {addressesOf(record).map((address) => (
                  <div class="muted" title={address} key={address}>
                    {shortAddress(address)}
                  </div>
                ))}
                {record.source?.files && <div class="muted">{record.source.files.join(", ")}</div>}
              </div>
              <div class="pack-actions">
                {record.origin === "personal" && (
                  <button
                    type="button"
                    class={isStale(record) ? "primary" : undefined}
                    disabled={Boolean(progress)}
                    onClick={() =>
                      record.source?.url ? void reimportPack(record) : setTarget(record.id)
                    }
                  >
                    {ui("packs.reimport")}
                  </button>
                )}
                <button type="button" class="danger" onClick={() => remove(record)}>
                  {ui("packs.remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {stale.some((r) => r.source?.url) && (
        <p>
          <button
            type="button"
            class="primary"
            disabled={Boolean(progress)}
            onClick={() => void reimportStalePacks()}
          >
            {ui("packs.reimportAll", { n: stale.filter((r) => r.source?.url).length })}
          </button>
        </p>
      )}
      {targetPack && (
        <div class="note">
          <p>{ui("packs.reimportHint", { name: targetPack.name })}</p>
          <form
            class="pack-address"
            onSubmit={(e) => {
              e.preventDefault();
              if (address.trim() && !progress) {
                void importAuroraUrl(address, targetPack.id);
                setAddress("");
                setTarget(undefined);
              }
            }}
          >
            <input
              type="url"
              value={address}
              placeholder="https://"
              aria-label={ui("packs.addressLabel")}
              onInput={(e) => setAddress(e.currentTarget.value)}
            />
            <button type="submit" class="primary" disabled={!address.trim() || Boolean(progress)}>
              {ui("packs.addressGo")}
            </button>
            <button type="button" onClick={() => chooseFiles(targetPack.id)}>
              {ui("packs.importAurora")}
            </button>
            <button type="button" class="link" onClick={() => setTarget(undefined)}>
              {ui("quickEdit.cancel")}
            </button>
          </form>
        </div>
      )}

      <h3>{ui("packs.add")}</h3>
      <div data-tour="aurora">
        <label class="check">
          <input
            type="checkbox"
            checked={keepEditions.value}
            onChange={(e) => {
              keepEditions.value = e.currentTarget.checked;
            }}
          />
          <span>{ui("packs.keepEditions")}</span>
        </label>
        <div class="pack-actions">
          <button type="button" class="primary" onClick={() => chooseFiles()}>
            {ui("packs.importAurora")}
          </button>
          <input
            ref={auroraInput}
            type="file"
            accept=".xml,.index,.txt,text/xml,application/xml,text/plain"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              e.currentTarget.value = "";
              if (files.length > 0) void importAuroraFiles(files, target);
              setTarget(undefined);
            }}
          />
        </div>
        <form
          class="pack-address"
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim() && !progress) {
              void importAuroraUrl(address);
              // Empty, so that the next address can be typed right away.
              setAddress("");
            }
          }}
        >
          <input
            type="url"
            value={address}
            placeholder="https://"
            aria-label={ui("packs.addressLabel")}
            onInput={(e) => setAddress(e.currentTarget.value)}
          />
          <button type="submit" class="primary" disabled={!address.trim() || Boolean(progress)}>
            {ui("packs.addressGo")}
          </button>
        </form>
      </div>
      <p class="muted">
        {ui("packs.auroraHint")}{" "}
        <a href={guidePath(language.value, "aurora")} target="_blank" rel="noopener noreferrer">
          {ui("guide.readMore")}
        </a>
      </p>
      {progress && (
        <p class="note" aria-live="polite">
          {ui("packs.progress", { done: progress.done, total: progress.total })}
        </p>
      )}
      {report && (
        <div class="note" aria-live="polite">
          {report.added > 0 ? (
            <p>{ui("packs.report", { name: report.name, n: report.added })}</p>
          ) : (
            <p>{ui("packs.reportNothing")}</p>
          )}
          {report.failed > 0 && <p>{ui("packs.reportFailed", { n: report.failed })}</p>}
          {report.truncated && <p>{ui("packs.reportTruncated")}</p>}
          {report.duplicates > 0 && <p>{ui("packs.reportDuplicates", { n: report.duplicates })}</p>}
          {report.editions > 0 && <p>{ui("packs.reportEditions", { n: report.editions })}</p>}
          {report.merged > 0 && <p>{ui("packs.reportMerged", { n: report.merged })}</p>}
          {report.unsupported > 0 && <p>{ui("packs.reportRules", { n: report.unsupported })}</p>}
          {Object.keys(report.skipped).length > 0 && (
            <p>
              {ui("packs.reportSkipped", {
                list: Object.entries(report.skipped)
                  .map(([type, n]) => `${type} ×${n}`)
                  .join(", "),
              })}
            </p>
          )}
        </div>
      )}
      {error && (
        <p class="note" role="alert">
          {error === "sameAddress"
            ? ui("packs.sameAddress", { name: sameAddressPack.value ?? "" })
            : ui(error === "exists" ? "packs.exists" : "packs.invalid")}
        </p>
      )}
    </article>
  );
}
