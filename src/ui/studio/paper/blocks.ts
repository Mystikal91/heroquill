import type { Effect, Entry } from "../../../data/schema";
import { levelOf, ownedOfKind } from "../../../homebrew/entries";
import { type UiKey, ui } from "../../../i18n/ui";
import { distance } from "../../../i18n/units";
import type { UserPackRecord } from "../../../storage/packs";
import { spellFacts } from "../../spells/spellFacts";

/**
 * A document made of plain blocks: one description of an entry from which both the printed page and
 * the file for Homebrewery are drawn, so the two always say the same thing.
 */
export type Block =
  | { t: "subtitle"; text: string }
  | { t: "facts"; rows: [string, string][] }
  | { t: "para"; text: string }
  | { t: "heading"; text: string }
  | { t: "list"; items: string[] }
  | { t: "table"; head: string[]; rows: string[][] };

export interface EntryDoc {
  id: string;
  kind: string;
  /** What kind of thing it is, to group a pack's entries by section. */
  group: string;
  title: string;
  blocks: Block[];
}

/** What the document needs to know about the app: names of entries, and effects in words. */
export interface Words {
  /** The name of an entry of the rules or of any pack. */
  name: (id: string) => string;
  /** A word of the rules by kind and slug (`ability`, `str`); kind `option` is a word of the editor (`fire`, `small`). */
  word: (kind: string, slug: string) => string;
  /** An effect in a line. */
  effect: (effect: Effect) => string;
  /** What kind of entry it is, as a word. */
  kind: (entry: Entry) => string;
}

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

/** The texts of an entry: `text("desc")`. */
type Texts = (id: string, field: string) => string;

const para = (text: string): Block[] => paragraphs(text).map((p) => ({ t: "para", text: p }));

function effectList(entry: Entry, words: Words, skip: string[] = []): Block[] {
  const lines = entry.effects
    .filter((e) => !skip.includes(e.type))
    .map(words.effect)
    .filter(Boolean);
  return lines.length > 0 ? [{ t: "list", items: lines }] : [];
}

/** Features and traits an entry owns, as "Name. text" paragraphs. */
function ownedBlocks(
  record: UserPackRecord,
  owner: Entry,
  kind: "trait" | "feature",
  text: Texts,
  words: Words,
  byLevel = false,
): Block[] {
  const out: Block[] = [];
  let last = -1;
  for (const e of ownedOfKind(record, owner.id, kind)) {
    if (byLevel) {
      const level = levelOf(owner, e.id) ?? 0;
      if (level !== last) out.push({ t: "heading", text: ui("paper.level", { n: level }) });
      last = level;
    }
    const name = text(e.id, "name") || ui("studio.unnamed");
    const body = paragraphs(text(e.id, "desc"));
    out.push({ t: "para", text: `**${name}.** ${body[0] ?? ""}`.trim() });
    for (const more of body.slice(1)) out.push({ t: "para", text: more });
    out.push(...effectList(e, words, ["trait"]));
  }
  return out;
}

function spellBlocks(entry: Entry, text: Texts, words: Words): Block[] {
  const data = entry.data as Record<string, unknown>;
  const level = typeof data.level === "number" ? data.level : 0;
  const school = words.word("school", String(data.school ?? ""));
  const tags = [
    data.concentration ? ui("spells.concentration") : "",
    data.ritual ? ui("spells.ritual") : "",
  ].filter(Boolean);
  const components = Array.isArray(data.components) ? (data.components as string[]) : [];
  const material = text(entry.id, "material");
  const rows: [string, string][] = [
    [ui("spells.castingTime"), text(entry.id, "castingTime")],
    [ui("spells.range"), text(entry.id, "range")],
    [
      ui("spells.components"),
      components.length && material
        ? `${components.join(", ")} (${material})`
        : components.join(", "),
    ],
    [ui("spells.duration"), text(entry.id, "duration")],
    ...spellFacts(data, (index) => words.word("ability", index)),
  ];
  return [
    {
      t: "subtitle",
      text: `${
        level === 0
          ? ui("spells.cantripSchool", { school })
          : ui("spells.levelSchool", { level, school })
      }${tags.length > 0 ? ` · ${tags.join(" · ")}` : ""}`,
    },
    { t: "facts", rows: rows.filter(([, v]) => v) },
    ...para(text(entry.id, "desc")),
    ...(text(entry.id, "higherLevel")
      ? [
          {
            t: "para",
            text: `**${ui("hb.f.higherLevel")}.** ${text(entry.id, "higherLevel")}`,
          } as Block,
        ]
      : []),
  ];
}

function itemBlocks(entry: Entry, text: Texts, words: Words): Block[] {
  const data = entry.data as {
    cost?: { amount: number; unit: string };
    weight?: number;
    rarity?: string;
    attunement?: boolean;
    enhancement?: number;
    weapon?: {
      category: string;
      kind: string;
      damage?: { dice: string; type: string };
      twoHandedDamage?: { dice: string };
      properties: string[];
      range: { normal: number; long?: number };
    };
    armor?: {
      category: string;
      base: number;
      dexBonus: boolean;
      maxDexBonus?: number;
      strengthMinimum: number;
      stealthDisadvantage: boolean;
    };
  };
  const rows: [string, string][] = [];
  if (data.cost) rows.push([ui("fd.cost"), `${data.cost.amount} ${data.cost.unit}`]);
  if (data.weight !== undefined) rows.push([ui("hb.f.weight"), String(data.weight)]);
  if (data.weapon?.damage) {
    const w = data.weapon;
    const bonus = data.enhancement ? ` (+${data.enhancement})` : "";
    rows.push([
      ui("hb.f.damage"),
      `${w.damage?.dice}${w.twoHandedDamage ? ` / ${w.twoHandedDamage.dice}` : ""} ${words.word("option", w.damage?.type ?? "")}${bonus}`,
    ]);
    if (w.properties.length > 0)
      rows.push([ui("hb.f.properties"), w.properties.map(words.name).join(", ")]);
    if (w.kind === "ranged" || w.range.normal > 5)
      rows.push([
        ui("spells.range"),
        `${distance(w.range.normal)}${w.range.long ? ` / ${distance(w.range.long)}` : ""}`,
      ]);
  }
  if (data.armor) {
    const a = data.armor;
    rows.push([
      ui("fd.base"),
      `${a.base}${a.dexBonus ? ` + Dex${a.maxDexBonus !== undefined ? ` (max ${a.maxDexBonus})` : ""}` : ""}`,
    ]);
    if (a.strengthMinimum > 0) rows.push([ui("fd.strengthMinimum"), String(a.strengthMinimum)]);
    if (a.stealthDisadvantage) rows.push([ui("fd.stealthDisadvantage"), "✓"]);
  }
  const rarity = data.rarity ? words.word("option", data.rarity) : "";
  return [
    {
      t: "subtitle",
      text: [words.kind(entry), rarity, data.attunement ? ui("fd.attunement") : ""]
        .filter(Boolean)
        .join(" · "),
    },
    ...(rows.length > 0 ? [{ t: "facts", rows } as Block] : []),
    ...para(text(entry.id, "desc")),
    ...effectList(entry, words),
  ];
}

function classBlocks(record: UserPackRecord, entry: Entry, text: Texts, words: Words): Block[] {
  const data = entry.data as {
    hitDie?: number;
    spellcasting?: unknown;
    levels?: {
      level: number;
      features: string[];
      cantripsKnown?: number;
      spellsKnown?: number;
      spellSlots?: number[];
    }[];
  };
  const rows = data.levels ?? [];
  const casts = Boolean(data.spellcasting);
  const nameOf = (id: string) => text(id, "name") || ui("studio.unnamed");
  const head = [
    ui("form.level"),
    ui("hb.f.features"),
    ...(casts
      ? [ui("spells.cantrips"), ...Array.from({ length: 9 }, (_, i) => String(i + 1))]
      : []),
  ];
  const table = rows.map((r) => [
    String(r.level),
    r.features.map(nameOf).join(", ") || "—",
    ...(casts
      ? [
          String(r.cantripsKnown ?? "—"),
          ...Array.from({ length: 9 }, (_, i) => String(r.spellSlots?.[i] || "—")),
        ]
      : []),
  ]);
  return [
    { t: "subtitle", text: words.kind(entry) },
    ...(data.hitDie
      ? [{ t: "facts", rows: [[ui("hb.f.hitDie"), `d${data.hitDie}`]] } as Block]
      : []),
    ...para(text(entry.id, "desc")),
    ...effectList(entry, words, ["trait"]),
    { t: "table", head, rows: table },
    ...ownedBlocks(record, entry, "feature", text, words, true),
  ];
}

function monsterBlocks(entry: Entry, text: Texts, words: Words): Block[] {
  const d = entry.data as {
    size?: string;
    type?: string;
    armorClass?: { value: number }[];
    hitPoints?: number;
    hitPointsRoll?: string;
    speed?: Record<string, number | true>;
    abilities?: Record<string, number>;
    challenge?: number;
    senses?: Record<string, number>;
    special?: unknown[];
    actions?: unknown[];
    bonusActions?: unknown[];
    reactions?: unknown[];
    legendary?: unknown[];
  };
  const speed = Object.entries(d.speed ?? {})
    .map(([mode, v]) =>
      mode === "walk"
        ? distance(Number(v))
        : `${mode} ${v === true ? "" : distance(Number(v))}`.trim(),
    )
    .join(", ");
  const senses = Object.entries(d.senses ?? {})
    .map(([s, n]) => `${s} ${distance(n)}`)
    .join(", ");
  const scores = d.abilities ?? {};
  const abilities = ["str", "dex", "con", "int", "wis", "cha"];
  const out: Block[] = [
    { t: "subtitle", text: [d.size, d.type].filter(Boolean).join(" ") },
    {
      t: "facts",
      rows: [
        [ui("monster.ac"), String(d.armorClass?.[0]?.value ?? "")],
        [ui("monster.hp"), `${d.hitPoints ?? ""}${d.hitPointsRoll ? ` (${d.hitPointsRoll})` : ""}`],
        [ui("monster.speed"), speed],
        ...(senses ? ([[ui("monster.senses"), senses]] as [string, string][]) : []),
        ...(d.challenge !== undefined
          ? ([[ui("monster.challenge"), String(d.challenge)]] as [string, string][])
          : []),
      ].filter(([, v]) => v) as [string, string][],
    },
    {
      t: "table",
      head: abilities.map((a) => words.word("ability", a)),
      rows: [abilities.map((a) => String(scores[a] ?? 10))],
    },
    ...para(text(entry.id, "desc")),
  ];
  const sections: [string, number, string | undefined][] = [
    ["special", d.special?.length ?? 0, undefined],
    ["actions", d.actions?.length ?? 0, "monster.actions"],
    ["bonusActions", d.bonusActions?.length ?? 0, "monster.bonusActions"],
    ["reactions", d.reactions?.length ?? 0, "monster.reactions"],
    ["legendary", d.legendary?.length ?? 0, "monster.legendary"],
  ];
  for (const [field, count, title] of sections) {
    if (count === 0) continue;
    if (title) out.push({ t: "heading", text: ui(title as UiKey) });
    for (let n = 1; n <= count; n++) {
      const name = text(entry.id, `${field}.${n}.name`);
      const desc = text(entry.id, `${field}.${n}.desc`);
      if (name || desc) out.push({ t: "para", text: `**${name}.** ${desc}`.trim() });
    }
  }
  return out;
}

/** The document of one entry: what it is, its facts, its text, and what it gives. */
export function docOf(record: UserPackRecord, entry: Entry, text: Texts, words: Words): EntryDoc {
  const title = text(entry.id, "name") || ui("studio.unnamed");
  let blocks: Block[];
  switch (entry.kind) {
    case "spell":
      blocks = spellBlocks(entry, text, words);
      break;
    case "item":
      blocks = itemBlocks(entry, text, words);
      break;
    case "class":
      blocks = classBlocks(record, entry, text, words);
      break;
    case "subclass": {
      const parent = entry.parent ? words.name(entry.parent) : "";
      blocks = [
        { t: "subtitle", text: parent ? `${words.kind(entry)} · ${parent}` : words.kind(entry) },
        ...para(text(entry.id, "desc")),
        ...effectList(entry, words, ["trait"]),
        ...ownedBlocks(record, entry, "feature", text, words, true),
      ];
      break;
    }
    case "species":
    case "subspecies": {
      const d = entry.data as { size?: string; speed?: number };
      blocks = [
        { t: "subtitle", text: words.kind(entry) },
        ...(d.size || d.speed !== undefined
          ? [
              {
                t: "facts",
                rows: [
                  ...(d.size
                    ? ([[ui("hb.f.size"), words.word("option", d.size)]] as [string, string][])
                    : []),
                  ...(d.speed !== undefined
                    ? ([[ui("monster.speed"), distance(d.speed)]] as [string, string][])
                    : []),
                ],
              } as Block,
            ]
          : []),
        ...para(text(entry.id, "desc")),
        ...effectList(entry, words, ["trait"]),
        ...ownedBlocks(record, entry, "trait", text, words),
      ];
      break;
    }
    case "monster":
      blocks = monsterBlocks(entry, text, words);
      break;
    case "background": {
      const feature = text(entry.id, "featureName");
      blocks = [
        { t: "subtitle", text: words.kind(entry) },
        ...para(text(entry.id, "desc")),
        ...effectList(entry, words),
        ...(feature
          ? [{ t: "para", text: `**${feature}.** ${text(entry.id, "featureDesc")}` } as Block]
          : []),
      ];
      break;
    }
    default:
      blocks = [
        { t: "subtitle", text: words.kind(entry) },
        ...para(text(entry.id, "desc")),
        ...effectList(entry, words),
      ];
  }
  return { id: entry.id, kind: entry.kind, group: words.kind(entry), title, blocks };
}
