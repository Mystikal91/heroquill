import { changePlay, healFromFeature, rollDiceText } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import {
  ACTIVATIONS,
  type Activation,
  breathWeaponOf,
  characterActions,
  healExpression,
} from "../../engine/actions";
import { resourceLeft, setResourceUsed } from "../../engine/play";
import { type ClassResource, resourcesByEntry } from "../../engine/resources";
import { canSpend, spendPool } from "../../engine/spends";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { reserveName } from "../reserveName";
import { ruleDetail } from "../rules/EntryDetail";
import { Panel } from "../sheet/parts";
import { ResourceControl } from "./ResourceControl";
import { CombatIcon, SaveIcon, StarIcon } from "./icons";

const ICON = { action: CombatIcon, bonus: StarIcon, reaction: SaveIcon } as const;

/** The actions anyone can take, by what they cost: a line of the rules for each. */
const BASIC: Record<Activation, string[]> = {
  action: ["attack", "dash", "disengage", "dodge", "help", "hide", "ready", "search", "useObject"],
  bonus: [],
  reaction: ["opportunity"],
};

const DAMAGE_TYPES_KEY = (type: string) => `hb.o.${type}` as UiKey;

/** The first paragraph of a text, for the line under the name. */
const preview = (text: string | undefined) => (text ?? "").split("\n\n")[0] ?? "";

/** One feature that takes an action: what it costs, a button to use it, and what it rolls. */
function ActionCard({
  id,
  activation,
  counters,
}: {
  id: string;
  activation: Activation;
  counters: ClassResource[];
}) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const play = character.value.play;
  const Icon = ICON[activation];
  const name = c.name(id);
  const spend = s.spends[id];
  const pool = spend && s.resources.find((r) => r.id === spend.resource);
  const single = counters.length === 1 ? counters[0] : undefined;
  const takesUse = !spend && single && !single.pool && !single.unlimited ? single : undefined;
  const holdsBreath = (c.index.get(id)?.data as { traitSpecific?: { breathWeapon?: unknown } })
    ?.traitSpecific?.breathWeapon;
  const breath =
    id === "srd51:trait/breath-weapon" || holdsBreath ? breathWeaponOf(s, c.index) : undefined;
  const heal = s.selfHeals[id];

  let usable = true;
  let left = 0;
  let total = 0;
  if (spend && pool) {
    usable = canSpend(play, spend, s.resources);
    left = resourceLeft(play, pool.id, pool.max);
    total = pool.max;
  } else if (takesUse) {
    left = resourceLeft(play, takesUse.id, takesUse.max);
    total = takesUse.max;
    usable = left > 0;
  }
  const use = () => {
    if (spend && pool) changePlay((p) => spendPool(p, spend, s.resources));
    else if (takesUse)
      changePlay((p) =>
        setResourceUsed(p, takesUse.id, (p.resourcesUsed?.[takesUse.id] ?? 0) + 1, takesUse.max),
      );
  };

  const typeName = breath?.damageType ? ui(DAMAGE_TYPES_KEY(breath.damageType)).toLowerCase() : "";
  const breathInfo = breath
    ? [
        ui("play.spellSave", {
          dc: breath.dc,
          ability: c.name(`${character.value.ruleset}:ability/${breath.save}`),
        }),
        `${ui(`spells.area.${breath.area.type}` as UiKey)} ${distance(breath.area.size)}`,
      ].join(" · ")
    : "";

  return (
    <li class="play-card action-card" data-activation={activation}>
      <span class="card-badge" aria-hidden="true">
        <Icon />
      </span>
      <div class="card-head">
        <button
          type="button"
          class="link card-name"
          aria-label={`${ui("spells.info")}: ${name}`}
          onClick={() => {
            ruleDetail.value = id;
          }}
        >
          {name}
        </button>
        <span class="card-meta">{breathInfo || preview(c.text(id, "desc"))}</span>
      </div>
      {(spend || takesUse || breath || heal || counters.length > 0) && (
        <div class="card-actions action-actions">
          {(spend || takesUse) && (
            <button
              type="button"
              class="card-btn card-primary action-use"
              data-cost={spend && pool ? "" : undefined}
              disabled={!usable}
              onClick={use}
            >
              <span>{ui("play.actionUse")}</span>
              {spend && pool && (
                <small>
                  {ui("play.actionCost", {
                    cost: `−${spend.cost}`,
                    pool: spend.reserve
                      ? reserveName(spend.reserve).toLowerCase()
                      : ui(`resource.${spend.pool}` as UiKey).toLowerCase(),
                  })}
                </small>
              )}
              <b>{ui("play.slotLeft", { left, total })}</b>
            </button>
          )}
          {heal && (
            <button
              type="button"
              class="card-btn card-roll card-heal"
              disabled={!usable}
              onClick={() => {
                use();
                healFromFeature(name, heal);
              }}
            >
              <b>{ui("play.actionHeal", { amount: healExpression(heal) })}</b>
            </button>
          )}
          {breath && (
            <button
              type="button"
              class="card-btn card-roll card-damage"
              data-damage={breath.damageType}
              onClick={() => rollDiceText(`${name} - ${ui("play.damageRoll")}`, breath.dice)}
            >
              <b>{breath.dice}</b>
              <small>{typeName}</small>
            </button>
          )}
          {/* A feature with uses of its own that the button does not spend: tick them off here. */}
          {!spend &&
            counters.length > 0 &&
            counters.filter((r) => r !== takesUse).map((r) => <ResourceControl key={r.id} r={r} />)}
        </div>
      )}
    </li>
  );
}

/** The actions anyone can take, said in a line each, closed until it is wanted. */
function BasicActions() {
  return (
    <details class="base-actions">
      <summary>{ui("play.actionsBasic")}</summary>
      {ACTIVATIONS.filter((a) => BASIC[a].length > 0).map((a) => (
        <section key={a}>
          <h5>{ui(`feature.activation.${a}` as UiKey)}</h5>
          <dl>
            {BASIC[a].map((key) => (
              <div key={key}>
                <dt>{ui(`action.${key}` as UiKey)}</dt>
                <dd>{ui(`action.${key}.desc` as UiKey, { reach: distance(5) })}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </details>
  );
}

/** Everything the character can do with an action, a bonus action or a reaction, in one place. */
export function ActionsPanel() {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const found = characterActions(s, c.index);
  const byEntry = resourcesByEntry(s.resources);

  return (
    <Panel title={ui("play.actions")} className="actions-panel">
      {ACTIVATIONS.filter((a) => found[a].length > 0).map((a) => (
        <section class="card-group" key={a}>
          <header class="card-group-head">
            <h4>{ui(`feature.activation.${a}` as UiKey)}</h4>
          </header>
          <ul class="plain card-list">
            {[...found[a]]
              .sort((x, y) => c.name(x).localeCompare(c.name(y)))
              .map((id) => (
                <ActionCard key={id} id={id} activation={a} counters={byEntry.get(id) ?? []} />
              ))}
          </ul>
        </section>
      ))}
      <BasicActions />
    </Panel>
  );
}
