import type { JSX } from "preact";
import { houseRules, setHouseRule } from "../app/houseRules";
import { leavePage } from "../app/navigation";
import { HOUSE_RULES, type HouseRule } from "../engine/houseRules";
import { type UiKey, ui } from "../i18n/ui";
import { CrownIcon, HeartIcon } from "./icons";
import { ConditionIcon, CriticalIcon, FlameIcon, HealIcon, MoonIcon, StarIcon } from "./play/icons";
import "./houseRules.css";

/** What each rule touches, and the sign of its card. */
const RULE_LOOK: Record<HouseRule, { area: UiKey; icon: () => JSX.Element }> = {
  quickRests: { area: "house.area.rests", icon: FlameIcon },
  restOnLevelUp: { area: "house.area.rests", icon: MoonIcon },
  crunchyCrits: { area: "house.area.attacks", icon: CriticalIcon },
  potionBonusAction: { area: "house.area.items", icon: HealIcon },
  levelOneFeat: { area: "house.area.build", icon: StarIcon },
  maxHitPoints: { area: "house.area.build", icon: HeartIcon },
  freeMulticlass: { area: "house.area.build", icon: CrownIcon },
  modernExhaustion: { area: "house.area.conditions", icon: ConditionIcon },
};

function RuleCard({ rule }: { rule: HouseRule }) {
  const on = houseRules.value[rule] === true;
  const look = RULE_LOOK[rule];
  const title = ui(`house.${rule}.title` as UiKey);
  const id = `house-rule-${rule}`;
  return (
    <li class="house-rule" data-on={on || undefined}>
      <div class="house-rule-head">
        <span class="house-rule-badge" aria-hidden="true">
          <look.icon />
        </span>
        <div class="house-rule-name">
          <label for={id}>{title}</label>
          <small class="muted">{ui(look.area)}</small>
        </div>
        <input
          id={id}
          type="checkbox"
          role="switch"
          class="house-switch"
          checked={on}
          aria-checked={on}
          onChange={(e) => setHouseRule(rule, e.currentTarget.checked)}
        />
      </div>
      <p class="house-rule-text">{ui(`house.${rule}.body` as UiKey)}</p>
      <div class="house-rule-compare">
        <div>
          <b>{ui("house.book")}</b>
          <span>{ui(`house.${rule}.book` as UiKey)}</span>
        </div>
        <div>
          <b>{ui("house.withRule")}</b>
          <span>{ui(`house.${rule}.with` as UiKey)}</span>
        </div>
      </div>
    </li>
  );
}

/** The house rules of the table: switches that change what the book gives, each explained with an example. */
export function HouseRulesPage() {
  return (
    <article class="card about house-rules">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("house.title")}</h2>
      <p class="muted">{ui("house.intro")}</p>
      <ul class="plain house-rule-list">
        {HOUSE_RULES.map((rule) => (
          <RuleCard key={rule} rule={rule} />
        ))}
      </ul>
    </article>
  );
}
