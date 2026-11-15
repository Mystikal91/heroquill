import { showView } from "../../app/navigation";
import { applyChange, flushStudio } from "../../app/studio";
import { exportPack } from "../../app/userPacks";
import { ui } from "../../i18n/ui";
import { type UserPackRecord, restrictedIds } from "../../storage/packs";
import { TextBox } from "./Controls";
import { removePack } from "./Explorer";

/**
 * The page of the open pack, shown while no entry is open: its name, who wrote it, its version and
 * description (a pack is a book), and what can be done with the pack as a whole.
 */
export function PackHome({ record }: { record: UserPackRecord }) {
  const meta = record.meta ?? {};
  const setMeta = (key: "author" | "description", value: string) => {
    const { [key]: _old, ...rest } = meta;
    applyChange(
      { ...record, meta: value.trim() ? { ...rest, [key]: value } : rest },
      `pack.${key}`,
    );
  };
  const kept = restrictedIds(record).length;
  return (
    <section class="studio-editor studio-packhome">
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
      <p class="muted">{ui("studio.pickEntry")}</p>
    </section>
  );
}
