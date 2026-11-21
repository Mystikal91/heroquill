import { describe, expect, it } from "vitest";
import type { Entry } from "../data/schema";
import {
  type Combatant,
  type Encounter,
  activeCombatant,
  addCombatants,
  characterCombatant,
  createEncounter,
  endCombat,
  giveTempHp,
  heal,
  hurt,
  initiativeOrder,
  manualCombatant,
  monsterCombatant,
  newNames,
  nextTurn,
  readEncounter,
  removeCombatant,
  rollAllInitiative,
  setConditionRounds,
  setInitiative,
  setMaxHp,
  startCombat,
  toggleCondition,
} from "./encounter";

const make = (name: string, init?: number, bonus = 0, hp = 10): Combatant => ({
  ...manualCombatant({ name, maxHp: hp, ac: 12, initiativeBonus: bonus }),
  ...(init !== undefined && { initiative: init }),
});

const fight = (...list: Combatant[]): Encounter => addCombatants(createEncounter("Test"), list);

const names = (c: readonly Combatant[]) => c.map((x) => x.name);

describe("the initiative order", () => {
  it("puts the highest first, a tie to the higher bonus, then to who came first", () => {
    const list = [make("a", 10, 0), make("b", 15), make("c", 10, 3), make("d", 10, 0)];
    expect(names(initiativeOrder(list))).toEqual(["b", "c", "a", "d"]);
  });

  it("puts those with no initiative last, in the order they were added", () => {
    const list = [make("x"), make("a", 5), make("y"), make("b", 20)];
    expect(names(initiativeOrder(list))).toEqual(["b", "a", "x", "y"]);
  });

  it("rolls for creatures only, keeping typed values and the characters' own", () => {
    const pc = characterCombatant({
      characterId: "c1",
      name: "Hero",
      hp: 10,
      maxHp: 10,
      tempHp: 0,
      ac: 15,
      initiativeBonus: 2,
    });
    const typed = make("typed", 7);
    const rolled = rollAllInitiative(fight(make("goblin", undefined, 2), typed, pc), {}, () => 9);
    const byName = Object.fromEntries(rolled.combatants.map((c) => [c.name, c.initiative]));
    expect(byName).toEqual({ goblin: 12, typed: 7, Hero: undefined });
    const again = rollAllInitiative(rolled, { again: true, characters: true }, () => 0);
    // A roll of 1 on the die, plus each bonus: the goblin +2, the typed one 0, the hero +2.
    expect(again.combatants.map((c) => c.initiative)).toEqual([3, 1, 3]);
  });

  it("sets and clears an initiative", () => {
    const e = fight(make("a"));
    const id = e.combatants[0]?.id ?? "";
    expect(setInitiative(e, id, 14).combatants[0]?.initiative).toBe(14);
    expect(setInitiative(setInitiative(e, id, 14), id, undefined).combatants[0]?.initiative).toBe(
      undefined,
    );
  });
});

describe("turns and rounds", () => {
  const three = () => fight(make("a", 20), make("b", 10), make("c", 5));

  it("starts at round 1 with the top of the order", () => {
    const e = startCombat(three());
    expect(e.round).toBe(1);
    expect(activeCombatant(e)?.name).toBe("a");
  });

  it("does not start with nobody in the fight", () => {
    expect(startCombat(createEncounter("empty")).round).toBe(0);
  });

  it("passes the turn along and turns the round after the last one", () => {
    let e = startCombat(three());
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      e = nextTurn(e).encounter;
      seen.push(`${activeCombatant(e)?.name}${e.round}`);
    }
    expect(seen).toEqual(["b1", "c1", "a2", "b2"]);
  });

  it("skips creatures at 0 hit points but not characters", () => {
    const pc = {
      ...characterCombatant({
        characterId: "c1",
        name: "Hero",
        hp: 0,
        maxHp: 10,
        tempHp: 0,
        ac: 15,
        initiativeBonus: 0,
      }),
      initiative: 15,
    };
    const dead = { ...make("dead", 12), hp: 0 };
    let e = startCombat(fight(make("a", 20), pc, dead, make("c", 5)));
    const order: string[] = [];
    for (let i = 0; i < 3; i++) {
      e = nextTurn(e).encounter;
      order.push(activeCombatant(e)?.name ?? "");
    }
    expect(order).toEqual(["Hero", "c", "a"]);
  });

  it("counts down the rounds of a condition at the end of its owner's turn", () => {
    let e = startCombat(three());
    const a = e.combatants[0] as Combatant;
    e = {
      ...e,
      combatants: e.combatants.map((c) =>
        c.id === a.id
          ? setConditionRounds(toggleCondition(c, "x:condition/stunned"), "x:condition/stunned", 2)
          : c,
      ),
    };
    let report = nextTurn(e); // a ends: 2 -> 1
    expect(report.ended.conditions).toEqual([]);
    expect(report.encounter.combatants[0]?.rounds["x:condition/stunned"]).toBe(1);
    e = report.encounter;
    e = nextTurn(nextTurn(e).encounter).encounter; // b, c end: back to a
    expect(activeCombatant(e)?.name).toBe("a");
    report = nextTurn(e); // a ends: 1 -> gone
    expect(report.ended.conditions).toEqual(["x:condition/stunned"]);
    expect(report.encounter.combatants[0]?.conditions).toEqual([]);
  });

  it("does nothing when no fight is on, and ends cleanly", () => {
    const e = three();
    expect(nextTurn(e).encounter).toBe(e);
    const over = endCombat(startCombat(e));
    expect(over.round).toBe(0);
    expect(over.turn).toBeUndefined();
    expect(over.combatants[0]?.initiative).toBe(20);
  });

  it("passes the turn on when the active creature is removed", () => {
    const e = startCombat(three());
    const next = removeCombatant(e, e.turn ?? "");
    expect(names(next.combatants)).toEqual(["b", "c"]);
    expect(activeCombatant(next)?.name).toBe("b");
    const empty = removeCombatant(
      removeCombatant(removeCombatant(next, next.turn ?? ""), "x"),
      "y",
    );
    expect(empty.round).toBeGreaterThanOrEqual(0);
  });

  it("round of a lone creature advances each turn", () => {
    let e = startCombat(fight(make("solo", 10)));
    e = nextTurn(e).encounter;
    expect(e.round).toBe(2);
    expect(activeCombatant(e)?.name).toBe("solo");
  });
});

describe("hit points", () => {
  it("hits temporary hit points first and stops at 0", () => {
    const c = { ...make("a", undefined, 0, 10), tempHp: 4 };
    expect(hurt(c, 6)).toMatchObject({ hp: 8, tempHp: 0 });
    expect(hurt(c, 100)).toMatchObject({ hp: 0, tempHp: 0 });
    expect(hurt(c, 0)).toBe(c);
    expect(hurt(c, -5)).toBe(c);
  });

  it("heals up to the maximum, and temporary hit points do not stack", () => {
    const c = { ...make("a", undefined, 0, 10), hp: 3 };
    expect(heal(c, 100).hp).toBe(10);
    expect(giveTempHp(giveTempHp(c, 5), 3).tempHp).toBe(5);
    expect(giveTempHp(giveTempHp(c, 5), 8).tempHp).toBe(8);
  });

  it("keeps hit points inside a lowered maximum", () => {
    expect(setMaxHp(make("a", undefined, 0, 10), 4)).toMatchObject({ hp: 4, maxHp: 4 });
  });
});

describe("conditions", () => {
  it("takes the rounds with the condition", () => {
    const on = setConditionRounds(toggleCondition(make("a"), "c"), "c", 3);
    expect(on.rounds).toEqual({ c: 3 });
    expect(toggleCondition(on, "c")).toMatchObject({ conditions: [], rounds: {} });
  });

  it("gives no rounds to a condition that is not in force", () => {
    const c = make("a");
    expect(setConditionRounds(c, "c", 3)).toBe(c);
  });
});

describe("making combatants", () => {
  const goblin = {
    id: "srd51:monster/goblin",
    kind: "monster",
    effects: [],
    data: {
      armorClass: [{ value: 15 }],
      hitPoints: 7,
      hitPointsRoll: "2d6",
      abilities: { dex: 14 },
    },
  } as unknown as Entry;

  it("takes the numbers of a monster", () => {
    expect(monsterCombatant(goblin, "Goblin")).toMatchObject({
      ac: 15,
      hp: 7,
      maxHp: 7,
      initiativeBonus: 2,
      source: "srd51:monster/goblin",
    });
  });

  it("can roll the hit points instead of the average", () => {
    expect(monsterCombatant(goblin, "Goblin", { rollHp: true }, () => 5).maxHp).toBe(12);
  });

  it("numbers several of a kind and continues after the ones in the fight", () => {
    expect(newNames("Goblin", [], 1)).toEqual(["Goblin"]);
    expect(newNames("Goblin", [], 3)).toEqual(["Goblin 1", "Goblin 2", "Goblin 3"]);
    expect(newNames("Goblin", ["Goblin 1", "Goblin 2"], 2)).toEqual(["Goblin 3", "Goblin 4"]);
    expect(newNames("Goblin", ["Goblin"], 1)).toEqual(["Goblin 1"]);
    expect(newNames("Orc (boss)", [], 2)).toEqual(["Orc (boss) 1", "Orc (boss) 2"]);
  });

  it("holds at most so many in a fight", () => {
    const many = Array.from({ length: 80 }, (_, i) => make(`n${i}`));
    expect(addCombatants(createEncounter("big"), many).combatants).toHaveLength(60);
  });
});

describe("reading what was saved", () => {
  it("rejects what is not an encounter and repairs what is damaged", () => {
    expect(readEncounter(undefined)).toBeUndefined();
    expect(readEncounter({ name: "no id" })).toBeUndefined();
    const read = readEncounter({
      id: "e1",
      name: 5,
      round: 3,
      turn: "missing",
      combatants: [
        { id: "a", name: "A", hp: 99, maxHp: 10, conditions: ["x"], rounds: { x: 2, y: 4 } },
        "junk",
      ],
    });
    expect(read?.name).toBe("");
    expect(read?.round).toBe(0);
    expect(read?.turn).toBeUndefined();
    expect(read?.combatants).toHaveLength(1);
    expect(read?.combatants[0]).toMatchObject({ hp: 10, rounds: { x: 2 } });
  });

  it("round-trips an encounter", () => {
    const e = startCombat(fight(make("a", 12), make("b", 3)));
    expect(readEncounter(JSON.parse(JSON.stringify(e)))).toEqual(e);
  });
});
