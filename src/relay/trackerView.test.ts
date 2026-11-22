import { describe, expect, it } from "vitest";
import { type Combatant, createEncounter, startCombat } from "../engine/encounter";
import { bandOf, matchSeats, trackerViewOf } from "./trackerView";

const c = (over: Partial<Combatant>): Combatant => ({
  id: "x",
  kind: "monster",
  name: "Goblin",
  hp: 7,
  maxHp: 7,
  tempHp: 0,
  ac: 15,
  initiativeBonus: 0,
  conditions: [],
  rounds: {},
  effects: [],
  notes: "secret notes",
  ...over,
});

describe("bandOf", () => {
  it("tells how hurt a creature looks", () => {
    expect(bandOf({ hp: 7, maxHp: 7 })).toBe("unhurt");
    expect(bandOf({ hp: 5, maxHp: 7 })).toBe("hurt");
    expect(bandOf({ hp: 3, maxHp: 7 })).toBe("bloodied");
    expect(bandOf({ hp: 0, maxHp: 7 })).toBe("down");
  });
});

describe("matchSeats", () => {
  it("pairs a character with the seat of the same name, once", () => {
    const list = [
      c({ id: "a", kind: "character", name: "Aria" }),
      c({ id: "b", kind: "character", name: " aria " }),
      c({ id: "m", name: "Aria" }),
    ];
    const found = matchSeats(list, [{ seat: "p1", name: "ARIA" }]);
    expect([...found]).toEqual([["a", "p1"]]);
  });
});

describe("trackerViewOf", () => {
  it("shows nothing before the fight starts", () => {
    const e = { ...createEncounter("f"), combatants: [c({ id: "g", initiative: 10 })] };
    expect(trackerViewOf(e, [])).toEqual({ round: 0, order: [] });
  });

  it("gives order, turn and bands, never the numbers of a monster", () => {
    const base = createEncounter("f");
    const e = startCombat({
      ...base,
      combatants: [
        c({ id: "g", initiative: 12, hp: 2 }),
        c({ id: "p", kind: "character", name: "Aria", initiative: 17, hp: 4, maxHp: 12 }),
      ],
    });
    const view = trackerViewOf(e, [{ seat: "p1", name: "Aria" }]);
    expect(view.round).toBe(1);
    expect(view.turn).toBe("p");
    expect(view.order).toEqual([
      { id: "p", name: "Aria", seat: "p1", initiative: 17 },
      { id: "g", name: "Goblin", initiative: 12, band: "bloodied" },
    ]);
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(JSON.stringify(view)).not.toContain("ac");
  });

  it("keeps from the players what the DM chose to keep", () => {
    const base = createEncounter("f");
    const e = startCombat({
      ...base,
      combatants: [
        c({ id: "g", name: "Lich", initiative: 12, hp: 2 }),
        c({ id: "p", kind: "character", name: "Aria", initiative: 17, hp: 4, maxHp: 12 }),
      ],
    });
    const players = [{ seat: "p1", name: "Aria" }];
    const names = trackerViewOf(e, players, { names: "Unknown creature" });
    expect(names.order.map((o) => o.name)).toEqual(["Aria", "Unknown creature"]);
    const bands = trackerViewOf(e, players, { bands: true });
    expect(bands.order.some((o) => "band" in o)).toBe(false);
    const order = trackerViewOf(e, players, { order: true });
    expect(order.order).toEqual([{ id: "p", name: "Aria", seat: "p1" }]);
    expect(order.turn).toBe("p");
  });
});
