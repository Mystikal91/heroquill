import { describe, expect, it } from "vitest";
import { MAX_SHARED_ROLLS, emptyTable, reduceTable, withoutSeat } from "./dmTable";
import type { PlayerCard } from "./protocol";

const card: PlayerCard = { name: "Aria", hp: 9, maxHp: 12, tempHp: 0, ac: 15, conditions: [] };

describe("reduceTable", () => {
  it("takes the picture from a welcome and keeps a player's initiative", () => {
    let t = reduceTable(emptyTable(), { t: "presence", seat: "p1", name: "Aria", online: true }, 0);
    t = reduceTable(t, { t: "initiative", seat: "p1", value: 17 }, 0);
    t = reduceTable(
      t,
      {
        t: "welcome",
        v: 1,
        role: "dm",
        players: [{ seat: "p1", name: "Aria", online: false, card }],
        dmOnline: true,
      },
      0,
    );
    expect(t.players).toEqual([{ seat: "p1", name: "Aria", online: false, card, initiative: 17 }]);
  });

  it("follows who comes and goes, and the card", () => {
    let t = reduceTable(emptyTable(), { t: "presence", seat: "p1", name: "Aria", online: true }, 0);
    t = reduceTable(t, { t: "card", seat: "p1", card }, 0);
    t = reduceTable(t, { t: "presence", seat: "p1", name: "Aria", online: false }, 0);
    expect(t.players[0]).toMatchObject({ online: false, card });
  });

  it("lists the rolls newest first, with the player's name, up to a limit", () => {
    let t = reduceTable(emptyTable(), { t: "presence", seat: "p1", name: "Aria", online: true }, 0);
    for (let i = 0; i < MAX_SHARED_ROLLS + 5; i++)
      t = reduceTable(
        t,
        { t: "roll", seat: "p1", roll: { label: `r${i}`, detail: "d20", total: i } },
        i,
      );
    expect(t.rolls).toHaveLength(MAX_SHARED_ROLLS);
    expect(t.rolls[0]).toMatchObject({ name: "Aria", at: MAX_SHARED_ROLLS + 4 });
  });

  it("removes a seat", () => {
    const t = reduceTable(emptyTable(), { t: "presence", seat: "p1", name: "A", online: true }, 0);
    expect(withoutSeat(t, "p1").players).toEqual([]);
  });
});
