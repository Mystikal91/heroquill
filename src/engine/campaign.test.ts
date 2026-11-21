import { describe, expect, it } from "vitest";
import {
  MAX_PARTY,
  addMember,
  changeMember,
  createCampaign,
  newMember,
  readCampaign,
  removeMember,
  renameCampaign,
} from "./campaign";

describe("campaign", () => {
  it("keeps the numbers of a player in their limits", () => {
    const m = newMember({ name: "Aria", maxHp: 0, ac: 500, initiativeBonus: 99 });
    expect(m.maxHp).toBe(1);
    expect(m.ac).toBe(99);
    expect(m.initiativeBonus).toBe(30);
    expect(m.speed).toBeUndefined();
  });

  it("adds, changes and removes players", () => {
    let c = createCampaign("Lost Mine");
    const aria = newMember({ name: "Aria" });
    c = addMember(c, aria);
    c = changeMember(c, aria.id, (m) => ({ ...m, name: "Ari", ac: 17, maxHp: -4 }));
    expect(c.party[0]).toMatchObject({ id: aria.id, name: "Ari", ac: 17, maxHp: 1 });
    c = removeMember(c, aria.id);
    expect(c.party).toEqual([]);
  });

  it("does not let a party grow past its size", () => {
    let c = createCampaign("Big");
    for (let i = 0; i < MAX_PARTY + 3; i++) c = addMember(c, newMember({ name: `P${i}` }));
    expect(c.party).toHaveLength(MAX_PARTY);
  });

  it("renames", () => {
    expect(renameCampaign(createCampaign("a"), "b").name).toBe("b");
  });

  it("reads what is stored and repairs it", () => {
    expect(readCampaign(null)).toBeUndefined();
    expect(readCampaign({ name: "no id" })).toBeUndefined();
    const read = readCampaign({
      id: "c1",
      name: 5,
      party: [{ id: "m1", name: "Bo", maxHp: 12, ac: 14, speed: 30 }, { name: "no id" }, 7],
    });
    expect(read?.name).toBe("");
    expect(read?.party).toEqual([
      { id: "m1", name: "Bo", maxHp: 12, ac: 14, speed: 30, initiativeBonus: 0 },
    ]);
  });
});
