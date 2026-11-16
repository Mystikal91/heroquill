import type { Entry } from "../../data/schema";
import { addOwned } from "../../homebrew/entries";
import { levelOverview } from "../../homebrew/overview";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { useEdit } from "./scope";

/** Takes the person to the card of a feature, opening it. */
function goTo(id: string) {
  const card = document.getElementById(`owned-${id}`);
  if (!card) return;
  (card as HTMLDetailsElement).open = true;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
}

/**
 * The levels of a class or subclass in a strip: what each gives, where the ability score increases
 * come, and the spell slots. A feature is a tag that takes you to its card; the plus adds one there.
 */
export function LevelStrip({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const { apply } = useEdit();
  const cells = levelOverview(entry, (id) => record.strings[`${id}.name`] || ui("studio.unnamed"));
  const isClass = entry.kind === "class";
  // A subclass lists only the levels with something: the rest are one tap away.
  const shown = isClass ? cells : cells;
  return (
    <section class="studio-strip" aria-label={ui("studio.levelStrip")}>
      <h4>{ui("studio.levelStrip")}</h4>
      <ol class="plain studio-levels">
        {shown.map((cell) => (
          <li key={cell.level} class={cell.features.length > 0 ? "has" : ""}>
            <header>
              <b>{cell.level}</b>
              {cell.asi && (
                <span
                  class="studio-asi"
                  title={ui("studio.asi")}
                  role="img"
                  aria-label={ui("studio.asi")}
                >
                  ✦
                </span>
              )}
              <button
                type="button"
                class="studio-level-add"
                aria-label={`${ui("studio.addFeature")} (${cell.level})`}
                title={ui("studio.addFeature")}
                onClick={() =>
                  apply(addOwned(record, entry.id, "feature", { level: cell.level }).record)
                }
              >
                +
              </button>
            </header>
            {cell.features.map((f) => (
              <button
                type="button"
                key={f.id}
                class="studio-level-feature"
                onClick={() => goTo(f.id)}
              >
                {f.name}
              </button>
            ))}
            {(cell.cantrips !== undefined || cell.slots.length > 0) && (
              <small class="muted">
                {cell.cantrips !== undefined && `${cell.cantrips}c `}
                {cell.slots.map(([level, count]) => `${level}:${count}`).join(" ")}
              </small>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
