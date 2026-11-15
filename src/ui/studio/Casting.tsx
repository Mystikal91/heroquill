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
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { CheckBox, ManyBox, NumberBox, SelectBox } from "./Controls";
import { fieldLabel, optionLabel } from "./labels";
import { useEdit } from "./scope";

const abilityOptions = () => ABILITIES.map((id) => ({ id, label: optionLabel(id) }));

/**
 * How a class casts, in a few choices: the tables of its twenty levels follow from them, as the
 * rules give them (full, half, or Pact Magic), and are still there to be changed in the advanced mode.
 */
export function ClassCasting({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { apply } = useEdit();
  const data = entry.data as Record<string, unknown>;
  const now = readClassCasting(data);
  const write = (change: Partial<typeof now>) => {
    const next = applyClassCasting(data, { ...now, ...change });
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
        {now.kind !== "none" && (
          <>
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
            <NumberBox
              label={fieldLabel("cantrips")}
              min={0}
              max={9}
              value={now.cantrips}
              onChange={(v) => write({ cantrips: v ?? 0 })}
            />
          </>
        )}
      </div>
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
