import { useState } from "preact/hooks";
import {
  challengeText,
  scoreText,
  sensesText,
  sizeText,
  speedText,
  typeText,
  usageText,
} from "../../app/monsterView";
import type { Usage } from "../../app/monsterView";
import { content } from "../../app/store";
import { ABILITIES } from "../../data/schema";
import type { ActionRolls } from "../../engine/monsterRolls";
import {
  type Owner,
  scaledArmorClass,
  scaledHitPoints,
  scaledPassivePerception,
  scaledSaves,
  scaledSkills,
} from "../../engine/scaling";
import { signed, ui } from "../../i18n/ui";
import { Paragraphs } from "../sheet/parts";
import { ActionButtons, playRoller, rollAttacks } from "./ActionButtons";

interface ArmorClass {
  type?: string;
  value: number;
  armor?: string[];
  spell?: string;
  condition?: string;
}

interface Action {
  usage?: Usage;
  attackBonus?: number;
  damage?: unknown;
  /** The attacks of a multiattack: the position of each action in the list, and how many times. */
  multiattack?: { action?: number; count: number }[];
}

/** What a monster entry holds; one that came from a file may lack any of it. */
interface MonsterData {
  size?: string;
  type?: string;
  swarm?: string;
  subtype?: string;
  armorClass?: ArmorClass[];
  hitPoints?: number;
  hitPointsRoll?: string;
  speed?: Record<string, number | true>;
  abilities?: Record<string, number>;
  saves?: Record<string, number>;
  skills?: Record<string, number>;
  conditionImmunities?: string[];
  senses?: Record<string, number>;
  blindBeyond?: string[];
  passivePerception?: number;
  challenge?: number;
  xp?: number;
  proficiencyBonus?: number;
  special?: Action[];
  actions?: Action[];
  bonusActions?: Action[];
  reactions?: Action[];
  legendary?: Action[];
}

const SECTIONS = [
  ["special", undefined],
  ["actions", "monster.actions"],
  ["bonusActions", "monster.bonusActions"],
  ["reactions", "monster.reactions"],
  ["legendary", "monster.legendary"],
] as const;

/** A creature the way a stat block prints it: facts first, then what it can do. */
export function MonsterBlock({
  id,
  owner,
  choose,
  compact,
}: {
  id: string;
  owner?: Owner;
  /**
   * The page around it shows the name, armor class, hit points, speed, abilities, saves and skills (the DM's sheet
   * of a creature): the block leaves them out and keeps the rest.
   */
  compact?: boolean;
  /** The Dungeon Master's table rolls an action in a window of its own: what to roll comes here instead of the history. */
  choose?: (action: string, rolls: ActionRolls) => void;
}) {
  // Which actions hit with a critical hit last, so that their damage is rolled doubled.
  const [crits, setCrits] = useState<Record<string, boolean>>({});
  const c = content.value;
  const entry = c?.index.get(id);
  if (!c || !entry) return null;
  const m = entry.data as unknown as MonsterData;
  // The names of abilities, skills and conditions are the rules' own, whatever pack the creature is in.
  const pack = id.split(":")[0] ?? "";
  const rules = /^srd\d+$/.test(pack) ? pack : "srd51";
  const name = (kind: string, slug: string) => c.name(`${rules}:${kind}/${slug}`);
  // A text the file wrote as it was (a formula of the level) wins over the numbers.
  const written = (field: string) => c.text(id, field);

  const armorText = (a: ArmorClass) => {
    const note =
      a.type === "natural"
        ? ui("monster.ac.natural")
        : a.armor
          ? a.armor.map((item) => c.name(item)).join(", ")
          : a.spell
            ? c.name(a.spell)
            : a.condition
              ? name("condition", a.condition)
              : undefined;
    return note ? `${a.value} (${note})` : String(a.value);
  };

  const kind = m.swarm
    ? ui("monster.swarmOfBeasts", { size: sizeText(m.swarm) })
    : [m.size && sizeText(m.size), m.type && typeText(m.type)].filter(Boolean).join(" ");
  const subtype = m.subtype ? ` (${m.subtype.replace(/-/g, " ")})` : "";
  const alignment = c.text(id, "alignment");
  const hitPoints =
    m.hitPoints === undefined
      ? undefined
      : m.hitPointsRoll
        ? `${m.hitPoints} (${m.hitPointsRoll.replace(/([+-])/, " $1 ")})`
        : String(m.hitPoints);

  // What grows with the owner is worked out for them, when there is one.
  const scaledAc = owner ? scaledArmorClass(entry, owner) : undefined;
  const scaledHp = owner ? scaledHitPoints(entry, owner) : undefined;
  const scaledSave = owner ? scaledSaves(entry, owner) : undefined;
  const scaledSkill = owner ? scaledSkills(entry, owner) : undefined;
  const scaledPassive = owner ? scaledPassivePerception(entry, owner) : undefined;
  const bonuses = (list: Record<string, number>, label: (slug: string) => string) =>
    Object.entries(list)
      .map(([slug, bonus]) => `${label(slug)} ${signed(bonus)}`)
      .join(", ");
  const abbreviation = (a: string) => c.text(`${rules}:ability/${a}`, "abbreviation") ?? a;

  const facts: [string, string | undefined][] = [
    [
      ui("monster.ac"),
      scaledAc !== undefined
        ? m.armorClass?.[0]?.type === "natural"
          ? `${scaledAc} (${ui("monster.ac.natural")})`
          : String(scaledAc)
        : (written("armorClass") ?? m.armorClass?.map(armorText).join(", ")),
    ],
    [
      ui("monster.hp"),
      scaledHp !== undefined ? String(scaledHp) : (written("hitPoints") ?? hitPoints),
    ],
    [ui("monster.speed"), written("speed") ?? (m.speed && speedText(m.speed))],
    [
      ui("monster.saves"),
      scaledSave
        ? bonuses(scaledSave, abbreviation)
        : (written("saves") ?? (m.saves && bonuses(m.saves, abbreviation))),
    ],
    [
      ui("monster.skills"),
      scaledSkill
        ? bonuses(scaledSkill, (skill) => name("skill", skill))
        : (written("skills") ?? (m.skills && bonuses(m.skills, (skill) => name("skill", skill)))),
    ],
    [ui("monster.vulnerabilities"), c.text(id, "vulnerabilities")],
    [ui("monster.resistances"), c.text(id, "resistances")],
    [ui("monster.immunities"), c.text(id, "immunities")],
    [
      ui("monster.conditionImmunities"),
      written("conditionImmunities") ??
        (m.conditionImmunities?.length
          ? m.conditionImmunities.map((x) => name("condition", x)).join(", ")
          : undefined),
    ],
    [
      ui("monster.senses"),
      scaledPassive !== undefined
        ? sensesText(m.senses ?? {}, m.blindBeyond, scaledPassive)
        : (written("senses") ?? sensesText(m.senses ?? {}, m.blindBeyond, m.passivePerception)),
    ],
    [ui("monster.languages"), c.text(id, "languages") || "—"],
    [
      ui("monster.challenge"),
      m.challenge === undefined
        ? undefined
        : m.xp === undefined
          ? challengeText(m.challenge)
          : `${challengeText(m.challenge)} (${ui("monster.xp", { n: m.xp.toLocaleString() })})`,
    ],
    [
      ui("monster.proficiencyBonus"),
      m.proficiencyBonus === undefined ? undefined : signed(m.proficiencyBonus),
    ],
  ];
  const scores = compact ? undefined : m.abilities;
  const shownFacts = compact ? facts.slice(5) : facts;

  return (
    <div class="rule-detail monster-block">
      {!compact && (
        <>
          <h3>{c.name(id)}</h3>
          <p class="muted monster-kind">
            {kind}
            {subtype}
            {alignment ? `, ${alignment}` : ""}
          </p>
        </>
      )}
      <dl class="monster-facts">
        {shownFacts
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {scores && (
        <ul class="monster-abilities" aria-label={ui("monster.abilityScores")}>
          {ABILITIES.map((a) => (
            <li key={a}>
              <b>{c.text(`${rules}:ability/${a}`, "abbreviation") ?? a}</b>
              <span>{scoreText(scores[a] ?? 10)}</span>
            </li>
          ))}
        </ul>
      )}
      {SECTIONS.map(([key, title]) => {
        const list = m[key];
        if (!list?.length) return null;
        return (
          <section key={key} class="monster-section">
            {title && <h4>{ui(title)}</h4>}
            {list.map((action, i) => {
              const prefix = `${id}.${key}.${i + 1}`;
              const [n, desc] = [c.text(prefix, "name"), c.text(prefix, "desc")];
              const usage = usageText(action.usage);
              return (
                <div key={prefix} class="monster-action">
                  <p>
                    <b>
                      {n}
                      {usage ? ` (${usage})` : ""}.
                    </b>{" "}
                    {desc?.split("\n\n")[0]}
                  </p>
                  {desc?.includes("\n\n") && (
                    <Paragraphs text={desc.split("\n\n").slice(1).join("\n\n")} />
                  )}
                  <ActionButtons
                    who={c.name(id)}
                    name={n ?? ""}
                    action={action}
                    owner={owner}
                    choose={choose}
                    critical={crits[`${key}.${i}`] ?? false}
                    onAttack={(hit) => setCrits((before) => ({ ...before, [`${key}.${i}`]: hit }))}
                  />
                  {key === "actions" &&
                    !choose &&
                    action.multiattack &&
                    action.multiattack.length > 0 && (
                      <div class="monster-rolls">
                        <button
                          type="button"
                          class="secondary"
                          onClick={() => {
                            const next = { ...crits };
                            for (const part of action.multiattack ?? []) {
                              const target = part.action ? m.actions?.[part.action - 1] : undefined;
                              if (!part.action || !target) continue;
                              next[`actions.${part.action - 1}`] = rollAttacks(
                                playRoller(c.name(id)),
                                c.text(`${id}.actions.${part.action}`, "name") ?? "",
                                target,
                                owner,
                                part.count,
                              );
                            }
                            setCrits(next);
                          }}
                        >
                          {ui("monster.rollAll")}
                        </button>
                      </div>
                    )}
                </div>
              );
            })}
          </section>
        );
      })}
      <Paragraphs text={c.text(id, "desc")} />
    </div>
  );
}
