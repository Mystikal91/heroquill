import { describe, expect, it } from "vitest";
import {
  canCastAsRitual,
  canPay,
  castOptions,
  isRitualOnly,
  payCast,
  planCast,
  refundCast,
  slotMark,
  slotsCameBack,
} from "./casting";
import { createPlayState } from "./character";
import type { ClassResource } from "./resources";
import type { SpellLists } from "./spells";

const slots = (...n: number[]) => Array.from({ length: 9 }, (_, i) => n[i] ?? 0);
const spent = (...n: number[]) => ({ ...createPlayState(), slotsUsed: slots(...n) });
const free: ClassResource = {
  id: "free:x:trait/legacy:x:spell/bolt",
  kind: "freeSpell",
  classId: "",
  spell: "x:spell/bolt",
  max: 1,
  recovery: "long",
};
const bolt = { id: "x:spell/bolt", level: 1 };

describe("what casting does", () => {
  const sources = { spellSlots: slots(4, 3, 2) };

  it("spends the slot of the spell's level at once", () => {
    expect(planCast(castOptions(spent(), bolt, sources))).toMatchObject({
      type: "spend",
      option: { kind: "slot", level: 1, left: 4 },
    });
  });

  it("asks, with what is left only, when the slots of the level are gone", () => {
    const plan = planCast(castOptions(spent(4, 3, 1), bolt, sources));
    expect(plan).toEqual({
      type: "ask",
      options: [{ kind: "slot", level: 3, left: 1, total: 2 }],
    });
  });

  it("can do nothing when only lower slots are left", () => {
    expect(planCast(castOptions(spent(0, 0, 2), { level: 3 }, sources))).toEqual({ type: "none" });
  });

  it("follows the level the person picked, and offers the lower ones when it is gone", () => {
    expect(planCast(castOptions(spent(), bolt, sources), 3)).toMatchObject({
      type: "spend",
      option: { level: 3 },
    });
    const plan = planCast(castOptions(spent(0, 0, 2), bolt, sources), 3);
    expect(plan.type === "ask" && plan.options.map((o) => o.level)).toEqual([1, 2]);
  });

  it("does not ask a warlock, whose slots are all bigger", () => {
    expect(planCast(castOptions(spent(), bolt, { spellSlots: slots(0, 0, 2) }))).toMatchObject({
      type: "spend",
      option: { kind: "slot", level: 3 },
    });
    const pact = { level: 3, count: 2 };
    expect(
      planCast(castOptions(spent(), { level: 2 }, { spellSlots: slots(2), pact })),
    ).toMatchObject({ type: "spend", option: { kind: "pact", level: 3 } });
  });

  it("asks before a Pact Magic slot takes the place of a slot of the same level", () => {
    const pact = { level: 1, count: 1 };
    expect(planCast(castOptions(spent(2), bolt, { spellSlots: slots(2), pact }))).toEqual({
      type: "ask",
      options: [{ kind: "pact", level: 1, left: 1, total: 1 }],
    });
    expect(planCast(castOptions(spent(), { level: 2 }, { spellSlots: slots(2), pact })).type).toBe(
      "none",
    );
  });

  it("uses a free use without slots, and asks when there are slots too", () => {
    const only = { spellSlots: slots(), resources: [free] };
    const options = castOptions(spent(), bolt, only);
    expect(planCast(options)).toMatchObject({ type: "spend", option: { kind: "free" } });
    const used = { ...spent(), resourcesUsed: { [free.id]: 1 } };
    expect(planCast(castOptions(used, bolt, only)).type).toBe("none");
    const both = { ...sources, resources: [free] };
    expect(planCast(castOptions(spent(), bolt, both)).type).toBe("ask");
    expect(planCast(castOptions(used, bolt, both))).toMatchObject({
      type: "spend",
      option: { kind: "slot", level: 1 },
    });
    expect(castOptions(spent(), { id: "x:spell/other", level: 1 }, only)).toEqual([]);
  });

  it("pays with points up to what is left and to the limit for one spell", () => {
    const points = { id: "reserve:psi", max: 5, cost: 3, limit: 4 };
    const [option] = castOptions(spent(), bolt, { spellSlots: slots(), points });
    if (!option) throw new Error("no option");
    const after = payCast(spent(), option);
    expect(after.resourcesUsed?.["reserve:psi"]).toBe(3);
    const [next] = castOptions(after, bolt, { spellSlots: slots(), points });
    expect(next && canPay(next)).toBe(false);
    const over = { ...points, cost: 5 };
    expect(planCast(castOptions(spent(), bolt, { spellSlots: slots(), points: over })).type).toBe(
      "none",
    );
  });

  it("puts back only what was paid, whatever changed since", () => {
    for (const option of castOptions(spent(1), bolt, {
      spellSlots: slots(4),
      pact: { level: 2, count: 2 },
      resources: [free],
    })) {
      const later = { ...payCast(spent(1), option), hp: 3 };
      expect(refundCast(later, option)).toMatchObject({ hp: 3, slotsUsed: slots(1) });
      expect(refundCast(later, option).pactUsed ?? 0).toBe(0);
      expect(refundCast(later, option).resourcesUsed?.[free.id] ?? 0).toBe(0);
    }
  });

  it("gives nothing back once a rest or another change came between", () => {
    const [option] = castOptions(spent(1), bolt, { spellSlots: slots(4) });
    if (!option) throw new Error("no option");
    // A rest, then one slot spent on something else; a slot put back by hand.
    expect(refundCast(spent(1), option).slotsUsed).toEqual(slots(1));
    expect(refundCast(spent(), option).slotsUsed).toEqual(slots());
    expect(refundCast(spent(2), option).slotsUsed).toEqual(slots(1));
  });

  it("takes nothing that is not there", () => {
    const gone = castOptions(spent(1), bolt, { spellSlots: slots(1) })[0];
    if (!gone) throw new Error("no option");
    const play = spent(1);
    expect(payCast(play, gone)).toBe(play);
  });

  it("notices slots that came back since a cast", () => {
    const mark = slotMark(spent(4, 1));
    expect(slotsCameBack(spent(4, 2), mark)).toBe(false);
    expect(slotsCameBack(spent(0, 5), mark)).toBe(true);
    expect(slotsCameBack({ ...spent(4, 1), createdSlots: slots(1) }, mark)).toBe(true);
  });
});

describe("casting as a ritual", () => {
  const id = "srd51:spell/detect-magic";
  const lists: SpellLists = {
    preparation: "prepared",
    maxSpellLevel: 1,
    prepared: { allowed: 1, chosen: [id], pool: [id] },
    alwaysPrepared: [],
  };
  const of = (classId: string) => ({ spellcasters: [{ classId, lists }], choices: [] });
  const spell = { id, ritual: true };

  it("needs a class with Ritual Casting in 2014", () => {
    expect(canCastAsRitual(spell, "srd51", of("srd51:class/cleric"))).toBe(true);
    expect(canCastAsRitual(spell, "srd51", of("srd51:class/paladin"))).toBe(false);
    expect(canCastAsRitual({ id, ritual: false }, "srd51", of("srd51:class/cleric"))).toBe(false);
  });

  it("is for everyone in 2024", () => {
    expect(canCastAsRitual(spell, "srd52", of("srd52:class/paladin"))).toBe(true);
  });

  it("takes the spells picked for Book of Ancient Secrets", () => {
    const sheet = { spellcasters: [], choices: [{ ritual: true, selected: [id] }] };
    expect(canCastAsRitual(spell, "srd51", sheet)).toBe(true);
    // They are cast in no other way, unless a class has them too (2024: they are prepared).
    expect(isRitualOnly(id, "srd51", sheet)).toBe(true);
    expect(isRitualOnly(id, "srd52", sheet)).toBe(false);
    expect(
      isRitualOnly(id, "srd51", { ...of("srd51:class/warlock"), choices: sheet.choices }),
    ).toBe(false);
  });
});
