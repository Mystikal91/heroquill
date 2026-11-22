import { describe, expect, it } from "vitest";
import {
  MAX_MESSAGES,
  MAX_PROPOSALS,
  MAX_SHARED_ROLLS,
  emptyTable,
  reduceTable,
  withProposal,
  withoutSeat,
} from "./dmTable";
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

describe("proposals on the table", () => {
  it("lists them newest first and settles them by what the player answers", () => {
    let t = withProposal(emptyTable(), {
      id: "a",
      seat: "p1",
      label: "Aria: 7 damage",
      status: "waiting",
    });
    t = withProposal(t, { id: "b", seat: "p1", label: "Aria: prone", status: "waiting" });
    expect(t.proposals.map((p) => p.id)).toEqual(["b", "a"]);
    t = reduceTable(t, { t: "answer", seat: "p1", id: "a", accepted: true }, 0);
    t = reduceTable(t, { t: "answer", seat: "p1", id: "b", accepted: false }, 0);
    expect(t.proposals.map((p) => p.status)).toEqual(["declined", "accepted"]);
    t = reduceTable(
      withProposal(t, { id: "c", seat: "p2", label: "x", status: "waiting" }),
      { t: "undelivered", id: "c" },
      0,
    );
    expect(t.proposals[0]?.status).toBe("undelivered");
  });

  it("keeps only the latest few and survives a welcome", () => {
    let t = emptyTable();
    for (let i = 0; i < MAX_PROPOSALS + 4; i++)
      t = withProposal(t, { id: `i${i}`, seat: "p1", label: "x", status: "waiting" });
    expect(t.proposals).toHaveLength(MAX_PROPOSALS);
    t = reduceTable(t, { t: "welcome", v: 1, role: "dm", players: [], dmOnline: true }, 0);
    expect(t.proposals).toHaveLength(MAX_PROPOSALS);
  });
});

describe("the result of a roll asked", () => {
  it("is kept with the proposal that asked for it", () => {
    let t = withProposal(emptyTable(), {
      id: "r",
      seat: "p1",
      label: "Aria: Wis save",
      status: "waiting",
      dc: 14,
    });
    t = reduceTable(t, { t: "answer", seat: "p1", id: "r", accepted: true, result: 17 }, 0);
    expect(t.proposals[0]).toMatchObject({ status: "accepted", result: 17, dc: 14 });
  });
});

describe("lines the players wrote", () => {
  it("are kept newest first with the player's name, up to a limit", () => {
    let t = reduceTable(emptyTable(), { t: "presence", seat: "p1", name: "Aria", online: true }, 0);
    for (let i = 0; i < MAX_MESSAGES + 3; i++)
      t = reduceTable(t, { t: "say", seat: "p1", text: `line ${i}` }, i);
    expect(t.messages).toHaveLength(MAX_MESSAGES);
    expect(t.messages[0]).toMatchObject({ name: "Aria", text: `line ${MAX_MESSAGES + 2}` });
  });
});
