import { character, content, sheet, updateCharacter } from "../../app/store";
import { MAX_LEVEL } from "../../engine/levelUp";
import { subclassLevel } from "../../engine/subclass";
import { ui } from "../../i18n/ui";
import { Choices } from "../Choices";
import { ClassInfo } from "./EntryInfo";
import { Select, entriesOfKind, parseWhole } from "./fields";

/** The classes of the character: level and subclass of each, and a way to add another. */
export function ClassStep() {
  const classes = character.value.classes;
  const total = classes.reduce((sum, cl) => sum + cl.level, 0);
  const taken = new Set(classes.map((cl) => cl.classId));
  const available = entriesOfKind("class").filter((o) => !taken.has(o.id));
  const warnings = (sheet.value?.warnings ?? []).filter((w) => w.code === "multiclassPrerequisite");
  const index = content.value?.index;
  const subclassAt = (classId: string) => (index ? subclassLevel(classId, index) : undefined);

  return (
    <>
      {classes.length === 0 && (
        <div class="step-split">
          <div class="step-fields">
            <Select
              label={ui("form.class")}
              value={undefined}
              options={entriesOfKind("class")}
              onChange={(id) =>
                updateCharacter((d) => {
                  d.classes = id ? [{ classId: id, level: 1 }] : [];
                })
              }
            />
          </div>
          <div class="step-info">
            <p class="muted">{ui("build.info.pickClass")}</p>
          </div>
        </div>
      )}

      {classes.map((cl, i) => (
        <fieldset class="class-row" key={cl.classId}>
          {i > 0 && <legend>{ui("class.another")}</legend>}
          <div class="step-split">
            <div class="step-fields">
              <Select
                label={ui("form.class")}
                value={cl.classId}
                options={entriesOfKind("class").filter(
                  (o) => o.id === cl.classId || !taken.has(o.id),
                )}
                onChange={(id) =>
                  updateCharacter((d) => {
                    const row = d.classes[i];
                    if (!row) return;
                    if (!id) {
                      if (i > 0) d.classes.splice(i, 1);
                      return;
                    }
                    if (id !== row.classId) {
                      row.classId = id;
                      row.subclassId = undefined;
                      row.hpRolls = undefined;
                    }
                  })
                }
              />
              <label class="field">
                <span>{ui("form.level")}</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_LEVEL - (total - cl.level)}
                  value={cl.level}
                  onInput={(e) => {
                    const others = total - cl.level;
                    const level = Math.min(
                      MAX_LEVEL - others,
                      Math.max(1, parseWhole(e.currentTarget.value, 1)),
                    );
                    updateCharacter((d) => {
                      const row = d.classes[i];
                      if (row) row.level = level;
                    });
                  }}
                />
              </label>
              {/* Before the level of the choice there is nothing to choose: say when it comes. */}
              {!cl.subclassId && cl.level < (subclassAt(cl.classId) ?? 0) && (
                <p class="muted subclass-later">
                  {ui("class.subclassAt", { level: subclassAt(cl.classId) ?? 0 })}
                </p>
              )}
              {entriesOfKind("subclass", cl.classId).length > 0 &&
                (cl.subclassId || cl.level >= (subclassAt(cl.classId) ?? 0)) && (
                  <Select
                    label={ui("form.subclass")}
                    value={cl.subclassId}
                    options={entriesOfKind("subclass", cl.classId)}
                    onChange={(id) =>
                      updateCharacter((d) => {
                        const row = d.classes[i];
                        if (row) row.subclassId = id;
                      })
                    }
                  />
                )}
              {i > 0 && (
                <button
                  type="button"
                  class="link"
                  onClick={() =>
                    updateCharacter((d) => {
                      d.classes.splice(i, 1);
                    })
                  }
                >
                  {ui("class.remove")}
                </button>
              )}
            </div>
            <div class="step-info">
              <ClassInfo classId={cl.classId} subclassId={cl.subclassId} first={i === 0} />
            </div>
          </div>
        </fieldset>
      ))}

      {classes.length > 0 && (
        <>
          {/* What the classes ask to choose (skills, a fighting style, weapon masteries). */}
          <Choices only="class" />
          <p class="muted">{ui("class.total", { level: total })}</p>
          {available.length > 0 && total < MAX_LEVEL && (
            <label class="field">
              <span>{ui("class.add")}</span>
              <select
                value=""
                onChange={(e) => {
                  const classId = e.currentTarget.value;
                  if (!classId) return;
                  updateCharacter((d) => {
                    d.classes.push({ classId, level: 1 });
                  });
                }}
              >
                <option value="">{ui("form.none")}</option>
                {available.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <small class="muted">{ui("class.addHint")}</small>
            </label>
          )}
          {warnings.length > 0 && (
            <ul class="warnings">
              {warnings.map((w) => (
                <li key={`${w.params.class}-${w.params.ability}`}>
                  {ui("class.needs", {
                    class: content.value?.name(String(w.params.class)) ?? "",
                    ability:
                      content.value?.text(
                        `${character.value.ruleset}:ability/${w.params.ability}`,
                        "abbreviation",
                      ) ?? String(w.params.ability),
                    minimum: Number(w.params.minimum),
                  })}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
