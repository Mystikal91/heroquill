import type { Effect } from "../../data/schema";
import { classIdsByName } from "./emit";
import type { AuroraOptions, Context } from "./registry";
import { SRD_PAIRS } from "./registry";
import { is2024 } from "./repeats";
import { mapRules } from "./rules";
import { supportsOf } from "./xml";

/** What Aurora knows about an entry of the app that the entry does not: added to it, never replacing. */
export interface Overlay {
  /** Classes of the pack whose spell list holds this spell (see `addSpellClasses`). */
  spellClasses?: string[];
  effects?: Effect[];
  /** How the feature is used (`action`, `bonus`, `reaction`), when the entry does not say. */
  activation?: string;
}

const ACTIVATIONS: Record<string, string> = {
  action: "action",
  "bonus action": "bonus",
  reaction: "reaction",
};

/**
 * Numbers that Aurora writes wrong: the aura of a Devotion or Ancients paladin is 10 feet and
 * 30 at the 18th level, but the two terms have no kind of bonus, so they would add up to 40 (the
 * Aura of Protection of the class has them as `base` and is right).
 */
const AURORA_DATA_ERRORS = new Set(["aura of devotion:range", "aura of warding:range"]);

/**
 * The numbers a feature shows. A name with a word in it (the damage type of an ancestry) is left
 * out: the word is in the text and in the data of the SRD already.
 */
function plainFeatureValues(effects: Effect[]): Effect[] {
  const words = new Set(
    effects.flatMap((e) =>
      e.type === "featureValue" && typeof e.term === "object" && "text" in e.term ? [e.name] : [],
    ),
  );
  return effects.filter(
    (e) => e.type === "featureValue" && !words.has(e.name) && !AURORA_DATA_ERRORS.has(e.name),
  );
}

/**
 * What the elements of the Player's Handbook that are the entries of the app (see `srdPairs.json`)
 * say that the entries do not: the numbers a feature shows and how it is used. The entry of the
 * app keeps its text, its translations and what it already does; the pack carries these extras and
 * they are added when the content is put together, so removing the pack removes them.
 *
 * Only elements that pair with one entry are read: a feature the SRD splits by level (Brutal
 * Critical, Bardic Inspiration) pairs with several, and the same number would be shown on each.
 */
export function collectOverlays(ctx: Context, options: AuroraOptions): Record<string, Overlay> {
  const found: Record<string, Overlay> = {};
  for (const [aid, ids] of Object.entries(SRD_PAIRS)) {
    const id = ids.length === 1 ? ids[0] : undefined;
    const entry = id ? options.index.get(id) : undefined;
    const source = ctx.byAid.get(aid);
    // An element the pack makes for itself is not an entry of the app.
    if (!id || !entry || !source || ctx.needed.has(source)) continue;

    // Reading the rules counts what it cannot read: that is for the elements the pack makes.
    const real = ctx.result;
    ctx.result = { ...real, unsupportedRules: 0, unsupportedBy: {}, ruleKinds: {} };
    let mapped: Effect[];
    try {
      mapped = mapRules(ctx, source, { idPrefix: "overlay" }).effects;
    } finally {
      ctx.result = real;
    }

    const has = new Set(entry.effects.map((e) => JSON.stringify(e)));
    const names = new Set(
      entry.effects.flatMap((e) => (e.type === "featureValue" ? [e.name] : [])),
    );
    const effects = plainFeatureValues(mapped).filter(
      (e) => e.type === "featureValue" && !names.has(e.name) && !has.has(JSON.stringify(e)),
    );
    const action =
      ACTIVATIONS[
        (source.el.querySelector(":scope > sheet")?.getAttribute("action") ?? "")
          .trim()
          .toLowerCase()
      ];
    const activation = (entry.data as { activation?: string }).activation ? undefined : action;
    if (effects.length === 0 && !activation) continue;
    found[id] = { ...(effects.length > 0 && { effects }), ...(activation && { activation }) };
  }
  addSpellClasses(ctx, options, found);
  return found;
}

/**
 * The spells of the SRD that a book puts on the list of one of its own classes (the Artificer's cure
 * wounds): the SRD spell does not know the class, so the pack carries the class and the spell takes it
 * when the content is put together. Only the classes the pack makes are added (the lists of the SRD's
 * own classes stay as they are) and only from the books of 2014.
 */
function addSpellClasses(
  ctx: Context,
  options: AuroraOptions,
  found: Record<string, Overlay>,
): void {
  const classes = new Set(ctx.result.entries.filter((e) => e.kind === "class").map((e) => e.id));
  for (const [aid, id] of Object.entries(ctx.result.existing)) {
    const entry = options.index.get(id);
    const source = ctx.byAid.get(aid);
    if (entry?.kind !== "spell" || source?.type !== "Spell" || is2024(source)) continue;
    const known = (entry.data.classes as string[] | undefined) ?? [];
    const added = supportsOf(source.el)
      .flatMap((name) => classIdsByName(ctx, name))
      .filter((c) => classes.has(c) && !known.includes(c));
    if (added.length === 0) continue;
    const spellClasses = [...new Set([...(found[id]?.spellClasses ?? []), ...added])].sort();
    found[id] = { ...found[id], spellClasses };
  }
}
