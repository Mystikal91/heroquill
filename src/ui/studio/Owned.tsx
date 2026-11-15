import { applyChange } from "../../app/studio";
import type { Entry } from "../../data/schema";
import {
  addOwned,
  levelOf,
  moveFeature,
  ownedOfKind,
  removeOwned,
  setText,
  updateEntry,
} from "../../homebrew/entries";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { NumberBox, TextBox } from "./Controls";
import { EffectList } from "./Effects";

/**
 * The traits of a species or the features of a class, written inside their owner: each has a name, a
 * text and effects of its own, and a feature has the level it comes at.
 */
export function OwnedList({
  record,
  owner,
  kind,
}: {
  record: UserPackRecord;
  owner: Entry;
  kind: "trait" | "feature";
}) {
  const items = ownedOfKind(record, owner.id, kind);
  const title = ui(kind === "trait" ? "studio.traits" : "studio.features");
  const text = (e: Entry, field: string) => record.strings[`${e.id}.${field}`] ?? "";

  return (
    <section class="studio-owned">
      <h4>{title}</h4>
      {items.map((e) => (
        <details class="studio-owned-item" key={e.id} open>
          <summary>
            <b>{text(e, "name") || ui("studio.unnamed")}</b>
            {kind === "feature" && (
              <span class="muted">
                {ui("hb.f.featureLevel")} {levelOf(owner, e.id) ?? "?"}
              </span>
            )}
          </summary>
          <div class="studio-grid">
            <TextBox
              label={ui("hb.f.name")}
              value={text(e, "name")}
              onChange={(v) => applyChange(setText(record, e.id, "name", v), `${e.id}.name`)}
            />
            {kind === "feature" && (
              <NumberBox
                label={ui("hb.f.featureLevel")}
                min={1}
                max={20}
                value={levelOf(owner, e.id)}
                onChange={(v) =>
                  v !== undefined &&
                  applyChange(moveFeature(record, owner.id, e.id, v), `${e.id}.level`)
                }
              />
            )}
          </div>
          <TextBox
            label={ui("hb.f.desc")}
            value={text(e, "desc")}
            area
            rows={4}
            onChange={(v) => applyChange(setText(record, e.id, "desc", v), `${e.id}.desc`)}
          />
          <EffectList
            effects={e.effects}
            onChange={(effects) =>
              applyChange(updateEntry(record, e.id, { effects }), `${e.id}.effects`)
            }
          />
          <button
            type="button"
            class="danger"
            onClick={() => applyChange(removeOwned(record, owner.id, e.id))}
          >
            {ui("form.remove")}
          </button>
        </details>
      ))}
      <button
        type="button"
        onClick={() => {
          // A new feature comes at the level after the last one that has a feature.
          const last =
            items.length > 0 ? (levelOf(owner, items[items.length - 1]?.id ?? "") ?? 1) : 1;
          applyChange(addOwned(record, owner.id, kind, { level: last }).record);
        }}
      >
        {ui(kind === "trait" ? "studio.addTrait" : "studio.addFeature")}
      </button>
    </section>
  );
}
