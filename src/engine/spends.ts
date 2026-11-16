import type { SpendPool } from "../data/schema";
import type { PlayState } from "./character";
import type { SourcedEffect } from "./choices";
import { resourceLeft, setResourceUsed } from "./play";
import type { ClassResource } from "./resources";

/** What a feature takes from a pool of the class when it is used, and which counter that is. */
export interface Spend {
  /** The entry (feature, trait, feat) that is used. */
  entry: string;
  pool: SpendPool | undefined;
  /** The reserve of the pack it takes from, when it is not a pool of a class. */
  reserve?: string;
  /** How many points or uses it takes. */
  cost: number;
  /** The counter of the character it takes them from (`ClassResource.id`). */
  resource: string;
}

/**
 * The pool each feature spends from. The counter is the one of the class that gives the feature
 * (a cleric and a paladin each have their own Channel Divinity), or else the first of that kind; a
 * feature whose pool the character does not have gives nothing.
 */
export function deriveSpends(
  sourced: SourcedEffect[],
  resources: ClassResource[],
  classOf: (entry: string) => string | undefined,
): Record<string, Spend> {
  const found: Record<string, Spend> = {};
  for (const { effect, source } of sourced) {
    if (effect.type !== "spends" || found[source]) continue;
    const ofKind = effect.reserve
      ? resources.filter((r) => r.reserve === effect.reserve)
      : resources.filter((r) => r.kind === effect.pool);
    const own = classOf(source);
    const resource = ofKind.find((r) => r.classId === own) ?? ofKind[0];
    if (!resource) continue;
    found[source] = {
      entry: source,
      pool: effect.pool,
      ...(effect.reserve && { reserve: effect.reserve }),
      cost: effect.cost ?? 1,
      resource: resource.id,
    };
  }
  return found;
}

/** Whether the pool holds enough for one use of the feature. */
export function canSpend(play: PlayState, spend: Spend, resources: ClassResource[]): boolean {
  const pool = resources.find((r) => r.id === spend.resource);
  return pool !== undefined && resourceLeft(play, pool.id, pool.max) >= spend.cost;
}

/** Takes the cost of one use from the pool; nothing changes when it does not hold enough. */
export function spendPool(play: PlayState, spend: Spend, resources: ClassResource[]): PlayState {
  const pool = resources.find((r) => r.id === spend.resource);
  if (!pool || !canSpend(play, spend, resources)) return play;
  return setResourceUsed(
    play,
    pool.id,
    (play.resourcesUsed?.[pool.id] ?? 0) + spend.cost,
    pool.max,
  );
}
