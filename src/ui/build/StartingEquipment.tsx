import { useState } from "preact/hooks";
import { character, content, sheet, updateCharacter } from "../../app/store";
import type { Content } from "../../content/browser";
import type { Entry } from "../../data/schema";
import {
  type Starting,
  type StartingChoice,
  type StartingPart,
  startingOf,
} from "../../data/startingEquipment";
import type { InventoryItem } from "../../engine/character";
import { NO_COINS } from "../../engine/coins";
import { addStartingItems, startingQuantity } from "../../engine/gear";
import {
  type StartingPicks,
  categoryItems,
  noPicks,
  proficientItems,
  resolveStarting,
  slotKeys,
  takenOption,
  withLinkedPicks,
} from "../../engine/startingGear";
import { type UiKey, ui } from "../../i18n/ui";

const MAX_LINES = 12;

/** The choices the rules give a class for its starting equipment, as written in its language. */
function classLines(c: Content, classId: string): string[] {
  const lines: string[] = [];
  for (let n = 1; n <= MAX_LINES; n++) {
    const line = c.text(classId, `startingEquipment.${n}`);
    if (!line) break;
    lines.push(line);
  }
  return lines;
}

/** An item with how many of it: ammunition counts in the bundles of the book ("Arrow (20)"). */
const itemText = (c: Content, item: string, quantity: number) => {
  const n = startingQuantity(c.index.get(item), quantity);
  return n > 1 ? `${c.name(item)} ×${n}` : c.name(item);
};

const partText = (c: Content, part: StartingPart) =>
  "item" in part
    ? itemText(c, part.item, part.quantity)
    : "gold" in part
      ? `${part.gold} gp`
      : ui(`equipment.cat.${part.category}` as UiKey);

/** What an option hands out, in words ("a light crossbow and 20 bolts"). */
function optionText(c: Content, choice: StartingChoice, option: number): string {
  const o = choice.options[option];
  if (!o) return "";
  const text = o.items.map((p) => partText(c, p)).join(", ");
  return o.requires ? `${text} (${ui("equipment.startingNeeds")})` : text;
}

interface SectionProps {
  c: Content;
  entry: Entry;
  starting: Starting;
  /** What the person decided; the dialog changes this one. */
  picks: StartingPicks;
  /** The same with the items the rules fix filled in (the gaming set of the proficiency). */
  shown: StartingPicks;
  /** The tool proficiencies the character holds. */
  tools: readonly string[];
  onChange: (picks: StartingPicks) => void;
}

/** The questions of one class or background: which option to take, and which item of a category. */
function Questions({ c, entry, starting, picks, shown, tools, onChange }: SectionProps) {
  return (
    <>
      {starting.choices.map((choice, n) => {
        const taken = takenOption(choice, picks, n);
        const option = taken === undefined ? undefined : choice.options[taken];
        const slots = (option?.items ?? []).flatMap((part, p) =>
          "category" in part ? slotKeys(n, p, part).map((key) => ({ key, part })) : [],
        );
        return (
          <fieldset key={`${entry.id}:${n}`} class="start-choice">
            {choice.options.length > 1 && (
              <>
                <legend>{ui("equipment.startingChoice", { n: String(n + 1) })}</legend>
                {choice.options.map((_, i) => (
                  <label key={optionText(c, choice, i)} class="start-option">
                    <input
                      type="radio"
                      name={`${entry.id}:${n}`}
                      checked={taken === i}
                      onChange={() => {
                        const options = [...picks.options];
                        options[n] = i;
                        onChange({ ...picks, options });
                      }}
                    />{" "}
                    {optionText(c, choice, i)}
                  </label>
                ))}
              </>
            )}
            {slots.map(({ key, part }) => {
              const category = (part as { category: string }).category;
              const only = proficientItems(category, c.index, tools, character.value.ruleset);
              // One kind of tool is the character's: the book says "the same as above", so it is not asked again.
              if (only.length === 1 && only[0])
                return (
                  <p key={key} class="start-slot muted">
                    {ui("equipment.startingLinked", { item: c.name(only[0]) })}
                  </p>
                );
              return (
                <label key={key} class="start-slot">
                  <span>
                    {ui(`equipment.cat.${(part as { category: string }).category}` as UiKey)}
                  </span>
                  <select
                    value={shown.items[key] ?? ""}
                    onChange={(e) =>
                      onChange({
                        ...picks,
                        items: { ...picks.items, [key]: e.currentTarget.value },
                      })
                    }
                  >
                    <option value="">{ui("equipment.startingChoose")}</option>
                    {categoryItems(
                      (part as { category: string }).category,
                      c.index,
                      character.value.ruleset,
                    )
                      .map((id) => ({ id, name: c.name(id) }))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
          </fieldset>
        );
      })}
    </>
  );
}

/** A short list of the items an entry gives without a choice ("Explorer's Pack, Javelin ×4"). */
const fixedText = (c: Content, starting: Starting) =>
  starting.fixed.map((i) => itemText(c, i.item, i.quantity)).join(", ");

/**
 * The starting equipment of the first class and the background, in the Equipment step: what the
 * rules give without a choice, a question for each choice they give, and one button that puts it
 * all in the inventory (a pack adds everything it holds). A class with no choices in the data keeps
 * the text of the rules.
 */
export function StartingEquipment() {
  const [all, setAll] = useState<Record<string, StartingPicks>>({});
  // What was just added, so gold that no inventory line shows is not added twice.
  const [justAdded, setJustAdded] = useState("");
  const c = content.value;
  const ch = character.value;
  if (!c) return null;
  const classId = ch.classes[0]?.classId;
  const cls = classId ? c.index.get(classId) : undefined;
  const background = ch.choices.background ? c.index.get(ch.choices.background) : undefined;

  const sections = [cls, background]
    .flatMap((entry) => (entry ? [{ entry, starting: startingOf(entry) }] : []))
    .map((s) => ({
      ...s,
      lines:
        s.starting.choices.length === 0 && s.entry.kind === "class"
          ? classLines(c, s.entry.id)
          : [],
    }))
    .filter(
      (s) => s.starting.fixed.length > 0 || s.starting.choices.length > 0 || s.lines.length > 0,
    );
  if (sections.length === 0) return null;

  const tools = sheet.value?.proficiencies.tool ?? [];
  const shownPicks = (s: (typeof sections)[number]) =>
    withLinkedPicks(s.starting.choices, all[s.entry.id] ?? noPicks(), c.index, tools, ch.ruleset);
  const resolved = sections.map((s) => resolveStarting(s.starting.choices, shownPicks(s)));
  const given = sections.flatMap((s, i) => [...s.starting.fixed, ...(resolved[i]?.items ?? [])]);
  const complete = resolved.every((r) => r.complete);
  const gold = resolved.reduce((sum, r) => sum + r.gold, 0);
  const addKey = JSON.stringify([given, gold]);
  // Already added once: everything it would put in the inventory is there in full.
  const wanted: InventoryItem[] = [];
  addStartingItems(wanted, c.index, given);
  const added =
    wanted.length > 0 &&
    wanted.every(
      (w) => (ch.inventory.find((i) => i.itemId === w.itemId)?.quantity ?? 0) >= w.quantity,
    );

  return (
    <details class="starting-equipment" open>
      <summary>{ui("equipment.starting")}</summary>
      <p class="muted">{ui("equipment.startingHint")}</p>
      {sections.map((s) => {
        const wealth = s.starting.wealth;
        const fixed = fixedText(c, s.starting);
        return (
          <section key={s.entry.id}>
            <h5>{c.name(s.entry.id)}</h5>
            {s.lines.length > 0 && (
              <ul>
                {s.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            {fixed && <p>{ui("equipment.startingAlso", { items: fixed })}</p>}
            <Questions
              c={c}
              entry={s.entry}
              starting={s.starting}
              picks={all[s.entry.id] ?? noPicks()}
              shown={shownPicks(s)}
              tools={tools}
              onChange={(p) => setAll({ ...all, [s.entry.id]: p })}
            />
            {wealth && (
              <p class="muted">
                {ui("equipment.startingWealth", {
                  amount:
                    wealth.multiplier > 1 ? `${wealth.dice} × ${wealth.multiplier}` : wealth.dice,
                })}
              </p>
            )}
          </section>
        );
      })}
      {(given.length > 0 || gold > 0) && (
        <>
          <button
            type="button"
            class="secondary"
            disabled={added || justAdded === addKey || !complete}
            onClick={() => {
              updateCharacter((d) => {
                addStartingItems(d.inventory, c.index, given);
                if (gold > 0) d.coins = { ...NO_COINS, ...d.coins, gp: (d.coins?.gp ?? 0) + gold };
              });
              setJustAdded(addKey);
            }}
          >
            {ui("equipment.startingAdd")}
          </button>
          {!complete && <p class="muted">{ui("equipment.startingIncomplete")}</p>}
        </>
      )}
    </details>
  );
}
