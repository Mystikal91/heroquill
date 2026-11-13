import { useState } from "preact/hooks";
import { content } from "../../app/store";
import { classData } from "../../data/progression";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { Select } from "./fields";

/** More options than this and a grid is a wall: the plain menu is kept (a big imported book). */
const MAX_CARDS = 24;

/** The first sentence of a text, cut to a length that fits a card. */
export function firstSentence(text: string | undefined, max = 90): string {
  const plain = (text ?? "").replace(/\s+/g, " ").trim();
  if (!plain) return "";
  const end = plain.search(/[.!?](\s|$)/);
  const sentence = end > 0 ? plain.slice(0, end + 1) : plain;
  return sentence.length <= max ? sentence : `${sentence.slice(0, max - 1).trimEnd()}…`;
}

interface CardSelectProps {
  label: string;
  value: string | undefined;
  options: { id: string; label: string }[];
  onChange: (value: string | undefined) => void;
  /** Written before the sentence on each card (a hit die). */
  fact?: (id: string) => string | undefined;
}

/**
 * Picks one entry from cards: its name and a line about it. With nothing chosen all the cards
 * show; once chosen, only that one, with a button to change it. A very long list is a menu.
 */
export function CardSelect({ label, value, options, onChange, fact }: CardSelectProps) {
  const [open, setOpen] = useState(false);
  const c = content.value;
  if (!c || options.length > MAX_CARDS) {
    return <Select label={label} value={value} options={options} onChange={onChange} />;
  }
  const shown = value && !open ? options.filter((o) => o.id === value) : options;
  return (
    <fieldset class="card-select">
      <legend>{label}</legend>
      <ul class="pick-cards">
        {shown.map((o) => {
          const line = [fact?.(o.id), firstSentence(c.text(o.id, "desc"))]
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={o.id}>
              <button
                type="button"
                class={`pick-card${o.id === value ? " on" : ""}`}
                aria-pressed={o.id === value}
                onClick={() => {
                  onChange(o.id === value ? undefined : o.id);
                  setOpen(false);
                }}
              >
                <b>{o.label}</b>
                {line && <small>{line}</small>}
              </button>
            </li>
          );
        })}
      </ul>
      {value && (
        <button type="button" class="link card-select-change" onClick={() => setOpen(!open)}>
          {open ? ui("pick.close") : ui("pick.change")}
        </button>
      )}
    </fieldset>
  );
}

/** "d10" and the saving throws for a class card. */
export function classFact(id: string): string | undefined {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return undefined;
  try {
    const saves = entry.effects.flatMap((e) =>
      e.type === "proficiency" && e.category === "save"
        ? [c.text(`${entry.id.split(":")[0]}:ability/${e.target}`, "abbreviation") ?? e.target]
        : [],
    );
    return [`d${classData(entry).hitDie}`, saves.join(" ")].filter(Boolean).join(" · ");
  } catch {
    return undefined;
  }
}

/** Size and speed for a species card. */
export function speciesFact(id: string): string | undefined {
  const entry = content.value?.index.get(id);
  if (!entry) return undefined;
  const size = entry.data.size as string | undefined;
  const speed = entry.data.speed as number | undefined;
  return [size ? ui(`hb.o.${size}` as UiKey) : "", speed === undefined ? "" : distance(speed)]
    .filter(Boolean)
    .join(" · ");
}

/** The skills a background trains, for its card. */
export function backgroundFact(id: string): string | undefined {
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return undefined;
  const rs = id.split(":")[0];
  return (
    entry.effects
      .flatMap((e) =>
        e.type === "proficiency" && e.category === "skill"
          ? [c.name(`${rs}:skill/${e.target}`)]
          : [],
      )
      .join(", ") || undefined
  );
}
