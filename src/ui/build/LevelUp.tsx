import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type StepId, levelUpPhase, levelUpResult, openStep } from "../../app/buildState";
import { showView } from "../../app/navigation";
import { character, content, sheet, updateCharacter } from "../../app/store";
import type { Content } from "../../content/browser";
import { classData } from "../../data/progression";
import { cryptoRandomInt } from "../../engine/dice";
import {
  type HpChoice,
  type LevelUpOption,
  type LevelUpSummary,
  type LevelUpTask,
  applyLevelUp,
  averageHp,
  levelUpOptions,
  openTasks,
  previewLevelUp,
} from "../../engine/levelUp";
import { signed, ui } from "../../i18n/ui";
import { RulesText } from "../sheet/parts";

const close = () => {
  levelUpPhase.value = "closed";
  levelUpResult.value = undefined;
};

/** The button that opens the level up window; nothing for a character without a class. */
export function LevelUpButton({ class: extra }: { class?: string }) {
  if (character.value.classes.length === 0) return null;
  return (
    <button
      type="button"
      class={extra ? `level-up-button ${extra}` : "level-up-button"}
      onClick={() => {
        levelUpPhase.value = "choose";
      }}
    >
      <span aria-hidden="true">{"✦ "}</span>
      {ui("levelUp.button")}
    </button>
  );
}

/** What a level brings, as a short list. */
function Changes({ summary, c }: { summary: LevelUpSummary; c: Content }) {
  const [pb0, pb1] = summary.proficiencyBonus;
  const slotRows = summary.slots[1]
    .map((after, i) => ({ level: i + 1, before: summary.slots[0][i] ?? 0, after }))
    .filter((r) => r.before !== r.after);
  const pact = summary.pact.after;
  const pactChanged =
    pact &&
    (summary.pact.before?.count !== pact.count || summary.pact.before?.level !== pact.level);

  return (
    <div class="levelup-changes">
      <ul class="plain">
        <li>{ui("levelUp.change.hp", { from: summary.hitPoints[0], to: summary.hitPoints[1] })}</li>
        {pb1 !== pb0 && (
          <li>{ui("levelUp.change.proficiency", { from: signed(pb0), to: signed(pb1) })}</li>
        )}
        {slotRows.map((r) => (
          <li key={r.level}>
            {ui("levelUp.change.slot", { level: r.level, from: r.before, to: r.after })}
          </li>
        ))}
        {pactChanged && pact && (
          <li>{ui("sheet.pact", { count: pact.count, level: pact.level })}</li>
        )}
        {summary.casters.map((caster) => {
          const name = c.name(caster.classId);
          return (
            <li key={caster.classId}>
              {caster.cantrips[1] !== caster.cantrips[0] && (
                <div>
                  {ui("levelUp.change.cantrips", {
                    class: name,
                    from: caster.cantrips[0],
                    to: caster.cantrips[1],
                  })}
                </div>
              )}
              {caster.spells[1] !== caster.spells[0] && (
                <div>
                  {ui("levelUp.change.spells", {
                    class: name,
                    from: caster.spells[0],
                    to: caster.spells[1],
                  })}
                </div>
              )}
              {caster.maxSpellLevel[1] > caster.maxSpellLevel[0] && (
                <div>
                  {ui("levelUp.change.spellLevel", { class: name, level: caster.maxSpellLevel[1] })}
                </div>
              )}
            </li>
          );
        })}
        {summary.newAsi && <li>{ui("levelUp.change.asi")}</li>}
      </ul>
      {summary.newFeatures.length > 0 && (
        <>
          <h4>{ui("levelUp.change.features")}</h4>
          {summary.newFeatures.map((id) => (
            <RulesText key={id} id={id} name={c.name(id)} text={c.text(id, "desc")} />
          ))}
        </>
      )}
    </div>
  );
}

const STEP_OF: Record<LevelUpTask["kind"], StepId> = {
  subclass: "class",
  asi: "abilities",
  spells: "spells",
  choices: "choices",
};

function taskText(task: LevelUpTask, c: Content): string {
  switch (task.kind) {
    case "subclass":
      return ui("levelUp.task.subclass", { class: c.name(task.classId) });
    case "asi":
      return ui("levelUp.task.asi", { n: task.left });
    case "spells":
      return ui("levelUp.task.spells", { class: c.name(task.classId), n: task.left });
    case "choices":
      return ui("levelUp.task.choices", { n: task.left });
  }
}

function optionLabel(option: LevelUpOption, c: Content): string {
  return option.isNew
    ? ui("levelUp.newClass", { class: c.name(option.classId) })
    : ui("levelUp.existing", {
        class: c.name(option.classId),
        from: option.currentLevel,
        to: option.newLevel,
      });
}

function Choose({ c }: { c: Content }) {
  const ch = character.value;
  const s = sheet.value;
  const options = s ? levelUpOptions(ch, c.index, s) : [];
  const [classId, setClassId] = useState(options[0]?.classId ?? "");
  const [rolled, setRolled] = useState<number | undefined>();
  const [mode, setMode] = useState<"average" | "roll">("average");
  // The classes the character does not have yet stay folded behind a button until wanted.
  const [showNew, setShowNew] = useState(false);

  if (!s || options.length === 0) {
    return (
      <>
        <p>{ui("levelUp.maxed")}</p>
        <div class="btn-row">
          <button type="button" class="primary" onClick={close}>
            {ui("levelUp.close")}
          </button>
        </div>
      </>
    );
  }

  const selected = options.find((o) => o.classId === classId) ?? options[0];
  const entry = selected ? c.index.get(selected.classId) : undefined;
  if (!selected || !entry) return null;
  const hitDie = classData(entry).hitDie;
  const conMod = s.abilities.con.modifier;
  const average = averageHp(hitDie);
  const hp: HpChoice =
    mode === "roll" && rolled !== undefined ? { type: "roll", value: rolled } : { type: "average" };
  const summary = previewLevelUp(ch, selected.classId, hp, c.index);
  const needsRoll = mode === "roll" && rolled === undefined;
  const mine = options.filter((o) => !o.isNew);
  // A class whose minimums the character does not reach cannot be taken: it is not listed at all.
  const others = options.filter((o) => o.isNew && o.unmet.length === 0);
  // A class that is picked is never hidden.
  const openNew = showNew || selected.isNew;

  const radio = (o: (typeof options)[number]) => (
    <label key={o.classId} class="radio-row">
      <input
        type="radio"
        name="levelup-class"
        checked={o.classId === selected.classId}
        onChange={() => {
          setClassId(o.classId);
          setRolled(undefined);
        }}
      />
      <span>{o.isNew ? c.name(o.classId) : optionLabel(o, c)}</span>
    </label>
  );

  const apply = () => {
    const next = applyLevelUp(ch, selected.classId, hp, c.index);
    updateCharacter((d) => {
      d.classes = next.classes;
    });
    levelUpResult.value = summary;
    levelUpPhase.value = "done";
  };

  return (
    <>
      <p class="muted">{ui("levelUp.intro", { level: s.level })}</p>
      <fieldset class="levelup-options">
        <legend>{ui("form.class")}</legend>
        {mine.map(radio)}
        {others.length > 0 && (
          <div class="levelup-new">
            <button
              type="button"
              class="secondary levelup-new-toggle"
              aria-expanded={openNew}
              disabled={selected.isNew}
              onClick={() => setShowNew(!showNew)}
            >
              <span aria-hidden="true">{openNew ? "−" : "+"}</span> {ui("levelUp.addClass")}
            </button>
            {openNew && <div class="levelup-new-list">{others.map(radio)}</div>}
          </div>
        )}
      </fieldset>

      <fieldset class="levelup-options">
        <legend>{ui("levelUp.hp")}</legend>
        <label class="radio-row">
          <input
            type="radio"
            name="levelup-hp"
            checked={mode === "average"}
            onChange={() => setMode("average")}
          />
          <span>{ui("levelUp.hpAverage", { value: Math.max(1, average + conMod) })}</span>
        </label>
        <label class="radio-row">
          <input
            type="radio"
            name="levelup-hp"
            checked={mode === "roll"}
            onChange={() => setMode("roll")}
          />
          <span>{ui("levelUp.hpRoll", { die: hitDie })}</span>
        </label>
        {mode === "roll" && (
          <div class="btn-row">
            <button type="button" onClick={() => setRolled(1 + cryptoRandomInt(hitDie))}>
              {ui("play.roll")}
            </button>
            {rolled !== undefined && (
              <span>
                {ui("levelUp.hpRolled", { roll: rolled, total: Math.max(1, rolled + conMod) })}
              </span>
            )}
          </div>
        )}
      </fieldset>

      <h4>{ui("levelUp.preview")}</h4>
      <Changes summary={summary} c={c} />
      <div class="btn-row">
        <button type="button" class="primary" onClick={apply} disabled={needsRoll}>
          {ui("levelUp.apply")}
        </button>
        <button type="button" class="secondary" onClick={close}>
          {ui("levelUp.cancel")}
        </button>
      </div>
    </>
  );
}

function Done({ c }: { c: Content }) {
  const ch = character.value;
  const s = sheet.value;
  const summary = levelUpResult.value;
  const tasks = s ? openTasks(ch, s, c.index) : [];

  return (
    <>
      {summary && (
        <>
          <Celebration level={summary.totalLevel} key={summary.totalLevel} />
          <Changes summary={summary} c={c} />
        </>
      )}
      <h4>{ui("levelUp.todo")}</h4>
      {tasks.length === 0 ? (
        <p class="muted">{ui("levelUp.allSet")}</p>
      ) : (
        <ul class="plain levelup-tasks">
          {tasks.map((task) => (
            <li key={`${task.kind}-${"classId" in task ? task.classId : ""}`} class="row-between">
              <span>{taskText(task, c)}</span>
              <button
                type="button"
                class="secondary"
                onClick={() => {
                  const step = STEP_OF[task.kind];
                  close();
                  showView("build");
                  openStep.value = step;
                  // Wait for the build tab and the step to open, then bring it into view.
                  setTimeout(
                    () =>
                      document
                        .getElementById(`step-${step}`)
                        ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                    80,
                  );
                }}
              >
                {ui("levelUp.go")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="btn-row">
        <button type="button" class="primary" onClick={close}>
          {ui("levelUp.close")}
        </button>
      </div>
    </>
  );
}

/** The moment itself: rays, a burst of sparks, and the level number rolling over. */
function Celebration({ level }: { level: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        angle: Math.round((i / 36) * 360 + (i % 3) * 7),
        distance: 80 + ((i * 37) % 90),
        delay: (i % 6) * 0.05,
        size: 4 + (i % 4) * 2,
        tone: i % 3,
      })),
    [],
  );
  return (
    <div class="lv-stage">
      <div class="lv-rays" aria-hidden="true" />
      <div class="lv-sparks" aria-hidden="true">
        {sparks.map((p) => (
          <i
            key={`${p.angle}-${p.size}`}
            class={`lv-spark tone-${p.tone}`}
            style={{
              "--a": `${p.angle}deg`,
              "--d": `${p.distance}px`,
              "--delay": `${p.delay}s`,
              "--size": `${p.size}px`,
            }}
          />
        ))}
      </div>
      <p class="lv-kicker">{ui("levelUp.celebrate")}</p>
      <div class="lv-number" role="img" aria-label={ui("levelUp.done", { level })}>
        <span class="lv-old" aria-hidden="true">
          {Math.max(1, level - 1)}
        </span>
        <span class="lv-new" aria-hidden="true">
          {level}
        </span>
      </div>
      <p class="lv-sub">{ui("levelUp.done", { level })}</p>
    </div>
  );
}

/** Level up: pick the class and the hit points, see what changes, then settle the open choices. */
export function LevelUp() {
  const phase = levelUpPhase.value;
  const c = content.value;
  const dialog = useRef<HTMLDialogElement>(null);
  const open = phase !== "closed" && Boolean(c);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      class="spell-dialog levelup-dialog"
      aria-label={ui("levelUp.title")}
      onClose={close}
    >
      {open && c && (
        <div class="spell-dialog-body levelup">
          {phase === "choose" && <h3 class="levelup-title">{ui("levelUp.title")}</h3>}
          {phase === "choose" ? <Choose c={c} /> : <Done c={c} />}
        </div>
      )}
    </dialog>
  );
}
