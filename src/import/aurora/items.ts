import type { Effect } from "../../data/schema";
import { classIdsByName, emit } from "./emit";
import type { Context, Source } from "./registry";
import { mapRules } from "./rules";
import {
  description,
  number,
  paragraphs,
  parseCost,
  parseWeight,
  setters,
  slugify,
  supportsOf,
} from "./xml";

const PROPERTY_ALIASES: Record<string, string> = { twohanded: "two-handed" };

export function importSpell(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const classes = supportsOf(source.el).flatMap((name) => classIdsByName(ctx, name));
  const components = [
    set.get("hasVerbalComponent")?.text === "true" && "V",
    set.get("hasSomaticComponent")?.text === "true" && "S",
    set.get("hasMaterialComponent")?.text === "true" && "M",
  ].filter(Boolean);

  const text = paragraphs(source.el.querySelector(":scope > description"));
  const higherIndex = text.findIndex((p) => /^at higher levels\.?/i.test(p));
  const higher = higherIndex >= 0 ? text.splice(higherIndex, 1)[0] : undefined;

  emit(
    ctx,
    source,
    {
      level: number(set.get("level")?.text ?? "") ?? 0,
      school: slugify(set.get("school")?.text ?? ""),
      components,
      ritual: set.get("isRitual")?.text === "true",
      concentration: set.get("isConcentration")?.text === "true",
      classes,
    },
    {
      desc: text.join("\n\n"),
      higherLevel: higher?.replace(/^at higher levels\.?\s*/i, ""),
      castingTime: set.get("time")?.text,
      range: set.get("range")?.text,
      duration: set.get("duration")?.text,
      material: set.get("materialComponent")?.text,
    },
  );
}

export function importWeapon(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const supports = supportsOf(source.el);
  const text = supports.join(" ");
  // A firearm with no other category is a martial ranged weapon.
  const category =
    text.match(/WEAPON_CATEGORY_(SIMPLE|MARTIAL)_(MELEE|RANGED)/) ??
    (/WEAPON_CATEGORY_FIREARM/.test(text) ? ["", "MARTIAL", "RANGED"] : null);
  if (!category) {
    ctx.result.skipped.Weapon = (ctx.result.skipped.Weapon ?? 0) + 1;
    return;
  }
  const weaponCategory = category[1]?.toLowerCase() as "simple" | "martial";
  const kind = category[2]?.toLowerCase() as "melee" | "ranged";
  const properties = supports
    .map((s) => s.match(/^ID_INTERNAL_WEAPON_PROPERTY_([A-Z]+)$/)?.[1]?.toLowerCase())
    .filter((p): p is string => Boolean(p))
    .map((p) => `srd51:property/${PROPERTY_ALIASES[p] ?? p}`)
    .filter((id) => ctx.options.index.has(id));

  const dice = set.get("damage")?.text ?? "";
  const damageType = set.get("damage")?.attrs.getAttribute("type")?.toLowerCase() ?? "";
  const damage = /^\d+d\d+/.test(dice) ? { dice, type: damageType } : undefined;
  const versatile = set.get("versatile")?.text;
  const reach = properties.includes("srd51:property/reach");
  const thrown = properties.includes("srd51:property/thrown");
  const range = set.get("range")?.text.match(/^(\d+)\s*\/\s*(\d+)/);
  const span = range ? { normal: Number(range[1]), long: Number(range[2]) } : undefined;
  const weight = parseWeight(set.get("weight"));

  emit(
    ctx,
    source,
    {
      category: "weapon",
      cost: parseCost(set.get("cost")),
      ...(weight !== undefined && { weight }),
      weapon: {
        category: weaponCategory,
        kind,
        ...(damage && { damage }),
        ...(damage &&
          versatile &&
          /^\d+d\d+/.test(versatile) && { twoHandedDamage: { dice: versatile, type: damageType } }),
        properties,
        range: kind === "ranged" && span ? span : { normal: reach ? 10 : 5 },
        ...(kind === "melee" && thrown && span && { throwRange: span }),
        proficiency: [`weapon:${weaponCategory}-weapons`],
      },
    },
    { desc: description(source.el) },
  );
}

export function importArmor(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const type = (set.get("armor")?.text ?? set.get("type")?.text ?? "").toLowerCase();
  if (type !== "light" && type !== "medium" && type !== "heavy" && type !== "shield") {
    ctx.result.skipped.Armor = (ctx.result.skipped.Armor ?? 0) + 1;
    return;
  }
  const ac = set.get("armorClass")?.text ?? "";
  const max = ac.match(/max\s*(\d+)/i)?.[1];
  const weight = parseWeight(set.get("weight"));

  emit(
    ctx,
    source,
    {
      category: "armor",
      cost: parseCost(set.get("cost")),
      ...(weight !== undefined && { weight }),
      armor: {
        category: type,
        base: number(ac.replace(/^\+/, "")) ?? 10,
        dexBonus: /dex/i.test(ac),
        ...(max && { maxDexBonus: Number(max) }),
        strengthMinimum: number(set.get("strength")?.text ?? "") ?? 0,
        stealthDisadvantage: /disadvantage/i.test(set.get("stealth")?.text ?? ""),
        proficiency: [type === "shield" ? "armor:shields" : `armor:${type}-armor`],
      },
    },
    { desc: description(source.el) },
  );
}

export function importGear(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const weight = parseWeight(set.get("weight"));
  emit(
    ctx,
    source,
    {
      category: slugify(set.get("category")?.text ?? "") || "adventuring-gear",
      cost: parseCost(set.get("cost")),
      ...(weight !== undefined && { weight }),
    },
    { desc: description(source.el) },
  );
}

/** The kinds of language Aurora tags (`<supports>Exotic, Rare</supports>`), as the SRD's `type` names them. */
const LANGUAGE_TYPES = ["standard", "exotic", "secret", "monster"];

export function importLanguage(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const type = supportsOf(source.el)
    .map((t) => t.toLowerCase())
    .find((t) => LANGUAGE_TYPES.includes(t));
  emit(ctx, source, type ? { type } : {}, {
    desc: description(source.el),
    speakers: set.get("speakers")?.text,
    script: set.get("script")?.text,
  });
}

/** The line a magic item starts with: what it is, how rare, and whether it needs attunement. */
/** Where Aurora says an item is worn or held (`<set name="slot">`), as the app names it. */
const SLOT_NAMES: Record<string, string> = {
  head: "head",
  neck: "neck",
  shoulders: "shoulders",
  body: "body",
  arms: "arms",
  hands: "hands",
  waist: "waist",
  belt: "waist",
  feet: "feet",
  ring: "ring",
  onehand: "oneHand",
  twohand: "twoHands",
};

/** The slot of an item: Aurora lists some by a comma (`onehand,secondary`), the first is where it goes. */
export function slotOf(set: ReturnType<typeof setters>): string | undefined {
  const first = (set.get("slot")?.text ?? "").split(",")[0] ?? "";
  return SLOT_NAMES[first.trim().toLowerCase()];
}

function magicLine(set: ReturnType<typeof setters>): string {
  const type = set.get("type")?.text ?? "";
  const rarity = (set.get("rarity")?.text ?? "").toLowerCase();
  const attune = /^\s*true/i.test(set.get("attunement")?.text ?? "");
  return [type, rarity].filter(Boolean).join(", ") + (attune ? " (requires attunement)" : "");
}

/** The dice of the hit points a potion restores ("You regain 2d4 + 2 hit points"), as `2d4+2`. */
export function healingDice(text: string): string | undefined {
  const found = /\bregains?\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+hit points/i.exec(text);
  return found?.[1]?.replace(/\s+/g, "");
}

/**
 * A magic item becomes a plain item: its text carries the rules, since what it does (a bonus to
 * attacks, charges, a spell) is not something the sheet applies by itself yet.
 */
export function importMagicItem(ctx: Context, source: Source): void {
  const set = setters(source.el);
  const mapped = mapRules(ctx, source, { idPrefix: "item", item: true });
  const effects: Effect[] = [...mapped.effects];
  for (const grant of mapped.grants) {
    if (grant.source.id && grant.level === undefined)
      effects.push({ type: "trait", id: grant.source.id as `${string}:${string}/${string}` });
  }
  const weight = parseWeight(set.get("weight"));
  const rarity = slugify(set.get("rarity")?.text ?? "");
  // A magic weapon of Aurora names the weapons it can be (`weapon`) and may give a bonus
  // (`enhancement`): it is put on a weapon the character has, not carried as a thing of its own.
  const enhancement = number(set.get("enhancement")?.text ?? "");
  const enchants = set.get("weapon") !== undefined;
  const heal = /potion/i.test(set.get("type")?.text ?? "")
    ? healingDice(description(source.el))
    : undefined;
  // An enchantment goes on a weapon the character has, so it has no place of its own.
  const slot = enchants ? undefined : slotOf(set);
  emit(
    ctx,
    source,
    {
      category: slugify(set.get("category")?.text ?? "") || "magic-items",
      cost: parseCost(set.get("cost")),
      ...(weight !== undefined && { weight }),
      ...(rarity && { rarity }),
      ...(slot && { slot }),
      ...(heal && { use: { heal } }),
      ...(enchants && { enchants: true }),
      ...(enchants && enhancement !== undefined && enhancement > 0 && { enhancement }),
      attunement: /^\s*true/i.test(set.get("attunement")?.text ?? ""),
    },
    { desc: [magicLine(set), description(source.el)].filter(Boolean).join("\n\n") },
    { effects },
  );
}
