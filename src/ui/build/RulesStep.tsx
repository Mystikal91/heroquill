import { signal } from "@preact/signals";
import { EDITIONS, type Ruleset } from "../../app/edition";
import { character, rulesOpen } from "../../app/store";
import { ui } from "../../i18n/ui";

/** The edition picked in the rules step, for the character it was picked for, until "Continue" settles it. */
const picked = signal<{ character: string; ruleset: Ruleset } | undefined>(undefined);

export const pickedRules = (): Ruleset | undefined =>
  picked.value?.character === character.value.id ? picked.value.ruleset : undefined;

/** Which rules the character follows: the first step, done once and for all. */
export function RulesStep() {
  const open = rulesOpen.value;
  const chosen = open ? pickedRules() : character.value.ruleset;
  return (
    <fieldset class="edition-options" disabled={!open}>
      <legend class="sr-only">{ui("edition.title")}</legend>
      {EDITIONS.map((e) => (
        <label key={e} class="edition-option" data-on={chosen === e || undefined}>
          <input
            type="radio"
            name="edition"
            checked={chosen === e}
            onChange={() => {
              picked.value = { character: character.value.id, ruleset: e };
            }}
          />
          <span class="edition-text">
            <b>{ui(`edition.${e}.name`)}</b>
            <span>{ui(`edition.${e}.desc`)}</span>
          </span>
        </label>
      ))}
      <p class="muted edition-note">{ui(open ? "edition.fixed" : "edition.settled")}</p>
    </fieldset>
  );
}
