import { beforeAll, describe, expect, it } from "vitest";
import { loadContent } from "../../content/browser";
import { ItemDataSchema } from "../../data/items";
import { ClassDataSchema, SubclassDataSchema } from "../../data/progression";
import { ENTRY_KINDS, type Effect, MODIFIER_TARGETS, PlainEffectSchema } from "../../data/schema";
import { effectFields } from "./effects";
import { checkFields, checkValue } from "./fields";
import { DATA_FIELDS, EFFECT_META, EFFECT_TYPES, KIND_META, MAIN_KINDS, checkData } from "./index";
import { typeOf } from "./introspect";

type Loaded = Awaited<ReturnType<typeof loadContent>>;
let content: Loaded;

beforeAll(async () => {
  content = await loadContent(["en"], [], { monsters: true });
}, 60_000);

const entries = () => content.packs.flatMap((p) => p.entries);

/** The problems of an effect (and the effects inside a `when`), against what the engine's schema says. */
function effectProblems(effect: Effect, where: string): string[] {
  const { type, ...rest } = effect as Effect & Record<string, unknown>;
  const problems = checkFields(effectFields(type), rest, `${where}:${type}`);
  if (effect.type === "when")
    return [...problems, ...effect.effects.flatMap((e) => effectProblems(e, where))];
  return problems;
}

describe("the catalog of kinds", () => {
  it("describes every kind of entry the schema has", () => {
    expect(Object.keys(KIND_META).sort()).toEqual([...ENTRY_KINDS].sort());
    expect(Object.keys(DATA_FIELDS).sort()).toEqual([...ENTRY_KINDS].sort());
  });

  it("can start the kinds a person writes", () => {
    for (const kind of [
      "spell",
      "item",
      "feat",
      "species",
      "class",
      "subclass",
      "background",
      "monster",
    ])
      expect(MAIN_KINDS).toContain(kind);
    // Owned entries are written inside their owner, vocabulary is rare.
    expect(MAIN_KINDS).not.toContain("feature");
    expect(MAIN_KINDS).not.toContain("trait");
    expect(MAIN_KINDS).not.toContain("skill");
  });

  it("names owned kinds that exist and are owned", () => {
    for (const meta of Object.values(KIND_META))
      for (const owned of meta.owns ?? []) expect(KIND_META[owned].role).toBe("owned");
  });
});

describe("the catalog of effects", () => {
  const schemaTypes = (
    PlainEffectSchema as unknown as { options: { entries: { type: { literal: string } } }[] }
  ).options.map((o) => o.entries.type.literal);

  it("describes every effect type the engine has, and no other", () => {
    expect([...EFFECT_TYPES].sort()).toEqual([...schemaTypes, "when"].sort());
    expect(Object.keys(EFFECT_META).sort()).toEqual([...EFFECT_TYPES].sort());
  });

  it("reads the fields of an effect from the schema of the engine", () => {
    const modifier = effectFields("modifier");
    expect(modifier.map((f) => f.key)).toEqual(
      expect.arrayContaining(["target", "value", "plus", "skill", "when", "minLevel", "min"]),
    );
    const target = modifier.find((f) => f.key === "target");
    expect(target?.type).toEqual({ type: "choice", options: MODIFIER_TARGETS });
    expect(target?.optional).toBe(false);
    expect(modifier.find((f) => f.key === "plus")?.optional).toBe(true);
    // Fields that name entries say which kinds of entry.
    expect(effectFields("grantSpell").find((f) => f.key === "spell")?.type).toEqual({
      type: "ref",
      kinds: ["spell"],
    });
    expect(effectFields("expertise").find((f) => f.key === "skill")?.type).toEqual({
      type: "slug",
      kind: "skill",
    });
  });

  it("leaves no field of an effect undescribed", () => {
    const opaque = EFFECT_TYPES.flatMap((type) =>
      effectFields(type)
        .filter((f) => JSON.stringify(f.type).includes('"json"'))
        .map((f) => `${type}.${f.key}`),
    );
    expect(opaque).toEqual([]);
  });

  it("keeps the numbers of a field in range", () => {
    const attacks = effectFields("extraAttack").find((f) => f.key === "attacks");
    expect(attacks && checkValue(attacks.type, 1)).not.toEqual([]);
    expect(attacks && checkValue(attacks.type, 3)).toEqual([]);
    expect(attacks && checkValue(attacks.type, 2.5)).not.toEqual([]);
  });

  it("reads schemas it knows how to and calls the rest opaque", () => {
    expect(typeOf({ type: "unknown" })).toEqual({ type: "json" });
  });
});

describe("the catalog against the rules that ship with the app", () => {
  it("describes the data of every entry", () => {
    // One line per kind of problem, with the first entry that has it.
    const found = new Map<string, string>();
    for (const e of entries())
      for (const p of checkData(e.kind, e.data)) found.set(`${e.kind} ${p}`, e.id);
    expect([...found].map(([problem, id]) => `${problem} (${id})`)).toEqual([]);
  });

  it("describes every effect of every entry", () => {
    const found = new Map<string, string>();
    for (const e of entries())
      for (const effect of e.effects)
        for (const p of effectProblems(effect, e.kind)) found.set(p, e.id);
    expect([...found].map(([problem, id]) => `${problem} (${id})`)).toEqual([]);
  });

  it("describes what the engine's own data schemas read", () => {
    const missing = (
      name: "item" | "class" | "subclass",
      schema: { entries: Record<string, unknown> },
    ) => Object.keys(schema.entries).filter((key) => !DATA_FIELDS[name].some((f) => f.key === key));
    expect(missing("item", ItemDataSchema)).toEqual([]);
    expect(missing("class", ClassDataSchema)).toEqual([]);
    expect(missing("subclass", SubclassDataSchema)).toEqual([]);
  });

  it("refuses data that does not fit", () => {
    expect(
      checkData("spell", {
        level: 12,
        school: "evocation",
        components: [],
        ritual: false,
        concentration: false,
        classes: [],
      }),
    ).toEqual(["level: must be at most 9"]);
    expect(checkData("species", { speed: 30, size: "medium", wings: true })).toEqual([
      "wings: unknown field",
    ]);
    expect(checkData("species", {})).toEqual(["speed: required"]);
  });
});
