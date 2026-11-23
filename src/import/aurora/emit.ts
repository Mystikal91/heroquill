import type { Effect, Entry } from "../../data/schema";
import { type Context, type Source, ofType } from "./registry";

/** How a feature, trait or feat is used in play, as its sheet says (`action="Bonus Action"`). */
const ACTIVATIONS: Record<string, string> = {
  action: "action",
  "bonus action": "bonus",
  reaction: "reaction",
};
const ACTIVE_KINDS = new Set(["feature", "trait", "feat"]);

/** Adds an entry for an element, with its name and any other texts. */
export function emit(
  ctx: Context,
  source: Source,
  data: Record<string, unknown>,
  texts: Record<string, string | undefined> = {},
  extra: { effects?: Effect[]; parent?: string } = {},
): void {
  if (!source.id || !source.kind) return;
  const activation = ACTIVE_KINDS.has(source.kind)
    ? ACTIVATIONS[
        (source.el.querySelector(":scope > sheet")?.getAttribute("action") ?? "")
          .trim()
          .toLowerCase()
      ]
    : undefined;
  ctx.result.entries.push({
    id: source.id,
    kind: source.kind,
    ...(extra.parent && { parent: extra.parent }),
    effects: extra.effects ?? [],
    data: activation && data.activation === undefined ? { ...data, activation } : data,
  } as Entry);
  ctx.result.strings[`${source.id}.name`] = source.name;
  for (const [field, value] of Object.entries(texts)) {
    if (value) ctx.result.strings[`${source.id}.${field}`] = value;
  }
  if (source.source) ctx.result.sources.push(source.source);
}

/** The id of the class with this name: one the app has, or one this pack creates. */
export function classIdByName(ctx: Context, name: string): string | undefined {
  return classIdsByName(ctx, name)[0];
}

/**
 * Every class with this name: the one the app has, or all the ones this pack creates (the Artificer
 * of Eberron and the one of Tasha's are two classes with one name, and a spell lists both).
 */
export function classIdsByName(ctx: Context, name: string): string[] {
  const lower = name.trim().toLowerCase();
  const existing = ctx.existingByName.get(`class|${lower}`);
  if (existing) return [existing];
  return ofType(ctx, "Class")
    .filter((s) => s.name.toLowerCase() === lower && s.id)
    .map((s) => s.id as string);
}
