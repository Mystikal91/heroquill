import type { ComponentChildren } from "preact";
import { type StepId, levelUpPhase, openStep } from "../../app/buildState";
import { showView } from "../../app/navigation";
import { character, content, sheet } from "../../app/store";
import { countOverrides } from "../../engine/overrides";
import { classesNeedingSubclass } from "../../engine/subclass";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { AbilityScores } from "../AbilityScores";
import { Choices } from "../Choices";
import { SpellPicker } from "../SpellPicker";
import { Welcome } from "../Welcome";
import { type ChoiceOrigin, choiceOrigin } from "../choiceOrigin";
import { ClassStep } from "./ClassStep";
import { FeaturesStep } from "./FeaturesStep";
import { FreeEditStep } from "./FreeEditStep";
import { StoryStep } from "./StoryStep";
import { EquipmentStep, OriginStep } from "./steps";

interface StepInfo {
  id: StepId;
  title: UiKey;
  /** Short state shown next to the title, e.g. "Wizard 5" or "2 left". */
  status: string;
  /** True when there is nothing left to do in this step. */
  done: boolean;
  /** A step nobody has to do: it has no check mark, and says so until something is in it. */
  optional?: boolean;
  body: ComponentChildren;
}

function buildSteps(): StepInfo[] {
  const ch = character.value;
  const s = sheet.value;
  const c = content.value;
  const name = (id: string | undefined) => (id && c ? c.name(id) : "");

  const first = ch.classes[0];
  const needsSubclass = c ? classesNeedingSubclass(ch, c.index).length > 0 : false;
  const pendingChoices = s?.choices.reduce((sum, choice) => sum + choice.remaining, 0) ?? 0;
  // The choices a step asks on the spot count for that step too.
  const pendingOf = (origins: ChoiceOrigin[]) =>
    s && c
      ? s.choices
          .filter((choice) => origins.includes(choiceOrigin(c.index, choice.source)))
          .reduce((sum, choice) => sum + choice.remaining, 0)
      : 0;
  const originLeft = pendingOf(["species", "background"]);
  const classLeft = pendingOf(["class"]);
  const asiLeft = s ? s.asi.available - s.asi.used : 0;
  const spellsLeft = (s?.spellcasters ?? []).reduce(
    (total, caster) =>
      total +
      [caster.lists.cantrips, caster.lists.known, caster.lists.prepared].reduce(
        (sum, pick) => sum + (pick ? Math.max(0, pick.allowed - pick.chosen.length) : 0),
        0,
      ),
    0,
  );

  const steps: StepInfo[] = [
    {
      id: "origin",
      title: "build.origin",
      status: [
        name(ch.choices.species),
        name(ch.choices.background),
        originLeft > 0 ? ui("build.left", { n: originLeft }) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      done: Boolean(ch.choices.species && ch.choices.background) && originLeft === 0,
      body: <OriginStep />,
    },
    {
      id: "class",
      title: "build.class",
      status: [
        ch.classes.map((cl) => `${name(cl.classId)} ${cl.level}`).join(" / "),
        needsSubclass ? ui("build.needsSubclass") : "",
        classLeft > 0 ? ui("build.left", { n: classLeft }) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      done: Boolean(first) && !needsSubclass && classLeft === 0,
      body: <ClassStep />,
    },
    {
      id: "abilities",
      title: "build.abilities",
      status:
        asiLeft > 0
          ? ui("build.left", { n: asiLeft })
          : ui(`abilities.method.${ch.abilityMethod}` as UiKey),
      done: asiLeft === 0,
      body: <AbilityScores />,
    },
    {
      id: "choices",
      title: "build.choices",
      status: pendingChoices > 0 ? ui("build.left", { n: pendingChoices }) : "",
      done: pendingChoices === 0,
      body: <Choices />,
    },
  ];
  if (s && s.spellcasters.length > 0) {
    steps.push({
      id: "spells",
      title: "build.spells",
      status: spellsLeft > 0 ? ui("build.left", { n: spellsLeft }) : "",
      done: spellsLeft === 0,
      body: <SpellPicker />,
    });
  }
  steps.push({
    id: "equipment",
    title: "build.equipment",
    status: ch.inventory.length > 0 ? String(ch.inventory.length) : "",
    // Done once the character carries something: an empty pack is still a step to take.
    done: ch.inventory.length > 0,
    body: <EquipmentStep />,
  });
  const story = ch.story;
  const written = [story.personalityTraits, story.ideals, story.bonds, story.flaws].filter(
    (text) => text.trim() !== "",
  ).length;
  steps.push({
    id: "story",
    title: "build.story",
    status: written > 0 ? `${written}/4` : "",
    done: written === 4,
    body: <StoryStep />,
  });
  const customCount = ch.custom?.length ?? 0;
  steps.push({
    id: "features",
    title: "build.features",
    status: customCount > 0 ? String(customCount) : ui("build.optional"),
    done: false,
    optional: true,
    body: <FeaturesStep />,
  });
  const forcedCount = countOverrides(ch.overrides);
  steps.push({
    id: "freeEdit",
    title: "build.freeEdit",
    status: forcedCount > 0 ? ui("freeEdit.count", { n: forcedCount }) : ui("build.optional"),
    done: false,
    optional: true,
    body: <FreeEditStep />,
  });
  return steps;
}

/** The summary beside the steps: the numbers that change as choices are made. */
function Summary() {
  const s = sheet.value;
  const ch = character.value;
  const c = content.value;
  if (!s || !c) return null;
  const classes = ch.classes.map((cl) => `${c.name(cl.classId)} ${cl.level}`).join(" / ");

  return (
    <aside class="card summary">
      <h3>{ui("build.summary")}</h3>
      <p class="summary-name">{ch.name || ui("sheet.unnamed")}</p>
      <p class="muted">
        {[c.name(ch.choices.species ?? ""), classes].filter(Boolean).join(" · ") || "—"}
      </p>
      <div class="summary-stats">
        <div>
          <b>{s.armorClass.value}</b>
          <span>{ui("sheet.armorClass")}</span>
        </div>
        <div>
          <b>{s.hitPoints.max}</b>
          <span>{ui("sheet.hitPoints")}</span>
        </div>
        <div>
          <b>{signed(s.initiative)}</b>
          <span>{ui("sheet.initiative")}</span>
        </div>
      </div>
      <ul class="summary-abilities">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
          <li key={a}>
            <span>{c.text(`${ch.ruleset}:ability/${a}`, "abbreviation")}</span>
            <b>{s.abilities[a].score}</b>
            <small>{signed(s.abilities[a].modifier)}</small>
          </li>
        ))}
      </ul>
      {ch.classes.length > 0 && (
        <button
          type="button"
          class="level-up-button"
          onClick={() => {
            levelUpPhase.value = "choose";
          }}
        >
          <span aria-hidden="true">{"✦ "}</span>
          {ui("levelUp.button")}
        </button>
      )}
      <button type="button" class="secondary" onClick={() => showView("sheet")}>
        {ui("build.viewSheet")}
      </button>
    </aside>
  );
}

/** The same numbers as the summary, in a strip at the top: on a phone the summary is far below. */
function SummaryStrip() {
  const s = sheet.value;
  const ch = character.value;
  const c = content.value;
  if (!s || !c) return null;
  return (
    <section class="card summary-strip" aria-label={ui("build.summary")}>
      <div class="summary-stats">
        <div>
          <b>{s.armorClass.value}</b>
          <span>{ui("sheet.armorClass")}</span>
        </div>
        <div>
          <b>{s.hitPoints.max}</b>
          <span>{ui("sheet.hitPoints")}</span>
        </div>
        <div>
          <b>{signed(s.initiative)}</b>
          <span>{ui("sheet.initiative")}</span>
        </div>
      </div>
      <ul class="summary-abilities">
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
          <li key={a}>
            <span>{c.text(`${ch.ruleset}:ability/${a}`, "abbreviation")}</span>
            <b>{s.abilities[a].score}</b>
            <small>{signed(s.abilities[a].modifier)}</small>
          </li>
        ))}
      </ul>
      {ch.classes.length > 0 && (
        <button
          type="button"
          class="level-up-button"
          onClick={() => {
            levelUpPhase.value = "choose";
          }}
        >
          <span aria-hidden="true">{"✦ "}</span>
          {ui("levelUp.button")}
        </button>
      )}
    </section>
  );
}

/** Brings the header of a step into view once it is open, as the steps above it have closed. */
function showStep(id: StepId) {
  requestAnimationFrame(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .getElementById(`step-head-${id}`)
      ?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  });
}

/** Guided building: a list of steps that open one at a time, with a live summary. */
export function BuildTab() {
  const steps = buildSteps();
  const open = openStep.value;
  const index = steps.findIndex((step) => step.id === open);
  // A step that is not in the list (the spells of a class that does not cast) opens the first.
  const current = open === undefined ? -1 : index === -1 ? 0 : index;

  const choose = (id: StepId | undefined) => {
    openStep.value = id;
    if (id) showStep(id);
  };
  const next = (from: number) => {
    const following = steps[from + 1];
    if (following) choose(following.id);
    else showView("sheet");
  };

  return (
    <>
      <Welcome />
      <SummaryStrip />
      <div class="build">
        <div class="steps">
          {steps.map((step, i) => {
            const isOpen = i === current;
            return (
              <section
                class={`card step${isOpen ? " open" : ""}`}
                key={step.id}
                id={`step-head-${step.id}`}
              >
                <h3 class="step-title">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={`step-${step.id}`}
                    onClick={() => choose(isOpen ? undefined : step.id)}
                  >
                    <span
                      class={`step-mark${step.done ? " done" : ""}${step.optional ? " optional" : ""}`}
                      aria-hidden="true"
                    >
                      {step.done ? "✓" : step.optional ? "+" : i + 1}
                    </span>
                    <span class="step-name">{ui(step.title)}</span>
                    {step.status && <span class="step-status">{step.status}</span>}
                    <span class="step-chevron" aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && (
                  <div class="step-body" id={`step-${step.id}`}>
                    {step.body}
                    <button type="button" class="secondary step-next" onClick={() => next(i)}>
                      {i === steps.length - 1 ? ui("build.viewSheet") : ui("build.continue")}
                    </button>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <Summary />
      </div>
    </>
  );
}
