import { useEffect, useRef, useState } from "preact/hooks";
import { type StepId, openStep } from "../../app/buildState";
import { showView } from "../../app/navigation";
import { character, content, editionsAvailable, updateCharacter } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { classColor } from "../classColor";
import { KeyNumbers } from "./CoreStats";
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

/** The band in the colour of the class: portrait, name, who the character is, the key numbers. */
export function SheetHeader() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const name = c.name;

  const classes = ch.classes
    .map((cl) => {
      const sub = cl.subclassId ? ` (${name(cl.subclassId)})` : "";
      return `${name(cl.classId)} ${cl.level}${sub}`;
    })
    .join(" / ");
  const species = [ch.choices.species, ch.choices.subspecies]
    .filter((id): id is string => Boolean(id))
    .map(name)
    .join(", ");
  const facts: [StepId, UiKey, string][] = [
    ["origin", "print.species", species],
    ["class", "form.class", classes || ui("sheet.noClass")],
    ["background", "print.background", ch.choices.background ? name(ch.choices.background) : ""],
    ["story", "story.alignment", ch.story.alignment ? name(ch.story.alignment) : ""],
  ];

  return (
    <header
      class="card sheet-header"
      style={{ "--cls": classColor(ch.classes[0]?.classId) ?? "#4a5468" }}
    >
      <div class="hero-band">
        <Portrait />
        <div class="hero-who">
          <EditableName />
          <ul class="hero-facts plain">
            {facts.map(([step, label, value]) => (
              <li key={step}>
                <Change step={step} what={ui(label)}>
                  {value || `${ui(label)}: —`}
                </Change>
              </li>
            ))}
            {/* Which rules the character follows, when the app has both editions. */}
            {editionsAvailable.value.length > 1 && (
              <li title={ui("edition.label")}>{ui(`edition.${ch.ruleset}.name`)}</li>
            )}
          </ul>
        </div>
        <KeyNumbers />
      </div>
    </header>
  );
}
