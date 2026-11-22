import { rollForCreature } from "../../app/dm";
import { content } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import type { Combatant } from "../../engine/encounter";
import { signed, ui } from "../../i18n/ui";

interface MonsterScores {
  abilities?: Record<string, number>;
  saves?: Record<string, number>;
  skills?: Record<string, number>;
}

const modifier = (score: number) => Math.floor((score - 10) / 2);

/**
 * The six abilities of a monster, each a button that rolls its check and a smaller one that rolls its saving
 * throw (the stat block's bonus where it has one, else the modifier), and its skills as chips that roll.
 */
export function AbilityRolls({ c }: { c: Combatant }) {
  const all = content.value;
  const source = c.kind === "monster" ? c.source : undefined;
  const m = source ? (all?.index.get(source)?.data as MonsterScores | undefined) : undefined;
  if (!all || !source || !m?.abilities) return null;
  const scores = m.abilities;
  // The names of abilities and skills are the rules' own, whatever pack the creature is in.
  const pack = source.split(":")[0] ?? "";
  const rules = /^srd\d+$/.test(pack) ? pack : "srd51";
  const skills = Object.entries(m.skills ?? {});
  return (
    <section class="dm-ability-rolls" aria-label={ui("dm.rollsOf", { name: c.name })}>
      <div class="dm-ab-grid">
        {ABILITIES.map((a) => {
          const score = scores[a] ?? 10;
          const mod = modifier(score);
          const save = m.saves?.[a] ?? mod;
          const short = all.text(`${rules}:ability/${a}`, "abbreviation") ?? a;
          const long = all.name(`${rules}:ability/${a}`);
          return (
            <div key={a} class="dm-ab-cell">
              <button
                type="button"
                class="dm-ab-check"
                title={ui("dm.rollCheck", { what: long })}
                onClick={() => rollForCreature(`${c.name}: ${long}`, mod)}
              >
                <small>{short}</small>
                <b>{signed(mod)}</b>
                <span>{score}</span>
              </button>
              <button
                type="button"
                class="dm-ab-save"
                data-proficient={m.saves?.[a] !== undefined || undefined}
                title={`${ui("sheet.savingThrow")}: ${long}`}
                onClick={() =>
                  rollForCreature(`${c.name}: ${ui("sheet.savingThrow")} (${short})`, save)
                }
              >
                {ui("dm.saveShort")} {signed(save)}
              </button>
            </div>
          );
        })}
      </div>
      {skills.length > 0 && (
        <div class="dm-skill-rolls">
          {skills.map(([slug, bonus]) => {
            const name = all.name(`${rules}:skill/${slug}`);
            return (
              <button
                type="button"
                key={slug}
                onClick={() => rollForCreature(`${c.name}: ${name}`, bonus)}
              >
                {name} {signed(bonus)}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
