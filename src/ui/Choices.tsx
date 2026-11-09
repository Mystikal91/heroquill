import { character, content, sheet, updateCharacter } from "../app/store";
import type { Content } from "../content/browser";
import type { PendingChoice } from "../engine/choices";
import { type UiKey, signed, ui } from "../i18n/ui";
import { needLabel } from "./needLabel";
import { RuleInfoButton } from "./rules/EntryDetail";
import { RulesText } from "./sheet/parts";
import { SpellInfoButton } from "./spells/SpellInfo";

/** The display name of one option of a choice, whatever it grants. */
function optionLabel(c: Content, ruleset: string, choice: PendingChoice, option: string): string {
  switch (choice.grants) {
    case "proficiency": {
      const [category, target = ""] = option.split(":");
      return category === "skill"
        ? c.name(`${ruleset}:skill/${target}`)
        : c.name(`${ruleset}:proficiency/${target}`);
    }
    case "language":
      return c.name(`${ruleset}:language/${option}`);
    case "abilityBonus":
      return c.name(`${ruleset}:ability/${option}`);
    case "spell":
    case "trait":
    case "feat":
    case "mastery":
      return c.name(option);
    case "size":
      return ["tiny", "small", "medium", "large"].includes(option)
        ? ui(`hb.o.${option}` as UiKey)
        : option;
    case "expertise":
      return c.index.has(`${ruleset}:skill/${option}`)
        ? c.name(`${ruleset}:skill/${option}`)
        : c.name(`${ruleset}:proficiency/${option}`);
  }
}

/** A pick among many options (every feat): one menu per pick, with the text of what was picked. */
function MenuPicks({ choice }: { choice: PendingChoice }) {
  const c = content.value;
  const ruleset = character.value.ruleset;
  const s = sheet.value;
  if (!c || !s) return null;
  const name = (id: string) => c.name(id);
  const sorted = [...choice.options].sort((a, b) => name(a).localeCompare(name(b)));
  // What to explain under a pick: the entry itself, or for a weapon mastery the property of the weapon.
  const about = (id: string | undefined) =>
    id === undefined
      ? undefined
      : choice.grants === "mastery"
        ? (c.index.get(id)?.data as { weapon?: { mastery?: string } }).weapon?.mastery
        : id;
  const set = (slot: number, id: string) =>
    updateCharacter((d) => {
      const next = [...(d.selections[choice.key] ?? [])];
      if (id) next[slot] = id;
      else next.splice(slot, 1);
      const kept = next.filter(Boolean);
      if (kept.length === 0) delete d.selections[choice.key];
      else d.selections[choice.key] = kept;
    });
  const slots = Array.from({ length: choice.choose }, (_, slot) => ({
    slot,
    id: `${choice.key}#${slot}`,
  }));
  return (
    <div class="menu-picks">
      {slots.map(({ slot, id }) => {
        const own = choice.selected[slot];
        const taken = new Set([...choice.selected, ...s.feats]);
        return (
          <div key={id}>
            <select
              aria-label={name(choice.source)}
              value={own ?? ""}
              onChange={(e) => set(slot, e.currentTarget.value)}
            >
              <option value="">{ui("form.none")}</option>
              {sorted
                .filter((id) => id === own || !taken.has(id))
                .map((id) => {
                  // An option whose requirement is not met is there, greyed, with what it asks for.
                  const need = choice.needs?.[id];
                  const blocked = need !== undefined && !need.met && id !== own;
                  const asks = blocked ? needLabel(c, ruleset, id, need.expression) : "";
                  return (
                    <option key={id} value={id} disabled={blocked}>
                      {asks ? `${name(id)} (${asks})` : name(id)}
                    </option>
                  );
                })}
            </select>
            {about(own) && (
              <RulesText
                id={about(own) ?? ""}
                name={name(about(own) ?? "")}
                text={c.text(about(own) ?? "", "desc")}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Choices() {
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c || !s) return null;

  const pending = s.choices.reduce((sum, choice) => sum + choice.remaining, 0);

  const toggle = (choice: PendingChoice, option: string, on: boolean) => {
    updateCharacter((d) => {
      const current = d.selections[choice.key] ?? [];
      const next = on ? [...current, option] : current.filter((o) => o !== option);
      if (next.length === 0) delete d.selections[choice.key];
      else d.selections[choice.key] = next;
    });
  };

  // Proficiencies and languages already held (from fixed effects or other choices) cannot be
  // picked again for nothing; they stay visible but disabled.
  const alreadyHeld = (choice: PendingChoice, option: string) => {
    if (choice.selected.includes(option)) return false;
    if (choice.grants === "language") return s.proficiencies.language.includes(option);
    if (choice.grants === "proficiency") {
      const [category, target = ""] = option.split(":");
      return (s.proficiencies[category as keyof typeof s.proficiencies] ?? []).includes(target);
    }
    return false;
  };

  return (
    <fieldset class="choices">
      <legend>{ui("choices.title")}</legend>
      {s.choices.length === 0 ? (
        <p class="muted">{ui("choices.none")}</p>
      ) : (
        <p class={pending > 0 ? "note" : "muted"}>
          {pending > 0 ? ui("choices.pending", { count: pending }) : ui("choices.done")}
        </p>
      )}
      {s.choices.map((choice) => (
        <fieldset class="choice" key={choice.key}>
          <legend>{c.name(choice.source)}</legend>
          <p class="muted">
            {ui(`choice.kind.${choice.grants}` as UiKey)}
            {choice.grants === "abilityBonus" && choice.value !== undefined
              ? ` ${signed(choice.value)}`
              : ""}{" "}
            · {ui("choice.hint", { n: choice.choose, left: choice.remaining })}
          </p>
          {choice.grants === "feat" ||
          choice.grants === "mastery" ||
          (choice.grants === "spell" && choice.options.length > 40) ? (
            <MenuPicks choice={choice} />
          ) : (
            <ul class="options">
              {choice.options.map((option) => {
                const held = alreadyHeld(choice, option);
                const checked = choice.selected.includes(option);
                const full = !checked && choice.remaining === 0;
                const need = choice.needs?.[option];
                // An option whose requirement is not met cannot be picked; one already picked stays
                // so it can be taken off, and the sheet warns about it.
                const blocked = need !== undefined && !need.met && !checked;
                const asks = need ? needLabel(c, ch.ruleset, option, need.expression) : "";
                return (
                  <li key={option}>
                    <label class={held || blocked ? "disabled" : ""}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={held || full || blocked}
                        onChange={(e) => toggle(choice, option, e.currentTarget.checked)}
                      />
                      <span>
                        {optionLabel(c, ch.ruleset, choice, option)}
                        {held && <span class="muted"> ({ui("choice.alreadyHave")})</span>}
                        {asks && (
                          <small class="option-need" data-met={need?.met ? "true" : "false"}>
                            {asks}
                          </small>
                        )}
                      </span>
                    </label>
                    {choice.grants === "spell" && <SpellInfoButton id={option} />}
                    {choice.grants === "trait" && <RuleInfoButton id={option} />}
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      ))}
    </fieldset>
  );
}
