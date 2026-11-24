import { character, content, shownSheet } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import { signed, ui } from "../../i18n/ui";
import { ExplainButton } from "../Explain";
import { Roll } from "../Roll";
import { ChecksIcon } from "../play/icons";
import { Panel, Pip } from "./parts";

/** The six abilities in their colours: modifier, score and the saving throw (filled when proficient). */
export function AbilityTiles() {
  const c = content.value;
  const s = shownSheet.value;
  if (!c || !s) return null;
  const ruleset = character.value.ruleset;
  return (
    <section class="card ability-tiles">
      {ABILITIES.map((a) => (
        <div class="ability-tile" data-ability={a} key={a}>
          <span class="ability-name">{c.name(`${ruleset}:ability/${a}`)}</span>
          <Roll class="ability-mod">{signed(s.abilities[a].modifier)}</Roll>
          <Roll class="ability-score">{s.abilities[a].score}</Roll>
          <ExplainButton
            class={`ability-save${s.saves[a].proficient ? " proficient" : ""}`}
            target={{ kind: "save", ability: a }}
          >
            <span title={ui("sheet.savingThrow")}>{ui("sheet.saveShort")}</span>{" "}
            <b>{signed(s.saves[a].bonus)}</b>
            {s.saves[a].proficient && <span class="sr-only">{ui("sheet.proficient")}</span>}
          </ExplainButton>
        </div>
      ))}
    </section>
  );
}

/** Every skill in one list, each with the colour of its ability, over the passive numbers. */
export function Skills() {
  const c = content.value;
  const s = shownSheet.value;
  const ch = character.value;
  if (!c || !s) return null;
  const insight = s.skills.find((sk) => sk.id === `${ch.ruleset}:skill/insight`);
  const skills = [...s.skills].sort((x, y) => c.name(x.id).localeCompare(c.name(y.id)));

  return (
    <Panel title={ui("sheet.skills")} tint="profile" icon={ChecksIcon} className="skills-panel">
      <ul class="skill-list plain">
        {skills.map((sk) => (
          <li key={sk.id} data-ability={sk.ability} class={sk.proficient ? "proficient" : ""}>
            <ExplainButton target={{ kind: "skill", id: sk.id }}>
              <Pip on={sk.proficient} />
              <span class="skill-name">{c.name(sk.id)}</span>
              <small class="skill-ability">
                {c.text(`${ch.ruleset}:ability/${sk.ability}`, "abbreviation")}
              </small>
              <b class="bonus">{signed(sk.bonus)}</b>
            </ExplainButton>
          </li>
        ))}
      </ul>
      <dl class="senses">
        <div class="only-phone">
          <dt>{ui("sheet.proficiencyBonus")}</dt>
          <dd>{signed(s.proficiencyBonus)}</dd>
        </div>
        <div>
          <dt>{ui("sheet.passivePerception")}</dt>
          <dd>{s.passivePerception}</dd>
        </div>
        <div>
          <dt>{ui("sheet.passiveInsight")}</dt>
          <dd>{10 + (insight?.bonus ?? s.abilities.wis.modifier)}</dd>
        </div>
        <div title={ui("play.martialDc")}>
          <dt>{ui("quick.martialDc")}</dt>
          <dd>{s.martialSaveDc}</dd>
        </div>
      </dl>
    </Panel>
  );
}
