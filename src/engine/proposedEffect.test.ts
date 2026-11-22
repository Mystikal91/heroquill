import { describe, expect, it } from "vitest";
import { createPlayState } from "./character";
import {
  addProposedEffect,
  advanceRound,
  customRoundsKey,
  removeCustomEffect,
  setRounds,
  toggleCondition,
} from "./play";

describe("an effect the DM proposed", () => {
  it("may change nothing: a name and a note, with a limit in rounds", () => {
    const play = addProposedEffect(createPlayState(), {
      name: "Curse of Strahd",
      note: "Disadvantage on checks in the castle",
      effects: [],
      rounds: 3,
    });
    expect(play.customEffects).toEqual([
      {
        id: "curse-of-strahd",
        name: "Curse of Strahd",
        note: "Disadvantage on checks in the castle",
        effects: [],
      },
    ]);
    expect(play.rounds?.[customRoundsKey("curse-of-strahd")]).toBe(3);
  });

  it("is refused without a name, and two of the same name stay apart", () => {
    const empty = createPlayState();
    expect(addProposedEffect(empty, { name: "  ", effects: [] })).toBe(empty);
    const two = addProposedEffect(addProposedEffect(empty, { name: "Aid", effects: [] }), {
      name: "Aid",
      effects: [],
    });
    expect(two.customEffects?.map((e) => e.id)).toEqual(["aid", "aid-2"]);
  });

  it("counts down with the rounds and leaves the list when they run out", () => {
    let play = addProposedEffect(createPlayState(), { name: "Slow", effects: [], rounds: 2 });
    play = advanceRound(play).play;
    expect(play.customEffects).toHaveLength(1);
    const last = advanceRound(play);
    expect(last.ended).toEqual([customRoundsKey("slow")]);
    expect(last.play.customEffects).toBeUndefined();
    expect(last.play.rounds).toBeUndefined();
  });

  it("takes its rounds with it when it is removed, and leaves conditions alone", () => {
    let play = addProposedEffect(createPlayState(), { name: "Slow", effects: [], rounds: 5 });
    play = setRounds(toggleCondition(play, "srd51:condition/prone"), "srd51:condition/prone", 2);
    const removed = removeCustomEffect(play, "slow");
    expect(removed.rounds).toEqual({ "srd51:condition/prone": 2 });
    expect(removed.conditions).toEqual(["srd51:condition/prone"]);
  });
});
