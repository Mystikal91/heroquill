import { changePlay } from "../../app/play";
import { character } from "../../app/store";
import { BARDIC_DICE, setBardicDie, setInspiration } from "../../engine/play";
import { ui } from "../../i18n/ui";
import { NoteIcon, StarIcon } from "./icons";

/** The notes that drift up the sides of the screen while the character holds a Bardic Inspiration. */
const NOTES = [
  { glyph: "♪", left: 4, delay: 0, duration: 9, size: 1.5 },
  { glyph: "♫", left: 93, delay: 1.5, duration: 11, size: 1.9 },
  { glyph: "♩", left: 10, delay: 4, duration: 10, size: 1.3 },
  { glyph: "♬", left: 88, delay: 5.5, duration: 9, size: 1.6 },
  { glyph: "♪", left: 2, delay: 7, duration: 12, size: 1.8 },
  { glyph: "♫", left: 96, delay: 8.5, duration: 10, size: 1.4 },
];

/** The animated notes of the aura, for the Bardic Inspiration. */
export function BardNotes() {
  return (
    <>
      {NOTES.map((n) => (
        <i
          key={`${n.glyph}-${n.left}`}
          class="bard-note"
          style={{
            "--x": `${n.left}%`,
            "--delay": `${n.delay}s`,
            "--time": `${n.duration}s`,
            "--size": `${n.size}rem`,
          }}
        >
          {n.glyph}
        </i>
      ))}
    </>
  );
}

/** The inspiration the DM gave, and the die of a Bardic Inspiration: what to spend on a roll. They sit in the Active effects panel. */
export function InspirationCards() {
  const play = character.value.play;
  const bardic = play.bardicDie;
  // The 2024 rules call it Heroic Inspiration, and it rolls any die again, not only the d20.
  const heroic = character.value.ruleset === "srd52";

  return (
    <ul class="plain card-list">
      <li
        class="play-card insp-card"
        data-kind="inspiration"
        data-focus={play.inspiration ? "on" : undefined}
      >
        <span class="card-badge" aria-hidden="true">
          <StarIcon />
        </span>
        <div class="card-head">
          <b class="feat-name">{ui(heroic ? "play.heroic" : "play.inspiration")}</b>
          <span class="card-meta insp-meta">
            {ui(heroic ? "play.heroicHint" : "play.inspirationHint")}
          </span>
        </div>
        <div class="card-actions">
          <button
            type="button"
            class="card-btn card-wide"
            aria-pressed={play.inspiration}
            onClick={() => changePlay((p) => setInspiration(p, !p.inspiration))}
          >
            {ui(
              heroic
                ? play.inspiration
                  ? "play.heroicHave"
                  : "play.heroicNone"
                : play.inspiration
                  ? "play.inspirationHave"
                  : "play.inspirationNone",
            )}
          </button>
        </div>
      </li>
      <li
        class="play-card insp-card"
        data-kind="bardic"
        data-focus={bardic !== undefined ? "on" : undefined}
      >
        <span class="card-badge" aria-hidden="true">
          <NoteIcon />
        </span>
        <div class="card-head">
          <b class="feat-name">{ui("play.bardic")}</b>
          <span class="card-meta insp-meta">{ui("play.bardicHint")}</span>
        </div>
        <div class="card-actions">
          <button
            type="button"
            class="card-btn card-wide"
            aria-pressed={bardic !== undefined}
            onClick={() =>
              changePlay((p) => setBardicDie(p, p.bardicDie === undefined ? 6 : undefined))
            }
          >
            {ui(bardic !== undefined ? "play.bardicHave" : "play.bardicNone")}
          </button>
        </div>
        {bardic !== undefined && (
          <div class="spell-slot-pick insp-dice">
            <small>{ui("play.bardicDie")}</small>
            {BARDIC_DICE.map((die) => (
              <button
                key={die}
                type="button"
                class="card-btn spell-slot-btn"
                aria-pressed={die === bardic}
                aria-label={`${ui("play.bardicDie")}: d${die}`}
                onClick={() => changePlay((p) => setBardicDie(p, die))}
              >
                d{die}
              </button>
            ))}
          </div>
        )}
      </li>
    </ul>
  );
}
