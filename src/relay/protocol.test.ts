import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, LIMITS, normaliseCode, parseClientMessage, readCard } from "./protocol";

const text = (x: unknown) => JSON.stringify(x);

describe("reading what comes in", () => {
  it("refuses what is not JSON, not an object or not ours", () => {
    expect(parseClientMessage("nope")).toBeUndefined();
    expect(parseClientMessage("[1]")).toBeUndefined();
    expect(parseClientMessage(text({ t: "shout" }))).toBeUndefined();
    expect(parseClientMessage(text({ t: "hello", v: 1, role: "king" }))).toBeUndefined();
  });

  it("refuses a message that is too big", () => {
    const big = text({ t: "roll", roll: { label: "x".repeat(LIMITS.messageBytes), detail: "" } });
    expect(parseClientMessage(big)).toBeUndefined();
  });

  it("reads a DM hello only with a real secret", () => {
    expect(
      parseClientMessage(text({ t: "hello", v: 1, role: "dm", secret: "short" })),
    ).toBeUndefined();
    expect(
      parseClientMessage(text({ t: "hello", v: 1, role: "dm", secret: "a".repeat(32) })),
    ).toMatchObject({ role: "dm" });
  });

  it("reads a player hello and trims the name", () => {
    expect(
      parseClientMessage(
        text({ t: "hello", v: 1, role: "player", name: "  Aria  ", seat: "p1", token: "t" }),
      ),
    ).toEqual({
      t: "hello",
      v: 1,
      role: "player",
      name: "Aria",
      seat: "p1",
      token: "t",
    });
  });

  it("keeps in a card only what is known, within limits", () => {
    // Without its basic numbers a card is not one; a number out of range is brought into it.
    expect(readCard({ name: "Aria", hp: 5, ac: 15 })).toBeUndefined();
    expect(readCard({ name: "Aria", hp: 5, maxHp: 12, ac: 500 })?.ac).toBe(99);
    const ok = readCard({
      name: "Aria",
      hp: 50,
      maxHp: 12,
      ac: 15,
      speed: 30,
      secretField: "x",
      conditions: ["prone", 5, "", "x".repeat(500)],
    });
    expect(ok).toMatchObject({ hp: 12, maxHp: 12, ac: 15, speed: 30, tempHp: 0 });
    expect(ok?.conditions).toHaveLength(2);
    expect(ok?.conditions[1]).toHaveLength(LIMITS.text);
    expect(ok).not.toHaveProperty("secretField");
  });

  it("reads a tracker, skipping what is not a creature", () => {
    const m = parseClientMessage(
      text({
        t: "tracker",
        view: {
          round: 3,
          turn: "a",
          order: [{ id: "a", name: "Goblin", band: "hurt", hp: 7 }, { name: "no id" }, 4],
        },
      }),
    );
    expect(m).toEqual({
      t: "tracker",
      view: { round: 3, turn: "a", order: [{ id: "a", name: "Goblin", band: "hurt" }] },
    });
  });

  it("reads the asks and the small messages", () => {
    expect(parseClientMessage(text({ t: "askInitiative", seats: ["p1", 3] }))).toEqual({
      t: "askInitiative",
      seats: ["p1"],
    });
    expect(parseClientMessage(text({ t: "askInitiative" }))).toEqual({ t: "askInitiative" });
    expect(parseClientMessage(text({ t: "initiative", value: 400 }))).toEqual({
      t: "initiative",
      value: 99,
    });
    expect(parseClientMessage(text({ t: "ping" }))).toEqual({ t: "ping" });
    expect(parseClientMessage(text({ t: "kick" }))).toBeUndefined();
  });
});

describe("join codes", () => {
  it("has no look-alike characters", () => {
    for (const c of "01OIL") expect(CODE_ALPHABET).not.toContain(c);
  });

  it("reads a code as a person types it", () => {
    expect(normaliseCode("abc-234")).toBe("ABC234");
    expect(normaliseCode(" abc 234 ")).toBe("ABC234");
    expect(normaliseCode("ABC23")).toBeUndefined();
    expect(normaliseCode("ABC23O")).toBeUndefined();
  });
});

describe("reading a proposal", () => {
  it("reads the three kinds and cuts what is too long", () => {
    const damage = parseClientMessage(
      JSON.stringify({
        t: "propose",
        seat: "p1",
        id: "a",
        proposal: { kind: "damage", amount: 7, type: "fire" },
      }),
    );
    expect(damage).toMatchObject({
      t: "propose",
      proposal: { kind: "damage", amount: 7, type: "fire" },
    });
    const condition = parseClientMessage(
      JSON.stringify({
        t: "propose",
        seat: "p1",
        id: "a",
        proposal: { kind: "condition", condition: "srd51:condition/prone" },
      }),
    );
    expect(condition).toMatchObject({
      proposal: { kind: "condition", condition: "srd51:condition/prone" },
    });
    const say = parseClientMessage(
      JSON.stringify({
        t: "propose",
        seat: "p1",
        id: "a",
        proposal: { kind: "say", text: "x".repeat(900) },
      }),
    );
    expect(say?.t === "propose" && say.proposal.kind === "say" && say.proposal.text.length).toBe(
      400,
    );
  });

  it("refuses an empty or unknown proposal and an answer without a verdict", () => {
    const bad = (proposal: unknown) =>
      parseClientMessage(JSON.stringify({ t: "propose", seat: "p1", id: "a", proposal }));
    expect(bad({ kind: "say", text: "  " })).toBeUndefined();
    expect(bad({ kind: "damage" })).toBeUndefined();
    expect(bad({ kind: "teleport" })).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({ t: "answer", id: "a" }))).toBeUndefined();
    expect(parseClientMessage(JSON.stringify({ t: "answer", id: "a", accepted: false }))).toEqual({
      t: "answer",
      id: "a",
      accepted: false,
    });
  });
});

describe("reading a roll asked of a player", () => {
  const read = (proposal: unknown) =>
    parseClientMessage(JSON.stringify({ t: "propose", seat: "p1", id: "a", proposal }));

  it("reads a save, a check and a skill, with or without a difficulty", () => {
    expect(
      read({ kind: "roll", test: "save", ability: "wis", dc: 14, from: "Trap" }),
    ).toMatchObject({
      proposal: { kind: "roll", test: "save", ability: "wis", dc: 14, from: "Trap" },
    });
    const skill = read({
      kind: "roll",
      test: "check",
      ability: "dex",
      skill: "srd51:skill/stealth",
    });
    expect(skill).toMatchObject({ proposal: { test: "check", skill: "srd51:skill/stealth" } });
    expect(skill?.t === "propose" && "dc" in skill.proposal).toBe(false);
  });

  it("refuses an unknown ability or kind of roll, and keeps a skill only on a check", () => {
    expect(read({ kind: "roll", test: "save", ability: "luck" })).toBeUndefined();
    expect(read({ kind: "roll", test: "initiative", ability: "dex" })).toBeUndefined();
    const save = read({
      kind: "roll",
      test: "save",
      ability: "con",
      skill: "srd51:skill/arcana",
      dc: 99,
    });
    expect(
      save?.t === "propose" && save.proposal.kind === "roll" && save.proposal.skill,
    ).toBeFalsy();
    expect(save).toMatchObject({ proposal: { dc: 40 } });
  });

  it("carries the total back with the answer", () => {
    expect(
      parseClientMessage(JSON.stringify({ t: "answer", id: "a", accepted: true, result: 17 })),
    ).toEqual({
      t: "answer",
      id: "a",
      accepted: true,
      result: 17,
    });
  });
});
