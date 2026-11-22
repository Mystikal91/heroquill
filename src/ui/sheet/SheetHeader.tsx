import { useEffect, useRef, useState } from "preact/hooks";
import { type StepId, openStep } from "../../app/buildState";
import { showView } from "../../app/navigation";
import { character, content, editionsAvailable, updateCharacter } from "../../app/store";
import { ui } from "../../i18n/ui";
import { Portrait } from "./Portrait";

/** Opens a step of the build screen, for changing what the sheet shows. */
function goTo(step: StepId) {
  openStep.value = step;
  showView("build");
}

/** A value on the sheet that takes you to where it is chosen. */
function Change({ step, what, children }: { step: StepId; what: string; children: string }) {
  return (
    <button
      type="button"
      class="change-link"
      aria-label={ui("sheet.change", { what })}
      onClick={() => goTo(step)}
    >
      {children}
    </button>
  );
}

/** The name of the character: tap it to type another, right on the sheet. */
function EditableName() {
  const ch = character.value;
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);
  if (!editing)
    return (
      <h2>
        <button
          type="button"
          class="change-link"
          aria-label={ui("sheet.change", { what: ui("sheet.name") })}
          onClick={() => setEditing(true)}
        >
          {ch.name || ui("sheet.unnamed")}
        </button>
      </h2>
    );
  return (
    <input
      ref={input}
      class="name-input"
      type="text"
      value={ch.name}
      aria-label={ui("sheet.name")}
      onInput={(e) =>
        updateCharacter((d) => {
          d.name = e.currentTarget.value;
        })
      }
      onBlur={() => setEditing(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape") setEditing(false);
      }}
    />
  );
}

/** Name banner, who the character is, and the class banner. */
export function SheetHeader() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const name = c.name;

  const first = ch.classes[0];
  const classTitle = ch.classes.map((cl) => name(cl.classId)).join(" / ") || ui("sheet.noClass");
  const totalLevel = ch.classes.reduce((sum, cl) => sum + cl.level, 0);
  const classLabel = first?.subclassId
    ? name(first.subclassId)
    : ui("sheet.levelLabel", { level: totalLevel });

  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");

  return (
    <header class="sheet-header">
      <div class="banner-name-wrap">
        <div class="banner banner-name has-portrait">
          <EditableName />
          <span class="banner-label">{ui("sheet.name")}</span>
        </div>
        <Portrait />
      </div>

      <dl class="card sheet-info">
        <div>
          <dd>
            <Change step="origin" what={ui("print.species")}>
              {species || "—"}
            </Change>
          </dd>
          <dt>{ui("print.species")}</dt>
        </div>
        <div>
          <dd>
            <Change step="background" what={ui("print.background")}>
              {ch.choices.background ? name(ch.choices.background) : "—"}
            </Change>
          </dd>
          <dt>{ui("print.background")}</dt>
        </div>
        <div>
          <dd>
            <Change step="class" what={ui("form.level")}>
              {ui("sheet.levelLabel", { level: totalLevel })}
            </Change>
          </dd>
          <dt>{ui("form.level")}</dt>
        </div>
        <div>
          <dd>
            <Change step="story" what={ui("story.alignment")}>
              {ch.story.alignment ? name(ch.story.alignment) : "—"}
            </Change>
          </dd>
          <dt>{ui("story.alignment")}</dt>
        </div>
      </dl>

      <div class="banner banner-class">
        <h2>
          <Change step="class" what={ui("form.class")}>
            {classTitle}
          </Change>
        </h2>
        <span class="banner-label">
          {classLabel}
          {/* Which rules the character follows, when the app has both editions. */}
          {editionsAvailable.value.length > 1 && (
            <>
              {" · "}
              <span title={ui("edition.label")}>{ui(`edition.${ch.ruleset}.name`)}</span>
            </>
          )}
        </span>
      </div>
    </header>
  );
}
