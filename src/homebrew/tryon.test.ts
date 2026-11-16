import { describe, expect, it } from "vitest";
import type { Effect, Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { startEntry } from "./blanks";
import { addOwned, updateEntry } from "./entries";
import { newHomebrewPack } from "./pack";
import { canTry, tryOn, withEntry } from "./tryon";

const options = { ruleset: "srd51" as const, classId: "srd51:class/fighter", level: 4 };

function made(
  kind: Entry["kind"],
  variant?: "weapon" | "armor",
  change?: { effects?: Effect[]; data?: Record<string, unknown> },
) {
  const started = startEntry(newHomebrewPack("Mine", 1000), kind, variant);
  const record = change ? updateEntry(started.record, started.id, change) : started.record;
  const entry = record.pack.entries.find((e) => e.id === started.id) as Entry;
  const index = new Map<string, Entry>([
    ...srd51Index,
    ...record.pack.entries.map((e) => [e.id, e] as const),
  ]);
  return { entry, index, record };
}

const fact = (result: ReturnType<typeof tryOn>, key: string) =>
  result?.facts.find((f) => f.key === key);

describe("trying an entry on a character", () => {
  it("shows what a species changes: a score, the speed, a sense", () => {
    const { entry, index } = made("species", undefined, {
      effects: [
        { type: "abilityBonus", ability: "con", value: 2 },
        { type: "sense", sense: "darkvision", range: 60 },
      ],
      data: { speed: 25 },
    });
    const result = tryOn(entry, index, options);
    expect(fact(result, "ability:con")).toMatchObject({ before: "14", after: "16", changed: true });
    expect(fact(result, "speed")).toMatchObject({ before: "—", after: "25", changed: true });
    expect(fact(result, "senses")?.after).toContain("darkvision 60");
    expect(fact(result, "ability:str")?.changed).toBe(false);
  });

  it("writes other speeds as numbers of feet", () => {
    const { entry, index } = made("species", undefined, {
      effects: [{ type: "movement", mode: "fly", feet: 30 }],
    });
    expect(fact(tryOn(entry, index, options), "movement")?.after).toContain("fly 30");
    expect(fact(tryOn(entry, index, options), "movement")?.after).not.toContain("object");
  });

  it("shows a feat that raises armor class", () => {
    const { entry, index } = made("feat", undefined, {
      effects: [{ type: "modifier", target: "ac", value: 1 }],
    });
    const result = tryOn(entry, index, options);
    const ac = fact(result, "ac");
    expect(Number(ac?.after)).toBe(Number(ac?.before) + 1);
  });

  it("puts a class on the character at the level asked for, with what it gives", () => {
    const { record, entry } = made("class");
    const withFeature = addOwned(record, entry.id, "feature", { level: 1 });
    const index = new Map<string, Entry>([
      ...srd51Index,
      ...withFeature.record.pack.entries.map((e) => [e.id, e] as const),
    ]);
    const result = tryOn(entry, index, options);
    expect(result?.gained).toContain(withFeature.id);
    expect(fact(result, "hp")?.changed).toBe(true);
  });

  it("puts a subclass on the class it belongs to, and nothing without one", () => {
    const { entry } = made("subclass");
    expect(withEntry(entry, options)).toBeUndefined();
    const withParent = { ...entry, parent: "srd51:class/wizard" } as Entry;
    expect(withEntry(withParent, options)?.classes[0]).toMatchObject({
      classId: "srd51:class/wizard",
      subclassId: entry.id,
    });
  });

  it("wears an item: armor changes the armor class", () => {
    const { entry, index } = made("item", "armor");
    const result = tryOn(entry, index, options);
    expect(fact(result, "ac")?.changed).toBe(true);
    expect(fact(result, "attacks")?.changed).toBe(false);
  });

  it("holds a weapon: it adds an attack", () => {
    const { entry, index } = made("item", "weapon");
    expect(fact(tryOn(entry, index, options), "attacks")).toMatchObject({
      before: "0",
      after: "1",
    });
  });

  it("knows which entries can be tried", () => {
    expect(canTry(made("species").entry)).toBe(true);
    expect(canTry(made("spell").entry)).toBe(false);
    expect(tryOn(made("spell").entry, srd51Index, options)).toBeUndefined();
  });
});
