import { useMemo, useState } from "preact/hooks";
import { dmRuleset, effectFor, encounter, giveEffect } from "../../app/dm";
import { fold } from "../../app/search";
import { content } from "../../app/store";
import type { Effect } from "../../data/schema";
import { durationRounds } from "../../engine/durations";
import { MAX_ROUNDS } from "../../engine/encounter";
import { inRuleset } from "../../engine/rulesets";
import { ui } from "../../i18n/ui";
import { NOT_FREE } from "../play/ActiveEffects";
import { EffectList } from "../studio/Effects";
import { Modal } from "./Modal";
import { NumberField } from "./NumberField";

type Tab = "spells" | "byHand";

function Spells({ target, done }: { target: string; done: () => void }) {
  const c = content.value;
  const ruleset = dmRuleset.value;
  const [query, setQuery] = useState("");
  const [onlyNumbers, setOnlyNumbers] = useState(false);
  const all = useMemo(
    () =>
      c
        ? [...c.index.values()]
            .filter((e) => e.kind === "spell" && inRuleset(e.id, ruleset))
            .map((e) => ({ entry: e, name: c.name(e.id) }))
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [c, ruleset],
  );
  const wanted = fold(query.trim());
  const found = all.filter(
    (s) =>
      (!wanted || fold(s.name).includes(wanted)) && (!onlyNumbers || s.entry.effects.length > 0),
  );
  const shown = found.slice(0, 60);
  return (
    <div class="dm-add-body">
      <label class="field dm-search">
        <span>{ui("dm.search")}</span>
        <input
          type="search"
          autofocus
          value={query}
          placeholder={ui("dm.effect.searchPlaceholder")}
          onInput={(e) => setQuery(e.currentTarget.value)}
        />
      </label>
      <label class="dm-check">
        <input
          type="checkbox"
          checked={onlyNumbers}
          onChange={(e) => setOnlyNumbers(e.currentTarget.checked)}
        />
        <span>{ui("dm.effect.onlyNumbers")}</span>
      </label>
      {shown.length === 0 ? (
        <p class="muted">{ui("dm.effect.noSpells")}</p>
      ) : (
        <ul class="plain dm-results">
          {shown.map(({ entry, name }) => {
            const data = entry.data as { level?: number; concentration?: boolean };
            const duration = c?.displayed(entry.id, "duration") ?? c?.text(entry.id, "duration");
            const rounds = durationRounds(duration);
            const level =
              data.level === 0 ? ui("dm.cantrip") : ui("dm.spellLevel", { n: data.level ?? 0 });
            return (
              <li key={entry.id}>
                <span class="dm-result-name">
                  <b>
                    {name}
                    {data.concentration && (
                      <span class="dm-tag">{ui("dm.effect.concentration")}</span>
                    )}
                    {entry.effects.length > 0 && (
                      <span class="dm-tag dm-tag-numbers">{ui("dm.effect.changes")}</span>
                    )}
                  </b>
                  <small>{[level, duration].filter(Boolean).join(" · ")}</small>
                </span>
                <button
                  type="button"
                  class="dm-add-button"
                  aria-label={`${ui("dm.addButton")}: ${name}`}
                  onClick={() => {
                    giveEffect(target, {
                      name,
                      spell: entry.id,
                      ...(rounds !== undefined && { rounds }),
                      ...(data.concentration && { concentration: true }),
                      ...(entry.effects.length > 0 && { effects: entry.effects }),
                    });
                    done();
                  }}
                >
                  {ui("dm.addButton")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {found.length > shown.length && <p class="muted">{ui("dm.searchMore")}</p>}
    </div>
  );
}

function ByHand({ target, done }: { target: string; done: () => void }) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [rounds, setRounds] = useState<number | undefined>(undefined);
  const [concentration, setConcentration] = useState(false);
  const [rules, setRules] = useState<Effect[]>([]);
  return (
    <form
      class="dm-add-body dm-manual"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        giveEffect(target, {
          name,
          ...(note.trim() && { note }),
          ...(rounds !== undefined && { rounds }),
          ...(concentration && { concentration: true }),
          ...(rules.length > 0 && { effects: rules }),
        });
        done();
      }}
    >
      <label class="field dm-manual-name">
        <span>{ui("dm.effect.name")}</span>
        <input
          type="text"
          maxLength={80}
          value={name}
          placeholder={ui("dm.effect.namePlaceholder")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
      </label>
      <label class="field dm-manual-name">
        <span>{ui("dm.effect.note")}</span>
        <input
          type="text"
          maxLength={200}
          value={note}
          onInput={(e) => setNote(e.currentTarget.value)}
        />
      </label>
      <div class="field">
        <span>{ui("play.conditionRounds")}</span>
        <NumberField
          label={ui("play.conditionRounds")}
          placeholder="—"
          min={0}
          max={MAX_ROUNDS}
          value={rounds}
          onChange={setRounds}
        />
      </div>
      <label class="dm-check">
        <input
          type="checkbox"
          checked={concentration}
          onChange={(e) => setConcentration(e.currentTarget.checked)}
        />
        <span>{ui("dm.effect.concentration")}</span>
      </label>
      <div class="dm-manual-name dm-effect-rules">
        <h4>{ui("dm.effect.numbersTitle")}</h4>
        <p class="muted">{ui("dm.effect.numbersHint")}</p>
        <EffectList effects={rules} onChange={setRules} hidden={NOT_FREE} />
      </div>
      <button type="submit" class="dm-manual-add" disabled={!name.trim()}>
        {ui("dm.addButton")}
      </button>
    </form>
  );
}

/** Adds a spell or an effect to a creature: picked from the spells of the rules (its duration and concentration come with it) or written by hand. */
export function AddEffectDialog() {
  const [tab, setTab] = useState<Tab>("spells");
  const id = effectFor.value;
  const creature = encounter.value?.combatants.find((x) => x.id === id);
  const close = () => {
    effectFor.value = undefined;
  };
  const tabs: [Tab, string][] = [
    ["spells", ui("dm.effect.spells")],
    ["byHand", ui("dm.add.manual")],
  ];
  return (
    <Modal
      open={Boolean(creature)}
      variant="center"
      title={creature ? `${ui("dm.addEffect")} · ${creature.name}` : ui("dm.addEffect")}
      onClose={close}
    >
      <div class="dm-tabs" role="tablist">
        {tabs.map(([key, label]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={tab === key}
            class="dm-tab"
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div class="dm-add-scroll">
        {creature &&
          (tab === "spells" ? (
            <Spells target={creature.id} done={close} />
          ) : (
            <ByHand target={creature.id} done={close} />
          ))}
      </div>
    </Modal>
  );
}
