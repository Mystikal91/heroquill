import { describe, expect, it } from "vitest";
import type { ClientMessage, PlayerCard } from "./protocol";
import { LIMITS } from "./protocol";
import { type Env, type RoomState, type Who, isExpired, leave, step } from "./room";

let counter = 0;
const env = (over: Partial<Env> = {}): Env => ({
  now: 1000,
  newToken: () => `token${++counter}`,
  online: { dm: false, seats: new Set() },
  ...over,
});

const card = (over: Partial<PlayerCard> = {}): PlayerCard => ({
  name: "Aria",
  hp: 10,
  maxHp: 12,
  tempHp: 0,
  ac: 15,
  conditions: [],
  ...over,
});

const dmHello: ClientMessage = { t: "hello", v: 1, role: "dm", secret: "s".repeat(32) };
const playerHello = (
  over: Partial<Extract<ClientMessage, { t: "hello"; role: "player" }>> = {},
): ClientMessage => ({
  t: "hello",
  v: 1,
  role: "player",
  name: "Aria",
  ...over,
});

/** A room the DM opened. */
const opened = (): RoomState => {
  const s = step(undefined, undefined, dmHello, env({ secretHash: "hash" }));
  return s.state as RoomState;
};

const join = (state: RoomState, name = "Aria") => {
  const s = step(state, undefined, playerHello({ name }), env());
  const welcome = s.out.find((o) => o.to === "self")?.msg;
  return { s, state: s.state as RoomState, seat: (s.who as { seat: string }).seat, welcome };
};

describe("opening a room and joining it", () => {
  it("lets the DM open a room, with the hash of the secret and no seats", () => {
    const s = step(undefined, undefined, dmHello, env({ secretHash: "hash" }));
    expect(s.state?.secretHash).toBe("hash");
    expect(s.who).toEqual({ role: "dm" });
    expect(s.dirty).toBe(true);
    expect(s.out[0]?.msg).toMatchObject({ t: "welcome", role: "dm", players: [] });
  });

  it("gives the DM back the room only with the same secret", () => {
    const room = opened();
    expect(step(room, undefined, dmHello, env({ secretHash: "hash" })).who).toEqual({ role: "dm" });
    const wrong = step(room, undefined, dmHello, env({ secretHash: "other" }));
    expect(wrong.bye).toBe("bad-secret");
    expect(wrong.who).toBeUndefined();
  });

  it("does not make a room for a player", () => {
    expect(step(undefined, undefined, playerHello(), env()).bye).toBe("no-room");
  });

  it("seats a player, tells the DM, and gives a token", () => {
    const { s, seat, welcome } = join(opened());
    expect(seat).toBe("p1");
    expect(welcome).toMatchObject({ t: "welcome", role: "player", seat: "p1", dmOnline: false });
    expect((welcome as { token?: string }).token).toMatch(/^token/);
    expect(s.out).toContainEqual({
      to: "dm",
      msg: { t: "presence", seat: "p1", name: "Aria", online: true },
    });
    expect(s.dirty).toBe(true);
  });

  it("gives a seat back with its token, and not with a wrong one", () => {
    const { state, seat, welcome } = join(opened());
    const token = (welcome as { token: string }).token;
    const back = step(
      state,
      undefined,
      playerHello({ seat, token }),
      env({ online: { dm: false, seats: new Set([seat]) } }),
    );
    expect(back.who).toEqual({ role: "player", seat });
    expect(back.drop).toEqual({ reason: "replaced", targets: [{ seat }] });
    expect(back.dirty).toBe(false);
    const wrong = step(state, undefined, playerHello({ seat, token: "nope" }), env());
    expect((wrong.who as { seat: string }).seat).toBe("p2");
  });

  it("closes the door when the room is full", () => {
    let state = opened();
    for (let i = 0; i < LIMITS.players; i++) state = join(state, `P${i}`).state;
    expect(step(state, undefined, playerHello(), env()).bye).toBe("full");
  });

  it("replaces a DM who is already connected", () => {
    const s = step(
      opened(),
      undefined,
      dmHello,
      env({ secretHash: "hash", online: { dm: true, seats: new Set() } }),
    );
    expect(s.drop).toEqual({ reason: "replaced", targets: [{ dm: true }] });
  });

  it("answers to nothing before hello", () => {
    expect(step(opened(), undefined, { t: "ping" }, env()).bye).toBe("bad-message");
  });
});

describe("what goes where", () => {
  const seated = () => {
    const { state, seat } = join(opened());
    return { state, who: { role: "player", seat } as Who, seat };
  };

  it("sends a card, a roll and an initiative to the DM only", () => {
    const { state, who, seat } = seated();
    const c = step(state, who, { t: "card", card: card() }, env());
    expect(c.out).toEqual([{ to: "dm", msg: { t: "card", seat, card: card() } }]);
    const r = step(
      c.state,
      who,
      { t: "roll", roll: { label: "Stealth", detail: "d20 14 +5", total: 19 } },
      env(),
    );
    expect(r.out).toEqual([
      {
        to: "dm",
        msg: { t: "roll", seat, roll: { label: "Stealth", detail: "d20 14 +5", total: 19 } },
      },
    ]);
    const i = step(r.state, who, { t: "initiative", value: 17 }, env());
    expect(i.out).toEqual([{ to: "dm", msg: { t: "initiative", seat, value: 17 } }]);
  });

  it("keeps the last card, and says it is not worth saving when it did not change", () => {
    const { state, who } = seated();
    const first = step(state, who, { t: "card", card: card() }, env());
    expect(first.dirty).toBe(true);
    expect(first.state?.seats.p1?.card).toEqual(card());
    expect(step(first.state, who, { t: "card", card: card() }, env()).dirty).toBe(false);
  });

  it("hands the last card to a DM who comes back, and the tracker to a player who comes", () => {
    const { state, who } = seated();
    const withCard = step(state, who, { t: "card", card: card() }, env()).state as RoomState;
    const dm = step(withCard, undefined, dmHello, env({ secretHash: "hash" }));
    expect(dm.out[0]?.msg).toMatchObject({
      t: "welcome",
      players: [{ seat: "p1", card: card(), online: false }],
    });
    const view = { round: 2, order: [{ id: "a", name: "Goblin" }] };
    const published = step(withCard, { role: "dm" }, { t: "tracker", view }, env());
    expect(published.out).toEqual([{ to: "players", msg: { t: "tracker", view } }]);
    const late = join(published.state as RoomState, "Bo");
    expect(late.welcome).toMatchObject({ tracker: view });
  });

  it("never gives the other players' cards to a player", () => {
    const { state, who } = seated();
    const withCard = step(state, who, { t: "card", card: card() }, env()).state as RoomState;
    const late = join(withCard, "Bo");
    expect(JSON.stringify(late.welcome)).not.toContain("maxHp");
  });

  it("asks everybody, or only the seats named, for their initiative", () => {
    const a = join(opened());
    const b = join(a.state, "Bo");
    const all = step(b.state, { role: "dm" }, { t: "askInitiative" }, env());
    expect(all.out).toEqual([{ to: "players", msg: { t: "askInitiative" } }]);
    const some = step(b.state, { role: "dm" }, { t: "askInitiative", seats: ["p2", "p9"] }, env());
    expect(some.out).toEqual([{ to: { seat: "p2" }, msg: { t: "askInitiative", seats: ["p2"] } }]);
  });

  it("does not let a player act as the DM", () => {
    const { state, who } = seated();
    const view = { round: 1, order: [] };
    const s = step(state, who, { t: "tracker", view }, env());
    expect(s.out).toEqual([]);
    expect(s.state?.tracker).toBeUndefined();
    expect(step(state, who, { t: "close" }, env()).state).toBeDefined();
  });
});

describe("kicking, closing and leaving", () => {
  it("removes a seat and closes its socket", () => {
    const { state } = join(opened());
    const s = step(state, { role: "dm" }, { t: "kick", seat: "p1" }, env());
    expect(s.state?.seats).toEqual({});
    expect(s.drop).toEqual({ reason: "kicked", targets: [{ seat: "p1" }] });
  });

  it("turns away a socket whose seat is gone", () => {
    const { state } = join(opened());
    const gone = step(state, { role: "dm" }, { t: "kick", seat: "p1" }, env()).state;
    expect(step(gone, { role: "player", seat: "p1" }, { t: "ping" }, env()).out[0]?.msg).toEqual({
      t: "pong",
    });
    expect(
      step(gone, { role: "player", seat: "p1" }, { t: "initiative", value: 3 }, env()).bye,
    ).toBe("kicked");
  });

  it("ends the game for everybody when the DM closes it", () => {
    const s = step(opened(), { role: "dm" }, { t: "close" }, env());
    expect(s.state).toBeUndefined();
    expect(s.drop).toEqual({ reason: "closed", targets: [{ all: true }] });
  });

  it("tells the right people when a socket goes", () => {
    const { state, seat } = join(opened());
    expect(leave(state, { role: "player", seat })).toEqual([
      { to: "dm", msg: { t: "presence", seat, name: "Aria", online: false } },
    ]);
    expect(leave(state, { role: "dm" })).toEqual([
      { to: "players", msg: { t: "dm", online: false } },
    ]);
    expect(leave(state, undefined)).toEqual([]);
  });

  it("expires after twelve hours without a message", () => {
    const room = opened();
    expect(isExpired(room, room.lastActive + 11 * 3_600_000)).toBe(false);
    expect(isExpired(room, room.lastActive + 12 * 3_600_000)).toBe(true);
  });
});

describe("proposals", () => {
  const dm = { role: "dm" } as Who;
  const damage = { kind: "damage", amount: 7, type: "fire", from: "Goblin" } as const;

  it("goes from the DM to the seat that is here, and to nobody else", () => {
    const { state, seat } = join(opened());
    const here = env({ online: { dm: true, seats: new Set([seat]) } });
    const s = step(state, dm, { t: "propose", seat, id: "a1", proposal: damage }, here);
    expect(s.out).toEqual([{ to: { seat }, msg: { t: "proposal", id: "a1", proposal: damage } }]);
    expect(s.dirty).toBe(false);
  });

  it("tells the DM when the player is not here, and keeps nothing", () => {
    const { state, seat } = join(opened());
    const s = step(state, dm, { t: "propose", seat, id: "a2", proposal: damage }, env());
    expect(s.out).toEqual([{ to: "self", msg: { t: "undelivered", id: "a2" } }]);
    const unknown = step(
      state,
      dm,
      { t: "propose", seat: "p9", id: "a3", proposal: damage },
      env(),
    );
    expect(unknown.out).toEqual([{ to: "self", msg: { t: "undelivered", id: "a3" } }]);
  });

  it("brings the answer to the DM, and a player cannot propose", () => {
    const { state, seat } = join(opened());
    const player = { role: "player", seat } as Who;
    const a = step(state, player, { t: "answer", id: "a1", accepted: true }, env());
    expect(a.out).toEqual([{ to: "dm", msg: { t: "answer", seat, id: "a1", accepted: true } }]);
    const forged = step(state, player, { t: "propose", seat, id: "x", proposal: damage }, env());
    expect(forged.out).toEqual([]);
  });
});
