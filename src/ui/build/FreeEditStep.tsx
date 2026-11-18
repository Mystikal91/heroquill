import { calculated, character, content, sheet, updateCharacter } from "../../app/store";
import { offerUndo } from "../../app/undo";
import { ABILITIES } from "../../data/schema";
import {
  OVERRIDE,
  type Overrides,
  countOverrides,
  numberOverride,
  withOverride,
} from "../../engine/overrides";
import { ui } from "../../i18n/ui";
import { HandDefenses } from "./HandDefenses";
import { parseWhole } from "./fields";

/** One number the player may force: empty means automatic, and the calculated value is shown. */
function ForcedNumber({
  label,
  overrideKey,
  calculatedValue,
}: {
  label: string;
  overrideKey: string;
  calculatedValue: number | undefined;
}) {
  const forced = numberOverride(character.value.overrides, overrideKey);
  const set = (value: number | undefined) =>
    updateCharacter((d) => {
      d.overrides = withOverride(d.overrides, overrideKey, value);
    });

  return (
    <div class={`forced-field${forced !== undefined ? " on" : ""}`}>
      <label class="field">
        <span>{label}</span>
        <input
          type="number"
          inputMode="numeric"
          value={forced ?? ""}
          placeholder={calculatedValue === undefined ? "" : String(calculatedValue)}
          onInput={(e) => {
            const text = e.currentTarget.value.trim();
            set(text === "" ? undefined : parseWhole(text, calculatedValue ?? 0));
          }}
        />
      </label>
      <small class="muted">
        {ui("freeEdit.calculated", {
          value: calculatedValue === undefined ? "—" : calculatedValue,
        })}
      </small>
      {forced !== undefined && (
        <button type="button" class="link" onClick={() => set(undefined)}>
          {ui("freeEdit.reset")}
        </button>
      )}
    </div>
  );
}

/** Forces any calculated number of the sheet: combat values, abilities, saves, skills, spells. */
export function FreeEditStep() {
  const c = content.value;
  const base = calculated.value;
  const live = sheet.value;
  const ch = character.value;
  if (!c || !base || !live) return null;
  const ruleset = ch.ruleset;
  const skills = [...base.skills].sort((a, b) => c.name(a.id).localeCompare(c.name(b.id)));
  const forcedCount = countOverrides(ch.overrides);

  return (
    <>
      <p class="muted">{ui("freeEdit.intro")}</p>

      <fieldset>
        <legend>{ui("freeEdit.combat")}</legend>
        <div class="forced-grid">
          <ForcedNumber
            label={ui("sheet.armorClass")}
            overrideKey={OVERRIDE.armorClass}
            calculatedValue={base.armorClass.value}
          />
          <ForcedNumber
            label={ui("freeEdit.maxHp")}
            overrideKey={OVERRIDE.hitPoints}
            calculatedValue={base.hitPoints.max}
          />
          <ForcedNumber
            label={ui("sheet.speed")}
            overrideKey={OVERRIDE.speed}
            calculatedValue={base.speed}
          />
          <ForcedNumber
            label={ui("sheet.initiative")}
            overrideKey={OVERRIDE.initiative}
            calculatedValue={base.initiative}
          />
          <ForcedNumber
            label={ui("sheet.proficiencyBonus")}
            overrideKey={OVERRIDE.proficiencyBonus}
            calculatedValue={base.proficiencyBonus}
          />
          <ForcedNumber
            label={ui("play.martialDc")}
            overrideKey={OVERRIDE.martialSaveDc}
            calculatedValue={base.martialSaveDc}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend>{ui("freeEdit.abilities")}</legend>
        <div class="forced-grid">
          {ABILITIES.map((a) => (
            <ForcedNumber
              key={a}
              label={c.name(`${ruleset}:ability/${a}`)}
              overrideKey={OVERRIDE.ability(a)}
              calculatedValue={base.abilities[a].score}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{ui("freeEdit.saves")}</legend>
        <div class="forced-grid">
          {ABILITIES.map((a) => (
            <ForcedNumber
              key={a}
              label={c.name(`${ruleset}:ability/${a}`)}
              overrideKey={OVERRIDE.save(a)}
              calculatedValue={base.saves[a].bonus}
            />
          ))}
        </div>
      </fieldset>

      <details class="forced-skills">
        <summary>{ui("freeEdit.skills")}</summary>
        <div class="forced-grid">
          {skills.map((sk) => (
            <ForcedNumber
              key={sk.id}
              label={c.name(sk.id)}
              overrideKey={OVERRIDE.skill(sk.id.split("/")[1] ?? "")}
              calculatedValue={sk.bonus}
            />
          ))}
        </div>
      </details>

      {base.spellcasting && (
        <fieldset>
          <legend>{ui("freeEdit.spellcasting")}</legend>
          <div class="forced-grid">
            <ForcedNumber
              label={ui("sheet.spellSaveDc")}
              overrideKey={OVERRIDE.spellSaveDc}
              calculatedValue={base.spellcasting.saveDc}
            />
            <ForcedNumber
              label={ui("sheet.spellAttack")}
              overrideKey={OVERRIDE.spellAttack}
              calculatedValue={base.spellcasting.attackBonus}
            />
          </div>
        </fieldset>
      )}

      <HandDefenses />

      {forcedCount > 0 && (
        <button
          type="button"
          class="secondary"
          onClick={() => {
            const before = structuredClone(character.value.overrides);
            offerUndo(ui("undo.overridesReset"), () =>
              updateCharacter((d) => {
                d.overrides = before;
              }),
            );
            updateCharacter((d) => {
              d.overrides = Object.fromEntries(
                Object.entries(d.overrides).filter(([, v]) => typeof v !== "number"),
              ) as Overrides;
            });
          }}
        >
          {ui("freeEdit.resetAll")} ({forcedCount})
        </button>
      )}
    </>
  );
}
