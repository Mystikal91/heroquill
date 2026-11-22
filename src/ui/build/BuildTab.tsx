import type { ComponentChildren } from "preact";
import { useEffect } from "preact/hooks";
import { type StepId, levelUpPhase, openStep } from "../../app/buildState";
import { showView } from "../../app/navigation";
import { character, content, sheet } from "../../app/store";
import {
  assignAbilitiesForMe,
  classPriority,
  fillChoicesForMe,
  fillSpellsForMe,
  fillableCount,
  spellsLeft,
} from "../../app/suggestions";
import type { PendingChoice } from "../../engine/choices";
import { countOverrides } from "../../engine/overrides";
import { classesNeedingSubclass } from "../../engine/subclass";
import { type UiKey, signed, ui } from "../../i18n/ui";
import { AbilityScores } from "../AbilityScores";
import { Choices } from "../Choices";
import { SpellPicker } from "../SpellPicker";
import { Welcome } from "../Welcome";
import { type ChoiceOrigin, characterOrigins, choiceOrigin } from "../choiceOrigin";
import { classColor } from "../classColor";
import { ClassStep } from "./ClassStep";
import { FeaturesStep } from "./FeaturesStep";
import { FreeEditStep } from "./FreeEditStep";
import { StoryStep } from "./StoryStep";
import { BackgroundStep, EquipmentStep, SpeciesStep } from "./steps";

interface StepInfo {
  id: StepId;
  title: UiKey;
  /** A sign for the step: its number among the basics, an icon among the rest. */
  icon: string;
  /** Short state shown next to the title, e.g. "Wizard 5" or "2 left". */
  status: string;
  /** True when there is nothing left to do in this step. */
  done: boolean;
  /** One or two lines that say what the step is for. */
  hint: string;
  body: ComponentChildren;
}

const ABILITY_ORDER = ["str", "dex", "con", "int", "wis", "cha"] as const;

/** The choices that come from these origins (the species, the class...), for a "Choose for me" of one step. */
function fromOrigins(origins: ChoiceOrigin[]) {
  const c = content.value;
  const ch = character.value;
  if (!c) return () => false;
  const owners = characterOrigins(c.index, ch);
  return (choice: PendingChoice) => origins.includes(choiceOrigin(c.index, choice.source, owners));
}

/** "Choose for me" for the open choices of a step, when there is something it can fill. */
function FillChoices({ origins }: { origins?: ChoiceOrigin[] }) {
  const only = origins ? fromOrigins(origins) : undefined;
  const n = fillableCount(only);
  if (n === 0) return null;
  return (
    <div class="bld-assist">
      <button type="button" class="bld-assist-btn" onClick={() => fillChoicesForMe(only)}>
        ✦ {ui("build.chooseForMe")}
      </button>
      <span class="muted">{ui("build.chooseForMeHint", { n })}</span>
    </div>
  );
}

/** "Assign for me" over the ability scores: the class's order with the values of the method. */
function AssignAbilities() {
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const order = classPriority();
  const names = order.slice(0, 2).map((a) => c.name(`${ch.ruleset}:ability/${a}`));
  return (
    <div class="bld-assist">
      <button type="button" class="bld-assist-btn" onClick={assignAbilitiesForMe}>
        ✦ {ui("build.assign")}
      </button>
      <span class="muted">
        {ch.abilityMethod === "manual"
          ? ui("build.assignHintManual", { first: names[0] ?? "", second: names[1] ?? "" })
          : ui("build.assignHint", { first: names[0] ?? "", second: names[1] ?? "" })}
      </span>
    </div>
  );
}

/** "Choose for me" for the spells, while some list is not full. */
function FillSpells() {
  const n = spellsLeft();
  if (n === 0) return null;
  return (
    <div class="bld-assist">
      <button type="button" class="bld-assist-btn" onClick={fillSpellsForMe}>
        ✦ {ui("build.chooseForMe")}
      </button>
      <span class="muted">{ui("build.spellsForMeHint", { n })}</span>
    </div>
  );
}

/** The steps: the four basics, after which the sheet can be played, and what can be refined at any time. */
function buildPlan(): { basics: StepInfo[]; refine: StepInfo[] } {
  const ch = character.value;
  const s = sheet.value;
  const c = content.value;
  const name = (id: string | undefined) => (id && c ? c.name(id) : "");

  const first = ch.classes[0];
  const needsSubclass = c ? classesNeedingSubclass(ch, c.index).length > 0 : false;
  const owners = c ? characterOrigins(c.index, ch) : undefined;
  const pendingOf = (origins: ChoiceOrigin[]) =>
    s && c
      ? s.choices
          .filter((choice) => origins.includes(choiceOrigin(c.index, choice.source, owners)))
          .reduce((sum, choice) => sum + choice.remaining, 0)
      : 0;
  const speciesLeft = pendingOf(["species"]);
  const backgroundLeft = pendingOf(["background"]);
  const classLeft = pendingOf(["class"]);
  const otherLeft = pendingOf(["other"]);
  const asiLeft = s ? s.asi.available - s.asi.used : 0;
  const spells = spellsLeft();
  const left = (n: number) => (n > 0 ? ui("build.left", { n }) : "");
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ");
  const order = classPriority();
  const abilityName = (a: string) => (c ? c.name(`${ch.ruleset}:ability/${a}`) : a);

  const basics: StepInfo[] = [
    {
      id: "origin",
      title: "form.species",
      icon: "1",
      status: join(name(ch.choices.subspecies) || name(ch.choices.species), left(speciesLeft)),
      done: Boolean(ch.choices.species) && speciesLeft === 0,
      hint: ui("build.hint.origin"),
      body: (
        <>
          <SpeciesStep />
          <FillChoices origins={["species"]} />
        </>
      ),
    },
    {
      id: "class",
      title: "build.class",
      icon: "2",
      status: join(
        ch.classes.map((cl) => `${name(cl.classId)} ${cl.level}`).join(" / "),
        needsSubclass ? ui("build.needsSubclass") : "",
        left(classLeft),
      ),
      done: Boolean(first) && !needsSubclass && classLeft === 0,
      hint: ui("build.hint.class"),
      body: (
        <>
          <ClassStep />
          <FillChoices origins={["class"]} />
        </>
      ),
    },
    {
      id: "abilities",
      title: "build.abilities",
      icon: "3",
      status: asiLeft > 0 ? left(asiLeft) : ui(`abilities.method.${ch.abilityMethod}` as UiKey),
      // The scores of a new character are only placeholders until a class says what matters.
      done: asiLeft === 0 && first !== undefined,
      hint: first
        ? ui("build.hint.abilities", {
            cls: name(first.classId),
            first: abilityName(order[0] ?? "con"),
            second: abilityName(order[1] ?? "dex"),
          })
        : ui("build.hint.abilitiesNoClass"),
      body: (
        <>
          <AssignAbilities />
          <AbilityScores />
        </>
      ),
    },
    {
      id: "background",
      title: "form.background",
      icon: "4",
      status: join(name(ch.choices.background), left(backgroundLeft)),
      done: Boolean(ch.choices.background) && backgroundLeft === 0,
      hint: ui("build.hint.background"),
      body: (
        <>
          <BackgroundStep />
          <FillChoices origins={["background"]} />
        </>
      ),
    },
  ];

  const refine: StepInfo[] = [];
  if (otherLeft > 0 || (s?.choices.some((choice) => choice.remaining === 0) ?? false))
    refine.push({
      id: "choices",
      title: "build.choices",
      icon: "◆",
      status: left(otherLeft),
      done: otherLeft === 0,
      hint: ui("build.hint.choices"),
      body: (
        <>
          <FillChoices origins={["other"]} />
          <Choices />
        </>
      ),
    });
  if (s && s.spellcasters.length > 0)
    refine.push({
      id: "spells",
      title: "build.spells",
      icon: "✦",
      status: left(spells),
      done: spells === 0,
      hint: ui("build.hint.spells"),
      body: (
        <>
          <FillSpells />
          <SpellPicker />
        </>
      ),
    });
  refine.push({
    id: "equipment",
    title: "build.equipment",
    icon: "⚔",
    status: ch.inventory.length > 0 ? ui("build.items", { n: ch.inventory.length }) : "",
    done: ch.inventory.length > 0,
    hint: ui("build.hint.equipment"),
    body: <EquipmentStep />,
  });
  const story = ch.story;
  const written = [story.personalityTraits, story.ideals, story.bonds, story.flaws].filter(
    (text) => text.trim() !== "",
  ).length;
  refine.push({
    id: "story",
    title: "build.story",
    icon: "✎",
    status: `${written}/4`,
    done: written === 4,
    hint: ui("build.hint.story"),
    body: <StoryStep />,
  });
  const customCount = ch.custom?.length ?? 0;
  refine.push({
    id: "features",
    title: "build.features",
    icon: "★",
    status: customCount > 0 ? String(customCount) : "",
    done: false,
    hint: ui("build.hint.features"),
    body: <FeaturesStep />,
  });
  const forcedCount = countOverrides(ch.overrides);
  refine.push({
    id: "freeEdit",
    title: "build.freeEdit",
    icon: "⚙",
    status: forcedCount > 0 ? ui("freeEdit.count", { n: forcedCount }) : "",
    done: false,
    hint: ui("build.hint.freeEdit"),
    body: <FreeEditStep />,
  });
  return { basics, refine };
}

/** Brings the top of the build screen into view when another step opens. */
function showTop() {
  requestAnimationFrame(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector(".bld")
      ?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
  });
}

/** The character the open step was chosen for: another one starts again from its own first step. */
let stepCharacter: string | undefined;

function go(id: StepId | "ready") {
  openStep.value = id;
  showTop();
}

/** The character as it grows: the class's colour, the key numbers, the abilities and how far the basics are. */
function Preview({ basicsDone, doneCount }: { basicsDone: boolean; doneCount: number }) {
  const s = sheet.value;
  const ch = character.value;
  const c = content.value;
  if (!s || !c) return null;
  const first = ch.classes[0];
  const classes = ch.classes.map((cl) => `${c.name(cl.classId)} ${cl.level}`).join(" / ");
  const species = c.name(ch.choices.subspecies ?? ch.choices.species ?? "");
  const color = classColor(first?.classId);
  const label = ch.name.trim() || ui("sheet.unnamed");
  return (
    <aside class="bld-preview" aria-label={ui("build.summary")}>
      <div class="bld-band" style={color ? { "--cls": color } : undefined}>
        <span class="bld-mark" aria-hidden="true">
          {label.charAt(0).toUpperCase()}
        </span>
        <div class="bld-who">
          <b>{label}</b>
          <span>{[species, classes].filter(Boolean).join(" · ") || "—"}</span>
        </div>
      </div>
      <div class="bld-preview-body">
        <div class="bld-tiles">
          <div>
            <small>{ui("dm.col.ac")}</small>
            <b>{s.armorClass.value}</b>
          </div>
          <div>
            <small>{ui("dm.col.hp")}</small>
            <b>{s.hitPoints.max}</b>
          </div>
          <div>
            <small>{ui("dm.col.init")}</small>
            <b>{signed(s.initiative)}</b>
          </div>
        </div>
        <ul class="plain bld-abilities">
          {ABILITY_ORDER.map((a) => (
            <li key={a} data-ability={a}>
              <b>{signed(s.abilities[a].modifier)}</b>
              <span>{c.text(`${ch.ruleset}:ability/${a}`, "abbreviation")}</span>
            </li>
          ))}
        </ul>
        {basicsDone ? (
          <>
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
          </>
        ) : (
          <div class="bld-progress">
            <span
              class="bld-ring"
              style={{ "--p": `${(doneCount / 4) * 100}%` }}
              aria-hidden="true"
            />
            <span>{ui("build.progress", { n: doneCount })}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/** The basics are done: the sheet can be played, and what is left to refine is a set of cards. */
function Ready({ refine }: { refine: StepInfo[] }) {
  const ch = character.value;
  const name = ch.name.trim();
  return (
    <div class="bld-ready">
      <section class="card bld-ready-hero">
        <span class="bld-ready-badge">✓ {ui("build.ready.badge")}</span>
        <h2>{name ? ui("build.ready.title", { name }) : ui("build.ready.titleNoName")}</h2>
        <p class="muted">{ui("build.ready.body")}</p>
        <div class="bld-ready-actions">
          <button type="button" class="primary" onClick={() => showView("play")}>
            {ui("build.ready.play")}
          </button>
          <button type="button" onClick={() => showView("sheet")}>
            {ui("build.viewSheet")}
          </button>
          <button type="button" class="secondary" onClick={() => showView("print")}>
            {ui("build.ready.print")}
          </button>
        </div>
      </section>
      <h3 class="bld-group-title">
        {ui("build.refineTitle")} <small class="muted">{ui("build.refineNote")}</small>
      </h3>
      <ul class="plain bld-refine">
        {refine.map((step) => (
          <li key={step.id} class="bld-refine-card" data-step={step.id}>
            <div class="bld-refine-head">
              <span class="bld-refine-icon" aria-hidden="true">
                {step.icon}
              </span>
              <div>
                <b>{ui(step.title)}</b>
                <small class="muted">{step.status || (step.done ? "✓" : "")}</small>
              </div>
            </div>
            <p>{step.hint}</p>
            <div class="bld-refine-actions">
              <button type="button" onClick={() => go(step.id)}>
                {ui("build.open")}
              </button>
              {step.id === "spells" && spellsLeft() > 0 && (
                <button type="button" class="secondary" onClick={fillSpellsForMe}>
                  ✦ {ui("build.chooseForMe")}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Guided building: the four basics one at a time, then a sheet ready to play and what can be refined. */
export function BuildTab() {
  const { basics, refine } = buildPlan();
  const all = [...basics, ...refine];
  const doneCount = basics.filter((step) => step.done).length;
  const basicsDone = doneCount === basics.length;
  const wanted = openStep.value;
  const auto = basicsDone ? "ready" : (basics.find((step) => !step.done)?.id ?? "origin");
  // A step that is not in the list (the spells of a class that does not cast) falls back to the screen's choice.
  const current: StepId | "ready" =
    wanted === "ready" || (wanted && all.some((step) => step.id === wanted)) ? wanted : auto;
  const step = all.find((x) => x.id === current);
  // The screen picks the step once, then keeps it: finishing a step (picking a species) must not
  // jump to the next one while its sub-choices are still to be seen. "Continue" moves on.
  const characterId = character.value.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step is chosen per character, not on every change of it.
  useEffect(() => {
    const switched = stepCharacter !== undefined && stepCharacter !== characterId;
    stepCharacter = characterId;
    if (switched || openStep.value === undefined) openStep.value = auto;
  }, [characterId]);
  const inBasics = basics.findIndex((x) => x.id === current);
  const inRefine = refine.findIndex((x) => x.id === current);

  const next = (): StepId | "ready" => {
    if (inBasics >= 0) return basics[inBasics + 1]?.id ?? "ready";
    return refine[inRefine + 1]?.id ?? "ready";
  };
  const back = (): StepId | "ready" | undefined => {
    if (inBasics > 0) return basics[inBasics - 1]?.id;
    if (inRefine > 0) return refine[inRefine - 1]?.id;
    if (inRefine === 0) return "ready";
    return undefined;
  };
  const nextId = next();
  const nextStep = all.find((x) => x.id === nextId);
  const backId = back();

  const navItem = (x: StepInfo, numbered: boolean) => (
    <li key={x.id}>
      <button
        type="button"
        id={`step-head-${x.id}`}
        class="bld-nav-item"
        aria-current={x.id === current ? "step" : undefined}
        data-done={x.done || undefined}
        data-numbered={numbered || undefined}
        onClick={() => go(x.id)}
      >
        <span class="bld-nav-mark" aria-hidden="true">
          {x.done && numbered ? "✓" : x.icon}
        </span>
        <span class="bld-nav-text">
          <b>{ui(x.title)}</b>
          {x.status && <small>{x.status}</small>}
        </span>
      </button>
    </li>
  );

  return (
    <>
      <Welcome />
      <div class="bld">
        <nav class="bld-nav" aria-label={ui("build.steps")}>
          <h3 class="bld-group-title">{ui("build.basicsTitle")}</h3>
          <ol class="plain">{basics.map((x) => navItem(x, true))}</ol>
          <h3 class="bld-group-title">{ui("build.refineTitle")}</h3>
          <ul class="plain">
            {basicsDone && (
              <li>
                <button
                  type="button"
                  class="bld-nav-item bld-nav-ready"
                  aria-current={current === "ready" ? "step" : undefined}
                  onClick={() => go("ready")}
                >
                  <span class="bld-nav-mark" aria-hidden="true">
                    ✓
                  </span>
                  <span class="bld-nav-text">
                    <b>{ui("build.ready.nav")}</b>
                  </span>
                </button>
              </li>
            )}
            {refine.map((x) => navItem(x, false))}
          </ul>
        </nav>

        <div class="bld-main">
          {current === "ready" || !step ? (
            <Ready refine={refine} />
          ) : (
            <section class="card bld-step" aria-labelledby="bld-step-title">
              <header class="bld-step-head">
                {inBasics >= 0 ? (
                  <div class="bld-stepbar">
                    <small>{ui("build.stepOf", { n: inBasics + 1, total: basics.length })}</small>
                    <span class="bld-stepbar-track" aria-hidden="true">
                      {basics.map((x, i) => (
                        <span
                          key={x.id}
                          data-done={x.done || undefined}
                          data-current={i === inBasics || undefined}
                        />
                      ))}
                    </span>
                  </div>
                ) : (
                  <div class="bld-stepbar">
                    <small>{ui("build.refineTitle")}</small>
                  </div>
                )}
                <h2 id="bld-step-title">{ui(step.title)}</h2>
                <p class="muted bld-hint">{step.hint}</p>
              </header>
              <div class="bld-step-body step-body">{step.body}</div>
              <footer class="bld-step-foot">
                {backId && (
                  <button
                    type="button"
                    class="secondary bld-back"
                    onClick={() => go(backId)}
                    aria-label={ui("build.back")}
                  >
                    ‹{" "}
                    <span class="bld-back-label">
                      {backId === "ready"
                        ? ui("build.ready.nav")
                        : ui(all.find((x) => x.id === backId)?.title ?? "build.back")}
                    </span>
                  </button>
                )}
                <span class="bld-foot-gap" />
                {inBasics === basics.length - 1 && !basicsDone && (
                  <span class="muted bld-foot-note">{ui("build.lastBasic")}</span>
                )}
                <button type="button" class="primary" onClick={() => go(nextId)}>
                  {nextStep
                    ? ui("build.continueTo", { step: ui(nextStep.title) })
                    : ui("build.toReady")}{" "}
                  ›
                </button>
              </footer>
            </section>
          )}
        </div>

        <Preview basicsDone={basicsDone} doneCount={doneCount} />
      </div>
    </>
  );
}
