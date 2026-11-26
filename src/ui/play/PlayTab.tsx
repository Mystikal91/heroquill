import type { ComponentChildren } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import {
  type Columns,
  canHide,
  customizing,
  isArranged,
  keepHidden,
  moveTo,
  nudge,
  playLayout,
  setPlayLayout,
} from "../../app/playLayout";
import { conditionTint, playStates, stateAttributes } from "../../app/playStates";
import { type PlayGroup, playGroup, showPlayGroup } from "../../app/playView";
import { character, content, sheet } from "../../app/store";
import { ACTIVATIONS, characterActions } from "../../engine/actions";
import { visibleSlots } from "../../engine/slots";
import { type UiKey, ui } from "../../i18n/ui";
import { CoinsPanel } from "../Coins";
import { collectSpellRows } from "../spellRows";
import { neighbour, useSwipe } from "../useSwipe";
import { ActionsPanel } from "./Actions";
import { AddEffectDialog } from "./ActiveEffects";
import { BeastStrip } from "./BeastStrip";
import { CastDialog } from "./CastDialog";
import { Companions } from "./Companions";
import { Conditions } from "./Conditions";
import { CustomizeButton, CustomizeToolbar, HiddenPanels, PanelBar } from "./Customize";
import { DiceButton, DiceDrawer } from "./DiceDrawer";
import { PlayFeatures, shownFeatures } from "./Features";
import { BardNotes } from "./Inspiration";
import { PlayInventory } from "./Inventory";
import { MoreStatsDialog } from "./MoreStats";
import { PrepareSpellsDialog } from "./PrepareSpells";
import { QuickStats } from "./QuickStats";
import { Rage, RageStrip } from "./Rage";
import { ClassResources, PlayNotes, Slots } from "./Resources";
import { Rests } from "./Rests";
import { AttackRolls, CheckRolls, ModePicker } from "./Rolls";
import { PlaySpells } from "./SpellList";
import { GroupTabs, StatusBar } from "./StatusBar";
import { TableStrip } from "./TableStrip";
import { DeathSaves, HitDice, HitPoints } from "./Vitals";
import { WildShape } from "./WildShape";
import { type LayoutFacts, arrange, columnsUsed, estimateHeights } from "./columns";
import { beginDrag } from "./drag";

/**
 * A panel and the part of the screen it belongs to. On a phone only the part that is open is
 * shown and `order` says where each panel sits in it; on a wide screen every part is shown.
 */
const Part = ({
  panel,
  group,
  order,
  children,
}: {
  panel: string;
  group: PlayGroup;
  order: number;
  children: ComponentChildren;
}) => (
  <div class="pg" data-panel={panel} data-g={group} style={{ "--o": order }}>
    {children}
  </div>
);

type PanelKey =
  | "hp"
  | "rage"
  | "death"
  | "hitdice"
  | "rests"
  | "classres"
  | "coins"
  | "inventory"
  | "conditions"
  | "companions"
  | "features"
  | "notes"
  | "attacks"
  | "actions"
  | "checks"
  | "slots"
  | "spells";

interface PanelDef {
  group: PlayGroup;
  order: number;
  render: () => ComponentChildren;
}

/**
 * Every panel of the screen, with the part of the phone it belongs to and where it sits in it. The
 * keys are in the order a phone shows them when two panels have the same place.
 */
const PANELS: Record<PanelKey, PanelDef> = {
  hp: { group: "combat", order: 1, render: () => <HitPoints /> },
  rage: {
    group: "combat",
    order: 4,
    render: () => (
      <>
        <Rage />
        <WildShape />
      </>
    ),
  },
  death: { group: "combat", order: 2, render: () => <DeathSaves /> },
  hitdice: { group: "resources", order: 2, render: () => <HitDice /> },
  rests: { group: "resources", order: 3, render: () => <Rests /> },
  classres: { group: "resources", order: 1, render: () => <ClassResources /> },
  coins: { group: "resources", order: 5, render: () => <CoinsPanel /> },
  inventory: { group: "resources", order: 4, render: () => <PlayInventory /> },
  conditions: { group: "combat", order: 3, render: () => <Conditions /> },
  companions: { group: "combat", order: 8, render: () => <Companions /> },
  features: { group: "resources", order: 6, render: () => <PlayFeatures /> },
  notes: { group: "resources", order: 7, render: () => <PlayNotes /> },
  attacks: { group: "combat", order: 6, render: () => <AttackRolls /> },
  actions: { group: "combat", order: 7, render: () => <ActionsPanel /> },
  checks: { group: "checks", order: 1, render: () => <CheckRolls /> },
  slots: { group: "magic", order: 1, render: () => <Slots /> },
  spells: { group: "magic", order: 2, render: () => <PlaySpells /> },
};

/** What the character has, for the estimate of how tall each panel is (see `columns.ts`). */
function layoutFacts(
  c: NonNullable<typeof content.value>,
  s: NonNullable<typeof sheet.value>,
): LayoutFacts {
  const inventory = character.value.inventory;
  const actions = characterActions(s, c.index);
  const shown = shownFeatures(c, s);
  return {
    attacks: s.attacks.length + (s.unarmed ? 1 : 0),
    extraDamage: s.extraDamage.length,
    actionCards: ACTIVATIONS.reduce((n, a) => n + actions[a].length, 0),
    actionGroups: ACTIVATIONS.filter((a) => actions[a].length > 0).length,
    hitDiceKinds: Object.keys(s.hitPoints.hitDice).length,
    resources: s.resources.length + s.facts.length,
    features: shown.class.length + shown.species.length + shown.feat.length,
    companions: character.value.companions?.length ?? 0,
    tiles: visibleSlots(inventory, c.index).length,
    pack: inventory.filter((i) => !i.equipped).length,
    spells: collectSpellRows(c, s).length,
    rage: s.extraDamage.some((x) => x.kind === "rage"),
    wildShape: s.facts.some((f) => f.kind === "wildShape"),
    bardic: s.facts.some((f) => f.kind === "bardicDie"),
  };
}

/** How many columns the play screen has room for: the same breakpoints as the styles (42 and 66rem). */
const columnsFor = (rem: number): 1 | 2 | 3 => (rem >= 66 ? 3 : rem >= 42 ? 2 : 1);

/** Follows the width of the screen and says how many columns it has room for. */
function useColumns(root: { current: HTMLElement | null }, ready: boolean): 1 | 2 | 3 {
  const [columns, setColumns] = useState<1 | 2 | 3>(() =>
    columnsFor(typeof innerWidth === "number" ? innerWidth / 16 : 0),
  );
  useLayoutEffect(() => {
    const el = root.current;
    if (!el || !ready) return;
    const measure = () => {
      const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setColumns(columnsFor(el.getBoundingClientRect().width / rem));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [root, ready]);
  return columns;
}

/**
 * The screen for the table. On a wide screen the panels are in two or three columns of about the
 * same height (see `columns.ts`). On a phone it is split into parts (combat, checks, magic,
 * resources) behind tabs, under a bar that always shows hit points and armor class.
 */
export function PlayTab() {
  const c = content.value;
  const s = sheet.value;
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const parts = useRef<{ groups: PlayGroup[]; open: PlayGroup }>({
    groups: [],
    open: "combat",
  });
  useSwipe(
    root,
    () => {
      const head = root.current?.querySelector(".play-head");
      return head ? getComputedStyle(head).display !== "none" : false;
    },
    (delta) => {
      const next = neighbour(parts.current.groups, parts.current.open, delta);
      if (next) showPlayGroup(next);
      return next !== undefined;
    },
  );
  const room = useColumns(root, Boolean(c && s));
  if (!c || !s) return null;
  const hasMagic = s.spellcasters.length > 0 || collectSpellRows(c, s).length > 0;
  const groups: PlayGroup[] = hasMagic
    ? ["combat", "checks", "magic", "resources"]
    : ["combat", "checks", "resources"];
  // A part that is not there (no magic) opens the first one.
  const open = groups.includes(playGroup.value) ? playGroup.value : "combat";
  parts.current = { groups, open };

  // The panels the character has and the person has not hidden, in the columns they asked for.
  const facts = layoutFacts(c, s);
  const present = (key: string) => {
    const panel = PANELS[key as PanelKey];
    if (!panel) return false;
    if (panel.group === "magic") return hasMagic;
    return key !== "rage" || facts.rage || facts.wildShape;
  };
  const layout = playLayout.value;
  const count = columnsUsed(layout.wanted, room);
  const columns = arrange(count, layout, estimateHeights(facts), present);
  const arranging = customizing.value;
  // The phone follows the order the person set; without one, the order made for each part.
  const line = columns.flat();
  const orderOf = (key: string) =>
    count === 1 && isArranged(layout)
      ? line.indexOf(key) + 1
      : (PANELS[key as PanelKey]?.order ?? 0);
  const arrangeNow = (change: (cols: Columns) => Columns) =>
    setPlayLayout({
      ...layout,
      layouts: {
        ...layout.layouts,
        [count]: keepHidden(layout.layouts[count], change(columns), layout.hidden),
      },
    });
  const moves = (key: string) => {
    // On a phone a panel moves among the ones of its own part: the others are on other tabs.
    const group = PANELS[key as PanelKey]?.group;
    const accept = count === 1 ? (o: string) => PANELS[o as PanelKey]?.group === group : undefined;
    const to = (dir: "up" | "down" | "left" | "right") => nudge(columns, key, dir, accept);
    return { to, can: (dir: "up" | "down" | "left" | "right") => to(dir) !== columns };
  };
  const hiddenNow = layout.hidden.filter((key) => present(key) && canHide(key));

  // What the character is going through colours the screen: an aura at its edges, and the cards.
  const states = stateAttributes(playStates(character.value.play, s.hitPoints.max));
  // A condition written in a pack can have a colour of its own: it glows in it.
  const tint = conditionTint(
    character.value.play,
    (id) => (content.value?.index.get(id)?.data as { color?: string } | undefined)?.color,
  );

  return (
    <>
      <div
        class="play-aura"
        aria-hidden="true"
        {...states}
        style={tint ? { "--aura": tint } : undefined}
      >
        {states["data-bardic"] && <BardNotes />}
      </div>
      <div
        class="play"
        data-group={open}
        data-form={character.value.play.wildShape ? "beast" : undefined}
        data-rage={character.value.play.raging ? "on" : undefined}
        {...states}
        ref={root}
      >
        <div class="play-head">
          <RageStrip />
          <BeastStrip />
          <StatusBar />
          <div class="play-groups-row">
            <GroupTabs groups={groups} />
            <DiceButton inHead />
            {!arranging && <CustomizeButton />}
          </div>
          {(open === "combat" || open === "checks") && (
            <div class="head-mode">
              <ModePicker />
            </div>
          )}
        </div>
        <TableStrip />
        <QuickStats>{!arranging && <CustomizeButton />}</QuickStats>
        <MoreStatsDialog />
        <AddEffectDialog />
        <RageStrip wide />
        <BeastStrip wide />
        {arranging && (
          <CustomizeToolbar
            count={count}
            choice={room === 3}
            arranged={layout.layouts[count] !== undefined}
            onChoice={(wanted) => setPlayLayout({ ...layout, wanted })}
            onReset={() => {
              const { [count]: _, ...rest } = layout.layouts;
              setPlayLayout({ ...layout, layouts: rest });
            }}
          />
        )}
        <div class="play-grid" data-cols={count} data-arranging={arranging || undefined} ref={grid}>
          {columns.map((keys, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place on the screen
            <div class="play-col" key={i}>
              {keys.map((key) => {
                const panel = PANELS[key as PanelKey];
                const { to, can } = moves(key);
                return (
                  <Part key={key} panel={key} group={panel.group} order={orderOf(key)}>
                    {arranging ? (
                      <PanelBar
                        panel={key}
                        columns={count > 1}
                        can={{
                          up: can("up"),
                          down: can("down"),
                          left: can("left"),
                          right: can("right"),
                        }}
                        onMove={(dir) => arrangeNow(() => to(dir))}
                        onGrab={(e) => {
                          if (!grid.current || (e.pointerType === "mouse" && e.button !== 0))
                            return;
                          e.preventDefault();
                          beginDrag(e, {
                            grid: grid.current,
                            panel: key,
                            label: ui(`play.panel.${key}` as UiKey),
                            onDrop: (col, at) => {
                              const next = moveTo(columns, key, col, at);
                              // Dropped where it was: nothing to save.
                              if (JSON.stringify(next) !== JSON.stringify(columns)) {
                                arrangeNow(() => next);
                              }
                            },
                          });
                        }}
                        onHide={() => setPlayLayout({ ...layout, hidden: [...layout.hidden, key] })}
                      />
                    ) : (
                      panel.render()
                    )}
                  </Part>
                );
              })}
            </div>
          ))}
        </div>
        {arranging && (
          <HiddenPanels
            panels={hiddenNow}
            onShow={(key) =>
              setPlayLayout({ ...layout, hidden: layout.hidden.filter((k) => k !== key) })
            }
            onShowAll={() => setPlayLayout({ ...layout, hidden: [] })}
          />
        )}
        <DiceButton />
        <DiceDrawer />
        <PrepareSpellsDialog />
        <CastDialog />
      </div>
    </>
  );
}
