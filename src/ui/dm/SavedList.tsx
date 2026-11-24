import { useState } from "preact/hooks";
import { giveEffect } from "../../app/dm";
import { forgetEffect, saveEffect, savedEffects } from "../../app/dmEffects";
import { fold } from "../../app/search";
import { ui } from "../../i18n/ui";
import { effectLine } from "../play/ActiveEffects";
import { EffectForm } from "./EffectForm";
import { environmentLine } from "./environmentLine";

/** The effects the DM kept, of the kind that fits (a creature's or the lair's): to add, change or delete. */
export function SavedList({
  target,
  environment,
  done,
}: { target: string; environment: boolean; done: () => void }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | undefined>(undefined);
  const mine = savedEffects.value.filter((s) => (s.kind === "environment") === environment);
  const open = mine.find((s) => s.id === editing);
  if (open)
    return (
      <EffectForm
        key={open.id}
        environment={environment}
        initial={open.effect}
        submit={ui("dm.saved.update")}
        onSubmit={(effect) => {
          saveEffect(effect, open.id);
          setEditing(undefined);
        }}
        onCancel={() => setEditing(undefined)}
      />
    );
  const wanted = fold(query.trim());
  const found = mine
    .filter((s) => !wanted || fold(s.effect.name).includes(wanted))
    .sort((a, b) => a.effect.name.localeCompare(b.effect.name));
  return (
    <div class="dm-add-body">
      {mine.length === 0 ? (
        <p class="muted">{ui("dm.saved.none")}</p>
      ) : (
        <label class="field dm-search">
          <span>{ui("dm.search")}</span>
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
        </label>
      )}
      <ul class="plain dm-results dm-saved">
        {found.map(({ id, effect }) => {
          const line = [
            effect.rounds !== undefined && ui("dm.saved.rounds", { n: effect.rounds }),
            effect.environment && environmentLine(effect.environment),
            ...(effect.effects ?? []).map(effectLine),
            effect.note,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={id}>
              <span class="dm-result-name">
                <b>{effect.name}</b>
                {line && <small title={line}>{line}</small>}
              </span>
              <button
                type="button"
                class="secondary"
                aria-label={`${ui("dm.saved.edit")}: ${effect.name}`}
                onClick={() => setEditing(id)}
              >
                {ui("dm.saved.edit")}
              </button>
              <button
                type="button"
                class="dm-add-button"
                aria-label={`${ui("dm.addButton")}: ${effect.name}`}
                onClick={() => {
                  giveEffect(target, effect);
                  done();
                }}
              >
                {ui("dm.addButton")}
              </button>
              <button
                type="button"
                class="dm-fx-x"
                aria-label={ui("dm.saved.remove", { name: effect.name })}
                onClick={() => forgetEffect(id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
