import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { nameTheId } from "../../app/arrange";
import { wizardFor } from "../../app/studio";
import type { Entry } from "../../data/schema";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { setText, updateEntry } from "../../homebrew/entries";
import { syncItemData } from "../../homebrew/sync";
import { type UiKey, ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { FieldControl, TextBox } from "./Controls";
import { EffectList } from "./Effects";
import { fieldHelp } from "./Help";
import { SpellCasting, SpellClasses, SpellLevelSchool } from "./SpellForm";
import { announce } from "./announce";
import { fieldLabel } from "./labels";
import { useEdit } from "./scope";

/** What a step can read and write: the entry being made, and the way to change it. */
interface Ctx {
  record: UserPackRecord;
  entry: Entry;
  text: (field: string) => string;
  writeText: (field: string, value: string) => void;
  /** Changes one field of the data, the entry keeping the rest. */
  writeData: (key: string, value: unknown) => void;
  writeEffects: (effects: Entry["effects"]) => void;
}

interface Step {
  /** The question, as a key of the texts. */
  question: UiKey;
  /** A line under it that helps to answer, as a key. */
  hint?: UiKey;
  body: (ctx: Ctx) => ComponentChildren;
}

/** One or more fields of the data of the entry, each with its own box. */
function fields(...keys: string[]): Step["body"] {
  return (ctx) => {
    const specs = DATA_FIELDS[ctx.entry.kind].filter((s) => keys.includes(s.key));
    const data = ctx.entry.data as Record<string, unknown>;
    return (
      <>
        {specs.map((spec) => (
          <FieldControl
            key={spec.key}
            label={fieldLabel(spec.key)}
            help={fieldHelp(spec.key)}
            type={spec.type}
            value={data[spec.key]}
            optional={spec.optional}
            onChange={(v) => ctx.writeData(spec.key, v)}
          />
        ))}
      </>
    );
  };
}

const name: Step = {
  question: "wiz.q.name",
  hint: "wiz.h.name",
  body: (ctx) => (
    <TextBox
      label={ui("hb.f.name")}
      value={ctx.text("name")}
      placeholder={ui("studio.unnamed")}
      onChange={(v) => ctx.writeText("name", v)}
    />
  ),
};

const description: Step = {
  question: "wiz.q.desc",
  hint: "wiz.h.desc",
  body: (ctx) => (
    <TextBox
      label={ui("hb.f.desc")}
      placeholder={ui("hint.desc")}
      value={ctx.text("desc")}
      area
      rows={6}
      onChange={(v) => ctx.writeText("desc", v)}
    />
  ),
};

const effects = (question: UiKey, hint: UiKey, hidden: string[] = []): Step => ({
  question,
  hint,
  body: (ctx) => (
    <EffectList hidden={hidden} effects={ctx.entry.effects} onChange={ctx.writeEffects} />
  ),
});

const cost: Step = { question: "wiz.q.cost", body: fields("cost", "weight") };

/** The questions of each kind a beginner starts, one screen each. The last is always "done". */
const STEPS: Record<string, Step[]> = {
  species: [
    name,
    description,
    { question: "wiz.q.size", body: fields("size") },
    { question: "wiz.q.speed", hint: "wiz.h.speed", body: fields("speed") },
    effects("wiz.q.speciesEffects", "wiz.h.speciesEffects", ["trait"]),
  ],
  weapon: [
    name,
    description,
    { question: "wiz.q.weapon", hint: "wiz.h.weapon", body: fields("weapon") },
    cost,
  ],
  armor: [
    name,
    description,
    { question: "wiz.q.armor", hint: "wiz.h.armor", body: fields("armor") },
    cost,
  ],
  gear: [name, description, cost],
  magic: [
    name,
    description,
    {
      question: "wiz.q.rarity",
      hint: "wiz.h.rarity",
      body: fields("rarity", "attunement", "slot"),
    },
    effects("wiz.q.magicEffects", "wiz.h.magicEffects"),
    cost,
  ],
  spell: [
    name,
    {
      question: "wiz.q.spellKind",
      body: (ctx) => <SpellLevelSchool record={ctx.record} entry={ctx.entry} />,
    },
    {
      question: "wiz.q.spellCast",
      hint: "wiz.h.spellCast",
      body: (ctx) => <SpellCasting record={ctx.record} entry={ctx.entry} />,
    },
    {
      question: "wiz.q.spellDesc",
      hint: "wiz.h.desc",
      body: (ctx) => (
        <TextBox
          label={ui("hb.f.desc")}
          placeholder={ui("hint.desc")}
          value={ctx.text("desc")}
          area
          rows={6}
          onChange={(v) => ctx.writeText("desc", v)}
        />
      ),
    },
    {
      question: "wiz.q.spellClasses",
      hint: "wiz.h.spellClasses",
      body: (ctx) => <SpellClasses record={ctx.record} entry={ctx.entry} />,
    },
  ],
  feat: [
    name,
    description,
    {
      question: "wiz.q.featPrereq",
      hint: "wiz.h.featPrereq",
      body: fields("category", "prerequisites"),
    },
    effects("wiz.q.featEffects", "wiz.h.featEffects"),
  ],
};

/** The kinds of new entry that have a guided path, by the id the new menu uses. */
export const WIZARD_KINDS = Object.keys(STEPS);

const doneStep: Step = {
  question: "wiz.q.done",
  hint: "wiz.h.done",
  body: () => null,
};

/**
 * A new entry made step by step: one question on each screen, with Back and Next. The entry already
 * exists in the pack (empty but valid), so leaving at any point keeps what was written and opens
 * the ordinary form.
 */
export function Wizard({
  record,
  entry,
  kindId,
}: {
  record: UserPackRecord;
  entry: Entry;
  kindId: string;
}) {
  const { apply } = useEdit();
  const steps = [...(STEPS[kindId] ?? []), doneStep];
  const [at, setAt] = useState(0);
  const body = useRef<HTMLDivElement>(null);
  const step = steps[at] ?? doneStep;
  const last = at === steps.length - 1;

  const data = entry.data as Record<string, unknown>;
  const ctx: Ctx = {
    record,
    entry,
    text: (field) => record.strings[`${entry.id}.${field}`] ?? "",
    writeText: (field, value) =>
      apply(setText(record, entry.id, field, value), `${entry.id}.${field}`),
    writeData: (key, value) => {
      const next = { ...data };
      if (value === undefined) delete next[key];
      else next[key] = value;
      const patch = entry.kind === "item" ? syncItemData(next) : next;
      const cleared = Object.fromEntries(
        Object.keys(data)
          .filter((k) => !(k in patch))
          .map((k) => [k, undefined]),
      );
      apply(
        updateEntry(record, entry.id, { data: { ...patch, ...cleared } }),
        `${entry.id}.data.${key}`,
      );
    },
    writeEffects: (list) =>
      apply(updateEntry(record, entry.id, { effects: list }), `${entry.id}.effects`),
  };

  // Each screen puts the cursor in its first box, and says the question to a screen reader.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it must run when the step changes, and only then
  useEffect(() => {
    body.current
      ?.querySelector<HTMLElement>(
        "input:not([type=checkbox]), textarea, select, .studio-select-button",
      )
      ?.focus({ preventScroll: true });
    announce(`${ui("wiz.step", { n: at + 1, total: steps.length })}. ${ui(step.question)}`);
  }, [at]);

  const close = () => {
    wizardFor.value = undefined;
    // The name is what the id of the entry is made of: it is settled once, when the guide is left.
    void nameTheId(entry.id);
  };
  const next = () => (last ? close() : setAt(at + 1));

  return (
    <section class="studio-wizard" aria-label={ui("wiz.title")}>
      <header class="studio-wizard-head">
        <p class="muted">{ui("wiz.step", { n: at + 1, total: steps.length })}</p>
        <progress max={steps.length} value={at + 1} aria-hidden="true" />
      </header>
      <h3>{ui(step.question)}</h3>
      {step.hint && <p class="muted">{ui(step.hint)}</p>}
      <div
        class="studio-wizard-body"
        ref={body}
        onKeyDown={(e) => {
          // Enter in a one-line box goes on to the next question.
          const target = e.target as HTMLElement;
          if (e.key === "Enter" && target instanceof HTMLInputElement && target.type === "text") {
            e.preventDefault();
            next();
          }
        }}
      >
        {step.body(ctx)}
      </div>
      <div class="studio-wizard-actions">
        <button type="button" disabled={at === 0} onClick={() => setAt(at - 1)}>
          {ui("wiz.back")}
        </button>
        <button type="button" class="primary" onClick={next}>
          {last ? ui("wiz.finish") : ui("wiz.next")}
        </button>
        {!last && (
          <button type="button" class="link" onClick={close}>
            {ui("wiz.skip")}
          </button>
        )}
      </div>
    </section>
  );
}
