import type { Entry } from "../data/schema";
import type { SourcedEffect } from "./choices";
import { MAX_CUSTOM_USES } from "./custom";

/** The most points a reserve can hold (a high-level psion has well over a hundred). */
const MAX_RESERVE = 9999;
import type { DerivedSheet } from "./derive";
import { type FeatureValueState, termNumber } from "./featureValues";
import { isHiddenByDefault, supersededBy } from "./replaced";
import type { ClassResource, ResourceRecovery } from "./resources";

/**
 * The spells that a feat or a species trait lets the character cast once between rests without a
 * slot, one resource for each. They come back after a long rest.
 */
export function deriveFreeSpells(
  sourced: SourcedEffect[],
  levelOf: (source: string) => number,
): ClassResource[] {
  const found = new Map<string, ClassResource>();
  for (const { effect, source } of sourced) {
    if (effect.type !== "grantSpell" || !effect.free) continue;
    if (effect.minLevel !== undefined && levelOf(source) < effect.minLevel) continue;
    const id = `free:${source}:${effect.spell}`;
    if (!found.has(id))
      found.set(id, {
        id,
        kind: "freeSpell",
        classId: "",
        entry: source,
        spell: effect.spell,
        max: 1,
        recovery: effect.rest ?? "long",
      });
  }
  return [...found.values()];
}

/**
 * What a person decided about one feature, trait or feat. `uses` is the number of times it can be
 * used between rests (0: no limit, whatever the data says) and takes the place of the data's;
 * `recharge` changes when they come back; `hidden` leaves it off the sheet (its effects stay).
 */
export interface FeatureSetting {
  uses?: number | undefined;
  recharge?: ResourceRecovery | undefined;
  hidden?: boolean | undefined;
}

/**
 * The limited uses that features and traits give through `uses` effects, one resource per entry.
 * The terms of an entry add up; those that come at a level replace one another (the latest one
 * the level has reached counts). An entry that works out to no uses gives nothing.
 */
export function deriveUses(
  sourced: SourcedEffect[],
  state: FeatureValueState,
  /** When the points of a reserve come back, as its own entry says (the effects of the sources otherwise). */
  reserveRecharge?: (reserve: string) => ResourceRecovery | undefined,
): ClassResource[] {
  const found = new Map<
    string,
    {
      sum: number;
      step?: { level: number; value: number };
      recovery: ResourceRecovery;
      pool: boolean;
      min: number;
      /** A reserve shared by name: the entries that add to it. */
      reserve?: string;
    }
  >();
  // Points added to a reserve by name are one resource, whoever gives them.
  const reserves = new Map<
    string,
    {
      sum: number;
      step: Map<string, { level: number; value: number }>;
      recovery: ResourceRecovery;
      min: number;
    }
  >();
  for (const { effect, source } of sourced) {
    if (effect.type !== "uses") continue;
    const level = effect.minLevel;
    if (level !== undefined && state.levelOf(source) < level) continue;
    if (effect.reserve) {
      const r = reserves.get(effect.reserve) ?? {
        sum: 0,
        step: new Map(),
        recovery: effect.recharge,
        min: 0,
      };
      reserves.set(effect.reserve, r);
      r.recovery = effect.recharge;
      if (effect.min !== undefined) r.min = Math.max(r.min, effect.min);
      const value = termNumber(effect.term, state, source);
      // The terms of one source that come at a level replace one another; the sources add up.
      if (level === undefined) r.sum += value;
      else {
        const at = r.step.get(source);
        if (!at || level >= at.level) r.step.set(source, { level, value });
      }
      continue;
    }
    const acc = found.get(source) ?? { sum: 0, recovery: effect.recharge, pool: false, min: 0 };
    found.set(source, acc);
    acc.recovery = effect.recharge;
    if (effect.pool) acc.pool = true;
    if (effect.min !== undefined) acc.min = Math.max(acc.min, effect.min);
    const value = termNumber(effect.term, state, source);
    if (level === undefined) acc.sum += value;
    else if (!acc.step || level >= acc.step.level) acc.step = { level, value };
  }
  const resources: ClassResource[] = [];
  for (const [source, acc] of found) {
    const total = Math.max(acc.min, acc.sum + (acc.step?.value ?? 0));
    const max = Math.min(Math.floor(total), MAX_CUSTOM_USES);
    if (max < 1) continue;
    resources.push({
      id: `uses:${source}`,
      kind: "feature",
      classId: "",
      entry: source,
      max,
      recovery: acc.recovery,
      ...(acc.pool && { pool: true }),
    });
  }
  for (const [reserve, r] of reserves) {
    const total = Math.max(r.min, r.sum + [...r.step.values()].reduce((a, b) => a + b.value, 0));
    const max = Math.min(Math.floor(total), MAX_RESERVE);
    if (max < 1) continue;
    resources.push({
      id: `reserve:${reserve}`,
      kind: "reserve",
      classId: "",
      reserve,
      max,
      recovery: reserveRecharge?.(reserve) ?? r.recovery,
      pool: true,
    });
  }
  return resources;
}

/**
 * Applies the settings of the person to a sheet: the uses they set replace those the data gives,
 * and the entries they hid are listed. Settings of entries the character does not have are ignored.
 * An entry that a better step of the same feature replaces (`superseded`), or that the data keeps
 * off the sheet (`hiddenByDefault`), is hidden too, unless the person turned it back on (`hidden: false`).
 */
export function withFeatureSettings(
  sheet: DerivedSheet,
  settings: Record<string, FeatureSetting> | undefined,
  index?: ReadonlyMap<string, Entry>,
): DerivedSheet {
  const superseded = index
    ? supersededBy([...sheet.traits, ...sheet.feats, ...sheet.features, ...sheet.held], index)
    : {};
  const have = new Set([...sheet.traits, ...sheet.feats, ...sheet.features]);
  // Hidden unless the person turned them on: the replaced steps, and what the data keeps off the sheet.
  const byDefault = index ? [...have].filter((id) => isHiddenByDefault(index.get(id))) : [];
  const replaced = [...new Set([...Object.keys(superseded), ...byDefault])].filter(
    (id) => settings?.[id]?.hidden !== false,
  );
  if (!settings) return { ...sheet, superseded, hiddenFeatures: replaced };
  let resources = sheet.resources;
  const hidden: string[] = [];
  for (const [id, setting] of Object.entries(settings)) {
    // A spell cast without a slot is set by its own id (`free:<entry>:<spell>`).
    const spell = resources.find((r) => r.id === id && r.spell !== undefined);
    if (spell) {
      resources = resources.filter((r) => r !== spell);
      const max = Math.min(setting.uses ?? spell.max, MAX_CUSTOM_USES);
      if (max > 0) resources.push({ ...spell, max, recovery: setting.recharge ?? spell.recovery });
      continue;
    }
    if (!have.has(id)) continue;
    if (setting.hidden && !hidden.includes(id)) hidden.push(id);
    if (setting.uses === undefined && setting.recharge === undefined) continue;
    const current = countedBy(resources, id);
    const max = Math.min(setting.uses ?? current?.max ?? 0, MAX_CUSTOM_USES);
    const recovery = setting.recharge ?? current?.recovery ?? "long";
    // What the class table works out keeps its id, so the uses already spent are kept too.
    resources = resources.filter((r) => r !== current);
    if (max > 0)
      resources.push(
        current
          ? { ...current, max, recovery, unlimited: false }
          : {
              id: `uses:${id}`,
              kind: "feature",
              classId: "",
              entry: id,
              max,
              recovery,
              ...(max > 8 && { pool: true }),
            },
      );
  }
  for (const id of replaced) if (!hidden.includes(id)) hidden.push(id);
  return { ...sheet, resources, superseded, hiddenFeatures: hidden };
}

/** The resource that counts the uses of an entry: its own, or a class one that stands for it. */
export function countedBy(resources: ClassResource[], id: string): ClassResource | undefined {
  const slug = id.split("/")[1] ?? id;
  return resources.find(
    (r) =>
      r.spell === undefined && (r.entry === id || (r.covers && new RegExp(r.covers).test(slug))),
  );
}
