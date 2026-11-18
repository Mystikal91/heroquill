import { describe, expect, it } from "vitest";
import { classData } from "../data/progression";
import type { Entry } from "../data/schema";
import { srd51Index } from "../test/srd51";
import { createCharacter } from "./character";
import { deriveSheet } from "./derive";
import { canSpend, spendPool } from "./spends";

const CLASS = "test:class/mystic" as Entry["id"];
const POINTS = "test:feature/points" as Entry["id"];
const BLAST = "test:feature/blast" as Entry["id"];
const GIFT = "test:trait/gift" as Entry["id"];
const KIN = "test:species/kin" as Entry["id"];

const fighter = srd51Index.get("srd51:class/fighter") as Entry;
const base = classData(fighter);

const mystic: Entry = {
  id: CLASS,
  kind: "class",
  effects: [],
  data: {
    ...base,
    levels: base.levels.map((row) => ({
      ...row,
      features: row.level === 1 ? [POINTS, BLAST] : [],
      classSpecific: { Points: row.level * 3 },
    })),
  },
};

// The class adds points to the reserve from its table; a species adds two more to the same reserve.
const points: Entry = {
  id: POINTS,
  kind: "feature",
  effects: [{ type: "uses", term: { table: "Points" }, recharge: "long", reserve: "psi" }],
  data: { level: 1, class: CLASS },
};
// A feature that takes points from the reserve when it is used.
const blast: Entry = {
  id: BLAST,
  kind: "feature",
  effects: [{ type: "spends", reserve: "psi", cost: 2 }],
  data: { level: 1, class: CLASS, activation: "action" },
};
const gift: Entry = {
  id: GIFT,
  kind: "trait",
  effects: [{ type: "uses", term: 2, recharge: "long", reserve: "psi" }],
  data: {},
};
const kin: Entry = {
  id: KIN,
  kind: "species",
  effects: [{ type: "trait", id: GIFT }],
  data: { speed: 30, size: "medium" },
};

const index = new Map<string, Entry>([
  ...srd51Index,
  ...[mystic, points, blast, gift, kin].map((e) => [e.id, e] as [string, Entry]),
]);

function sheetAt(level: number, species = true) {
  const c = createCharacter("srd51");
  if (species) c.choices.species = KIN;
  c.classes = [{ classId: CLASS, level }];
  return deriveSheet(c, index);
}

describe("a reserve of points shared by name", () => {
  it("adds up what every source gives, as one resource", () => {
    const reserves = sheetAt(5).resources.filter((r) => r.reserve === "psi");
    expect(reserves).toHaveLength(1);
    expect(reserves[0]?.max).toBe(5 * 3 + 2);
    expect(sheetAt(5, false).resources.find((r) => r.reserve === "psi")?.max).toBe(15);
  });

  it("is the counter that a feature spends from", () => {
    const s = sheetAt(5);
    const spend = s.spends[BLAST];
    expect(spend).toMatchObject({ reserve: "psi", cost: 2, resource: "reserve:psi" });
    const play = { resourcesUsed: { "reserve:psi": 16 } };
    // 17 points, 16 spent: one left, not enough for a cost of 2.
    expect(spend && canSpend(play as never, spend, s.resources)).toBe(false);
    expect(spend && spendPool({ resourcesUsed: {} } as never, spend, s.resources)).toBeTruthy();
  });
});

// A class that casts without slots: its spells cost points of the reserve, and it knows spells up to
// half its level.
const SLOTLESS = "test:class/adept" as Entry["id"];
const adept: Entry = {
  id: SLOTLESS,
  kind: "class",
  effects: [],
  data: {
    ...base,
    spellcasting: {
      ability: "int",
      startsAtLevel: 1,
      preparation: { type: "known" },
      slots: "none",
      reserve: "psi",
      maxLevel: "half",
      limit: "Limit",
    },
    levels: base.levels.map((row) => ({
      ...row,
      features: [],
      cantripsKnown: 3,
      spellsKnown: row.level + 2,
      classSpecific: { Limit: Math.ceil(row.level / 2) * 2 },
    })),
  },
};
const spell = (id: string, level: number): Entry => ({
  id: id as Entry["id"],
  kind: "spell",
  effects: [],
  data: {
    level,
    school: "evocation",
    components: [],
    ritual: false,
    concentration: false,
    classes: [SLOTLESS],
  },
});
const withAdept = new Map<string, Entry>([
  ...index,
  [SLOTLESS, adept],
  ...[
    spell("test:spell/a", 0),
    spell("test:spell/b", 1),
    spell("test:spell/c", 2),
    spell("test:spell/d", 3),
  ].map((e) => [e.id, e] as [string, Entry]),
]);

describe("a class that casts without spell slots", () => {
  const caster = (level: number) => {
    const c = createCharacter("srd51");
    c.classes = [{ classId: SLOTLESS, level }];
    return deriveSheet(c, withAdept).spellcasters[0];
  };

  it("is a caster with no slots, paying from its reserve", () => {
    const at4 = caster(4);
    expect(at4).toBeTruthy();
    expect(at4?.reserve).toBe("psi");
    expect(at4?.spellSlots).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(at4?.cantripsKnown).toBe(3);
    expect(at4?.spellsKnown).toBe(6);
  });

  it("knows spells up to half its level, rounded up", () => {
    expect(caster(1)?.lists.maxSpellLevel).toBe(1);
    expect(caster(4)?.lists.maxSpellLevel).toBe(2);
    expect(caster(5)?.lists.maxSpellLevel).toBe(3);
    expect(caster(4)?.lists.known?.pool).toEqual(["test:spell/b", "test:spell/c"]);
    expect(caster(5)?.lists.known?.pool).toContain("test:spell/d");
  });

  it("limits the points one spell can take from a column of the table", () => {
    expect(caster(1)?.spellLimit).toBe(2);
    expect(caster(5)?.spellLimit).toBe(6);
  });
});

describe("when the points of a reserve come back", () => {
  const reserve = (recharge: unknown): Entry => ({
    id: "test:reserve/psi" as Entry["id"],
    kind: "reserve",
    effects: [],
    data: { recharge },
  });
  const sheetWith = (entry?: Entry) => {
    const c = createCharacter("srd51");
    c.choices.species = KIN;
    c.classes = [{ classId: CLASS, level: 5 }];
    const withReserve = entry ? new Map(index).set(entry.id, entry) : index;
    return deriveSheet(c, withReserve).resources.find((r) => r.reserve === "psi");
  };

  it("is read from the entry of the reserve", () => {
    expect(sheetWith(reserve("short"))?.recovery).toBe("short");
    expect(sheetWith(reserve("long"))?.recovery).toBe("long");
  });

  it("falls back to what the sources say when the pack has no entry for it", () => {
    expect(sheetWith()?.recovery).toBe("long");
    expect(sheetWith(reserve("never"))?.recovery).toBe("long");
  });
});
