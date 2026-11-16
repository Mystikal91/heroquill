import { studioLanguage } from "../../app/studio";
import type { Entry } from "../../data/schema";
import { ABILITIES } from "../../data/schema";
import {
  CASTING_KINDS,
  PREPARATION_KINDS,
  type Preparation,
  applyClassCasting,
  applySubclassCasting,
  readClassCasting,
  readSubclassCasting,
} from "../../homebrew/casting";
import { updateEntry } from "../../homebrew/entries";
import { levelRows, valueColumns } from "../../homebrew/levelTables";
import { ownReserves, reserveLabel } from "../../homebrew/reserves";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { CheckBox, ManyBox, NumberBox, SelectBox } from "./Controls";
import { columnLabel } from "./LevelTables";
import { fieldLabel, optionLabel } from "./labels";
import { useEdit, usePack } from "./scope";

const abilityOptions = () => ABILITIES.map((id) => ({ id, label: optionLabel(id) }));

/**
 * How a class casts, in a few choices: the tables of its twenty levels follow from them, as the
 * rules give them (full, half, or Pact Magic), and are still there to be changed in the advanced mode.
 */
export function ClassCasting({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { apply } = useEdit();
  const pack = usePack();
  const language = studioLanguage.value ?? pack?.lang ?? "en";
  const data = entry.data as Record<string, unknown>;
  const now = readClassCasting(data);
  // The columns of this class's own table of values: what the level cap and the limit can follow.
  const columns = valueColumns(levelRows(data)).map((id) => ({ id, label: columnLabel(id) }));
  const write = (change: Partial<typeof now>) => {
    // A class that starts to cast begins with two cantrips; the table below has them level by level.
    const start = now.kind === "none" && change.kind !== undefined && change.kind !== "none";
    const next = applyClassCasting(data, {
      ...now,
      ...(start && now.cantrips === 0 && { cantrips: 2 }),
      ...change,
    });
    apply(
      updateEntry(record, entry.id, {
        data: { spellcasting: next.spellcasting, levels: next.levels },
      }),
      `${entry.id}.casting`,
    );
  };
  return (
    <fieldset class="studio-many">
      <legend>{fieldLabel("spellcasting")}</legend>
      <div class="studio-grid">
        <SelectBox
          label={fieldLabel("casting")}
          value={now.kind}
          options={CASTING_KINDS.map((id) => ({ id, label: optionLabel(id) }))}
          onChange={(v) => write({ kind: (v ?? "none") as typeof now.kind })}
        />
      </div>
      {now.kind !== "none" && (
        // What the choice means, right under it.
        <p class="studio-callout">{ui(`studio.castKind.${now.kind}` as const)}</p>
      )}
      {now.kind !== "none" && (
        <div class="studio-grid">
          <SelectBox
            label={fieldLabel("castAbility")}
            value={now.ability}
            options={abilityOptions()}
            onChange={(v) => write({ ability: v ?? "int" })}
          />
          <SelectBox
            label={fieldLabel("preparation")}
            value={now.preparation}
            options={PREPARATION_KINDS.map((id) => ({ id, label: optionLabel(id) }))}
            onChange={(v) => write({ preparation: (v ?? "prepared") as Preparation })}
          />
        </div>
      )}
      {now.kind === "points" && (
        <div class="studio-subgroup">
          <h5>{ui("studio.pointsPays")}</h5>
          <div class="studio-grid studio-grid-one">
            <SelectBox
              label={ui("studio.pointsReserve")}
              value={now.reserve || undefined}
              options={ownReserves(pack ?? ({} as UserPackRecord)).map((id) => ({
                id,
                label: pack ? reserveLabel(pack, id, language) : id,
              }))}
              blank={ui("form.none")}
              onChange={(v) => write({ reserve: v ?? "" })}
            />
            <SelectBox
              label={ui("studio.pointsMaxLevel")}
              value={now.maxLevel ?? "half"}
              options={[{ id: "half", label: ui("studio.pointsMaxHalf") }, ...columns]}
              onChange={(v) => write({ maxLevel: v ?? "half" })}
            />
            <SelectBox
              label={ui("studio.pointsLimit")}
              value={now.limit || undefined}
              options={columns}
              blank={ui("studio.pointsNoLimit")}
              onChange={(v) => write({ limit: v ?? "" })}
            />
          </div>
          {(pack ? ownReserves(pack).length === 0 : true) && (
            <p class="studio-callout warn">{ui("studio.pointsNoReserve")}</p>
          )}
          {columns.length === 0 && (
            <p class="studio-callout warn">{ui("studio.pointsNoColumns")}</p>
          )}
        </div>
      )}
      {now.kind !== "none" && <p class="muted">{ui("hb.classSpellsHint")}</p>}
    </fieldset>
  );
}

/** A subclass that gives a class spellcasting of its own, as the Eldritch Knight does. */
export function SubclassCasting({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { apply } = useEdit();
  const data = entry.data as Record<string, unknown>;
  const now = readSubclassCasting(data);
  const write = (change: Partial<typeof now>) => {
    const next = applySubclassCasting(data, { ...now, ...change });
    apply(
      updateEntry(record, entry.id, {
        data: { spellcasting: next.spellcasting, levels: next.levels },
      }),
      `${entry.id}.casting`,
    );
  };
  return (
    <fieldset class="studio-many">
      <legend>{fieldLabel("spellcasting")}</legend>
      <CheckBox
        label={ui("hb.o.third")}
        checked={now.enabled}
        onChange={(on) => write({ enabled: on })}
      />
      {now.enabled && (
        <>
          <div class="studio-grid">
            <SelectBox
              label={fieldLabel("castAbility")}
              value={now.ability}
              options={abilityOptions()}
              onChange={(v) => write({ ability: v ?? "int" })}
            />
            <SelectBox
              label={fieldLabel("castList")}
              value={now.list}
              options={entriesOfKind("class")}
              onChange={(v) => write({ list: v ?? "srd51:class/wizard" })}
            />
            <NumberBox
              label={ui("hb.f.cantripsThird")}
              min={0}
              max={9}
              value={now.cantrips}
              onChange={(v) => write({ cantrips: v ?? 0 })}
            />
          </div>
          <p class="muted">{ui("hb.castSchoolsHint")}</p>
          <ManyBox
            label={fieldLabel("castSchools")}
            value={now.schools}
            options={entriesOfKind("school").map((e) => ({
              id: e.id.split("/")[1] ?? e.id,
              label: e.label,
            }))}
            onChange={(v) => write({ schools: v })}
          />
        </>
      )}
    </fieldset>
  );
}
