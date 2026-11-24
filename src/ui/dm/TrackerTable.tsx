import {
  areaMode,
  areaPicks,
  cyclePick,
  encounter,
  infoFor,
  liveIds,
  removeFromFight,
  rollFlow,
  toggleRollTarget,
} from "../../app/dm";
import { type DmColumn, dmColumns, gridTemplate, visibleColumns } from "../../app/dmColumns";
import { typeText } from "../../app/monsterView";
import { content } from "../../app/store";
import { combatantNumbers, explainNumber } from "../../engine/combatantNumbers";
import {
  type Combatant,
  type Encounter,
  effectCount,
  groupOf,
  initiativeOrder,
  isDown,
  rollInitiative,
} from "../../engine/encounter";
import { type UiKey, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { DieIcon, ShieldIcon } from "../icons";
import { StarIcon } from "../play/icons";
import { AbilitiesCell } from "./Abilities";
import { CellPopover } from "./CellPopover";
import { EffectsEditor, HpEditor, InitEditor, conditionName } from "./Editors";

/** The second line under a name: what the creature is. */
export function kindLine(c: Combatant): string {
  if (c.lair) return ui("dm.lairKind");
  if (c.kind === "character") return ui("dm.kind.character");
  if (c.kind === "monster" && c.source) {
    const type = (content.value?.index.get(c.source)?.data as { type?: string } | undefined)?.type;
    return type ? typeText(type) : "";
  }
  return "";
}

/** The slugs of the conditions in force, separated by spaces: what the row's colours key on. */
function conditionSlugs(c: Combatant): string {
  return c.conditions
    .map((id) => id.split("/")[1])
    .filter(Boolean)
    .join(" ");
}

/**
 * The conditions and effects in force, as chips beside the name, each with the rounds it has left when it
 * has a limit (seen at a glance, without opening anything); touching them opens the editor.
 */
function InlineEffects({ c }: { c: Combatant }) {
  const chips = [
    ...c.conditions.map((id) => ({ key: id, name: conditionName(id), rounds: c.rounds[id] })),
    ...c.effects.map((x) => ({ key: x.id, name: x.name, rounds: x.rounds })),
  ];
  if (chips.length === 0) return null;
  return (
    <CellPopover
      title={ui("dm.editConditions", { name: c.name })}
      class="dm-inline-fx"
      trigger={chips.map((chip) => (
        <span
          key={chip.key}
          class="dm-fx-chip"
          title={
            chip.rounds !== undefined
              ? `${chip.name} · ${ui("play.roundsLeft", { n: chip.rounds })}`
              : undefined
          }
        >
          {chip.name}
          {chip.rounds !== undefined && <span class="dm-fx-chip-rounds">{chip.rounds}</span>}
        </span>
      ))}
    >
      {(close) => (
        <>
          <h4 class="dm-pop-title">{ui("play.activeEffects")}</h4>
          <EffectsEditor c={c} close={close} />
        </>
      )}
    </CellPopover>
  );
}

function EffectsCell({ c }: { c: Combatant }) {
  const n = effectCount(c);
  return (
    <CellPopover
      title={ui("dm.editConditions", { name: c.name })}
      class="dm-pill-button"
      trigger={
        <span class="dm-pill" data-on={n > 0 || undefined}>
          {n}
        </span>
      }
    >
      {(close) => (
        <>
          <h4 class="dm-pop-title">{ui("play.activeEffects")}</h4>
          <EffectsEditor c={c} close={close} />
        </>
      )}
    </CellPopover>
  );
}

export function HpCell({ c }: { c: Combatant }) {
  const { maxHp, parts } = combatantNumbers(c);
  const percent = maxHp > 0 ? Math.round((c.hp / maxHp) * 100) : 0;
  const state = c.hp === 0 ? "down" : percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well";
  return (
    <CellPopover
      title={ui("dm.editHp", { name: c.name })}
      class="dm-hp-button"
      trigger={
        <>
          <span class="dm-hp-num">
            <b>{c.hp}</b>
            <span
              data-changed={parts.hp.length > 0 || undefined}
              title={explainNumber(c.maxHp, parts.hp)}
            >
              / {maxHp}
            </span>
            {c.tempHp > 0 && <em>+{c.tempHp}</em>}
          </span>
          <span class="dm-hp-bar" data-state={state} aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </span>
        </>
      }
    >
      {(close) => <HpEditor c={c} close={close} />}
    </CellPopover>
  );
}

/** Initiative: a circle with the number, or a dashed circle with a die while it is not known. It opens the editor. */
function InitCell({ c }: { c: Combatant }) {
  const total = combatantNumbers(c).initiativeBonus;
  const bonus = total >= 0 ? `+${total}` : String(total);
  return (
    <CellPopover
      title={ui("dm.initEdit", { name: c.name })}
      class="dm-init-button"
      align="start"
      trigger={
        <span class="dm-init-circle" data-empty={c.initiative === undefined || undefined}>
          {c.initiative === undefined ? <DieIcon /> : c.initiative}
        </span>
      }
    >
      {(close) => (
        <InitEditor
          c={c}
          bonus={bonus}
          close={close}
          roll={() => rollInitiative(c).total}
          groupSize={encounter.value ? groupOf(encounter.value, c.id).length : 1}
        />
      )}
    </CellPopover>
  );
}

function Cell({ col, c, grouped }: { col: DmColumn; c: Combatant; grouped?: boolean }) {
  const numbers = combatantNumbers(c);
  const acChanged = numbers.ac !== c.ac;
  const acTitle = explainNumber(c.ac, numbers.parts.ac, { floor: numbers.floor });
  const speedChanged = numbers.speed !== c.speed;
  const speedTitle =
    c.speed === undefined
      ? ""
      : explainNumber(c.speed, numbers.parts.speed, { multiplier: numbers.multiplier });
  if (c.lair && col !== "init" && col !== "name")
    return (
      <td data-col={col} class="dm-num">
        —
      </td>
    );
  switch (col) {
    case "init":
      return (
        <td data-col="init">
          <InitCell c={c} />
        </td>
      );
    case "name": {
      const surprised = c.surprised && (encounter.value?.round ?? 0) <= 1;
      const sub = [
        // In a group the title line already says what the creature is.
        grouped ? "" : kindLine(c),
        surprised ? ui("dm.surprised") : "",
        isDown(c) && !c.lair ? ui("dm.down") : "",
      ]
        .filter(Boolean)
        .join(" · ");
      const live = liveIds.value.has(c.id);
      const label = live ? ui("dm.live") : ui("dm.manual");
      const player = c.kind === "character";
      const active = encounter.value?.turn === c.id && (encounter.value?.round ?? 0) > 0;
      return (
        <td data-col="name" class="dm-name">
          {/* The whole name opens the details of the creature. */}
          <button
            type="button"
            class="dm-name-button"
            title={ui("dm.info", { name: c.name })}
            aria-label={ui("dm.info", { name: c.name })}
            onClick={() => {
              infoFor.value = c.id;
            }}
          >
            {/* A character has a shield in a blue circle, the lair a star; a monster needs no mark. */}
            {(c.lair || player) && (
              <span
                class="dm-token"
                data-kind={c.lair ? "lair" : "player"}
                title={c.lair ? ui("dm.lairName") : ui("dm.kind.character")}
                aria-hidden="true"
              >
                {c.lair ? <StarIcon /> : <ShieldIcon />}
              </span>
            )}
            <span class="dm-name-line">
              <span class="dm-name-text">{c.name}</span>
              {player && (
                <span
                  class="dm-dot"
                  data-live={live || undefined}
                  role="img"
                  aria-label={label}
                  title={label}
                />
              )}
              {active && <span class="dm-now-tag">{ui("dm.activeTag")}</span>}
            </span>
            {sub && <span class="dm-sub">{sub}</span>}
          </button>
          <InlineEffects c={c} />
          <AbilitiesCell c={c} />
        </td>
      );
    }
    case "hp":
      return (
        <td data-col="hp">
          <HpCell c={c} />
        </td>
      );
    case "ac":
      return (
        <td data-col="ac" class="dm-num" data-changed={acChanged || undefined} title={acTitle}>
          {numbers.ac}
        </td>
      );
    case "speed":
      return (
        <td
          data-col="speed"
          class="dm-num"
          data-changed={speedChanged || undefined}
          title={speedTitle}
        >
          {numbers.speed !== undefined ? distance(numbers.speed) : "—"}
        </td>
      );
    case "cond":
      return (
        <td data-col="cond">
          <EffectsCell c={c} />
        </td>
      );
  }
}

/** In the area mode: not hit, hit in full, or hit by half because it saved. One tap goes on to the next. */
function PickButton({ id, name }: { id: string; name: string }) {
  // Rolling an action picks who it is against: one tap marks, the next lets go.
  const flow = rollFlow.value;
  const pick = flow ? (flow.targets.includes(id) ? "fail" : undefined) : areaPicks.value[id];
  const label = ui(
    pick === "fail" ? "dm.area.fail" : pick === "save" ? "dm.area.save" : "dm.area.none",
  );
  return (
    <button
      type="button"
      class="dm-pick"
      data-pick={pick}
      aria-label={`${name}: ${label}`}
      title={label}
      onClick={() => (flow ? toggleRollTarget(id) : cyclePick(id))}
    >
      {pick === "fail" ? "×" : pick === "save" ? "½" : ""}
    </button>
  );
}

/**
 * Monsters of one kind that act one after the other are a group: the first of them carries a title
 * line ("Goblin ×3 · humanoid"), and every one of them is marked as part of a run.
 */
function withGroups(order: readonly Combatant[]): { c: Combatant; group?: string; run: boolean }[] {
  const same = (a: Combatant | undefined, b: Combatant | undefined) =>
    Boolean(
      a && b && a.kind === "monster" && b.kind === "monster" && a.source && a.source === b.source,
    );
  return order.map((c, i) => {
    const run = same(c, order[i - 1]) || same(c, order[i + 1]);
    if (!run || same(c, order[i - 1])) return { c, run };
    let n = 1;
    while (same(c, order[i + n])) n++;
    const name = (c.source && content.value?.name(c.source)) || c.name;
    const kind = kindLine(c);
    return { c, run, group: [ui("dm.group", { name, n }), kind].filter(Boolean).join(" · ") };
  });
}

/** The initiative table: one row for each creature, in turn order, with what is read at a glance. */
export function TrackerTable({ e }: { e: Encounter }) {
  const columns = visibleColumns(dmColumns.value);
  const flow = rollFlow.value;
  const area = areaMode.value || flow !== undefined;
  // In the area mode a first column marks who is hit.
  const lead = area ? "2.8rem " : "";
  // The last column holds the cross that takes a creature out of the fight.
  const trail = " 2rem";
  const style = `--cols:${lead}${gridTemplate(columns)}${trail};--cols-narrow:${lead}${gridTemplate(columns, true)}${trail}`;
  const turn = encounter.value?.turn;
  const rows = withGroups(initiativeOrder(e.combatants));
  return (
    <div class="dm-table-wrap">
      <table class="dm-table" style={style}>
        <thead>
          <tr>
            {area && (
              <th data-col="pick" scope="col">
                <span class="sr-only">{ui("dm.area")}</span>
              </th>
            )}
            {columns.map((col) => (
              <th key={col} data-col={col} scope="col">
                {ui(`dm.col.${col}` as UiKey)}
              </th>
            ))}
            <th data-col="remove" scope="col">
              <span class="sr-only">{ui("dm.removeCombatant")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, group, run }) => [
            group && (
              <tr key={`group-${c.id}`} class="dm-group-head">
                <th scope="rowgroup" colSpan={columns.length + (area ? 2 : 1)}>
                  {group}
                </th>
              </tr>
            ),
            <tr
              key={c.id}
              data-grouped={run || undefined}
              data-active={c.id === turn || undefined}
              data-down={isDown(c) || undefined}
              data-kind={c.kind}
              data-conditions={conditionSlugs(c) || undefined}
              data-focus={c.effects.some((x) => x.concentration) || undefined}
              aria-current={c.id === turn ? "step" : undefined}
            >
              {area && (
                <td data-col="pick">
                  {!c.lair && c.id !== flow?.attackerId && <PickButton id={c.id} name={c.name} />}
                </td>
              )}
              {columns.map((col) => (
                <Cell key={col} col={col} c={c} grouped={run} />
              ))}
              <td data-col="remove">
                <button
                  type="button"
                  class="dm-remove"
                  title={`${ui("dm.removeCombatant")}: ${c.name}`}
                  aria-label={`${ui("dm.removeCombatant")}: ${c.name}`}
                  onClick={() => removeFromFight(c.id)}
                >
                  ×
                </button>
              </td>
            </tr>,
          ])}
        </tbody>
      </table>
    </div>
  );
}
