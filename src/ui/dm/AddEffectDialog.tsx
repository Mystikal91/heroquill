import { useEffect, useMemo, useState } from "preact/hooks";
import { dmRuleset, effectFor, encounter, giveEffect } from "../../app/dm";
import { fold } from "../../app/search";
import { content } from "../../app/store";
import { durationRounds } from "../../engine/durations";
import { inRuleset } from "../../engine/rulesets";
import { ui } from "../../i18n/ui";
import { EffectForm } from "./EffectForm";
import { Modal } from "./Modal";
import { SavedList } from "./SavedList";

type Tab = "spells" | "byHand" | "saved";

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

/** Adds a spell or an effect to a creature: picked from the spells of the rules (its duration and concentration come with it) or written by hand. */
export function AddEffectDialog() {
  const [tab, setTab] = useState<Tab>("spells");
  const id = effectFor.value;
  const creature = encounter.value?.combatants.find((x) => x.id === id);
  const close = () => {
    effectFor.value = undefined;
  };
  const lair = creature?.lair === true;
  // The lair takes no spell: its window starts from the form.
  useEffect(() => {
    if (id) setTab(lair ? "byHand" : "spells");
  }, [id, lair]);
  const tabs: [Tab, string][] = [
    ...(lair ? [] : [["spells", ui("dm.effect.spells")] as [Tab, string]]),
    ["byHand", ui("dm.add.manual")],
    ["saved", ui("dm.saved.tab")],
  ];
  const addTitle = ui(lair ? "dm.env.add" : "dm.addEffect");
  return (
    <Modal
      open={Boolean(creature)}
      variant="center"
      title={creature && !lair ? `${addTitle} · ${creature.name}` : addTitle}
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
          (tab === "saved" ? (
            <SavedList target={creature.id} environment={lair} done={close} />
          ) : tab === "spells" && !lair ? (
            <Spells target={creature.id} done={close} />
          ) : (
            <EffectForm
              key={`${creature.id}${lair}`}
              environment={lair}
              submit={ui("dm.addButton")}
              offerSave
              onSubmit={(effect) => {
                giveEffect(creature.id, effect);
                close();
              }}
            />
          ))}
      </div>
    </Modal>
  );
}
