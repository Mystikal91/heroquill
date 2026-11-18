import { signal } from "@preact/signals";
import { lastExport } from "../../app/backup";
import { showView } from "../../app/navigation";
import { content } from "../../app/store";
import { applyChange, flushStudio, selectedEntry } from "../../app/studio";
import { exportPack } from "../../app/userPacks";
import { warningsFor } from "../../homebrew/warnings";
import { ui } from "../../i18n/ui";
import { type UserPackRecord, restrictedIds } from "../../storage/packs";
import { TextBox } from "./Controls";
import { removePack, visibleEntries } from "./Explorer";
import { type TabSpec, Tabs } from "./Tabs";
import { PackLanguages } from "./Translate";
import { kindName } from "./names";

/** The tab of the pack page that is open; kept while the person goes to an entry and comes back. */
const packTab = signal("main");

/** The name, the author, the version, the description and the units: what a pack is as a book. */
function MainData({ record }: { record: UserPackRecord }) {
  const meta = record.meta ?? {};
  const setMeta = (key: "author" | "description", value: string) => {
    const { [key]: _old, ...rest } = meta;
    applyChange(
      { ...record, meta: value.trim() ? { ...rest, [key]: value } : rest },
      `pack.${key}`,
    );
  };
  return (
    <>
      <TextBox
        label={ui("hb.packName")}
        value={record.name}
        onChange={(v) => applyChange({ ...record, name: v }, "pack.name")}
      />
      <div class="studio-grid">
        <TextBox
          label={ui("studio.author")}
          value={meta.author ?? ""}
          onChange={(v) => setMeta("author", v)}
        />
        <TextBox
          label={ui("studio.version")}
          value={record.pack.manifest.version}
          onChange={(v) =>
            applyChange(
              {
                ...record,
                pack: { ...record.pack, manifest: { ...record.pack.manifest, version: v } },
              },
              "pack.version",
            )
          }
        />
      </div>
      <TextBox
        label={ui("studio.description")}
        value={meta.description ?? ""}
        area
        rows={4}
        onChange={(v) => setMeta("description", v)}
      />
      <label class="field studio-field">
        <span>{ui("studio.units")}</span>
        <select
          value={meta.units ?? ""}
          onChange={(e) => {
            const { units: _old, ...rest } = meta;
            const value = e.currentTarget.value;
            applyChange(
              {
                ...record,
                meta: value === "metric" || value === "imperial" ? { ...rest, units: value } : rest,
              },
              "pack.units",
            );
          }}
        >
          <option value="">{ui("studio.unitsAuto")}</option>
          <option value="metric">{ui("studio.unitsMetric")}</option>
          <option value="imperial">{ui("studio.unitsImperial")}</option>
        </select>
        <small class="muted">{ui("studio.unitsHint")}</small>
      </label>
    </>
  );
}

/**
 * What the pack holds and what is left to check, over the whole pack: the entries by kind, and the
 * entries that have something to look at (a click opens the entry).
 */
function PackPreview({ record }: { record: UserPackRecord }) {
  const entries = visibleEntries(record);
  const packs = content.value?.packs ?? [];
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(kindName(e), (counts.get(kindName(e)) ?? 0) + 1);
  const toCheck = entries
    .map((entry) => ({ entry, list: warningsFor(record, entry, { packs }) }))
    .filter(({ list }) => list.length > 0);
  return (
    <>
      <h4>{ui("studio.pp.contents")}</h4>
      {entries.length === 0 ? (
        <p class="muted">{ui("studio.pp.empty")}</p>
      ) : (
        <ul class="plain studio-pp-counts">
          {[...counts].sort().map(([kind, n]) => (
            <li key={kind}>
              <b>{n}</b> {kind}
            </li>
          ))}
        </ul>
      )}
      <h4>{ui("studio.pp.checks")}</h4>
      {toCheck.length === 0 ? (
        <p class="studio-ok">{ui("studio.pp.ok")}</p>
      ) : (
        <ul class="plain studio-pp-checks">
          {toCheck.map(({ entry, list }) => (
            <li key={entry.id}>
              <button
                type="button"
                class="studio-link"
                onClick={() => {
                  selectedEntry.value = entry.id;
                }}
              >
                {record.strings[`${entry.id}.name`] || ui("studio.unnamed")}
              </button>
              <span class="muted">
                {kindName(entry)} · {ui("studio.pp.things", { n: list.length })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** What can be done with the pack as a whole: print or share it, export it, remove it. */
function Tools({ record }: { record: UserPackRecord }) {
  const kept = restrictedIds(record).length;
  const copied = lastExport(record.id);
  return (
    <>
      <p class="muted">
        {copied === undefined
          ? ui("studio.backup.never")
          : ui("studio.backup.last", { date: new Date(copied).toLocaleDateString() })}
      </p>
      {kept > 0 && <p class="note">{ui("studio.restricted", { n: kept })}</p>}
      <div class="studio-actions">
        <button
          type="button"
          onClick={() => void flushStudio().then(() => showView("homebrewPrint"))}
        >
          {ui("studio.print")}
        </button>
        <button type="button" onClick={() => void flushStudio().then(() => exportPack(record))}>
          {ui("bar.export")}
        </button>
        <button type="button" class="danger" onClick={() => removePack(record)}>
          {ui("packs.remove")}
        </button>
      </div>
      <p class="muted">
        <a href="/docs/packs/" target="_blank" rel="noreferrer noopener">
          {ui("studio.packDocs")}
        </a>
      </p>
    </>
  );
}

/**
 * The page of the open pack, shown while no entry is open: in tabs, so that it is never one long
 * page. The first has what a pack is as a book; the others hold its languages, what it adds to the
 * rules, how it reads and what to check, and what can be done with it.
 */
export function PackHome({ record }: { record: UserPackRecord }) {
  const packs = content.value?.packs ?? [];
  const problems = visibleEntries(record).filter(
    (entry) => warningsFor(record, entry, { packs }).length > 0,
  ).length;
  const tabs: TabSpec[] = [
    { id: "main", label: ui("studio.tab.main"), body: () => <MainData record={record} /> },
    {
      id: "languages",
      label: ui("studio.tab.languages"),
      body: () => <PackLanguages record={record} />,
    },
    {
      id: "preview",
      label: ui("studio.tab.preview"),
      badge: problems,
      body: () => <PackPreview record={record} />,
    },
    { id: "tools", label: ui("studio.tab.tools"), body: () => <Tools record={record} /> },
  ];
  return (
    <section class="studio-editor studio-packhome">
      <Tabs
        tabs={tabs}
        current={packTab.value}
        onChange={(id) => {
          packTab.value = id;
        }}
        label={ui("studio.tab.packLabel")}
      />
      <p class="muted">{ui("studio.pickEntry")}</p>
    </section>
  );
}
