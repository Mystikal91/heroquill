import { describe, expect, it } from "vitest";
import { srd51Packs } from "../test/srd51";
import { bothIndex, loadSrd52Pack, srd52Packs } from "../test/srd52";
import { monstersOf } from "./companions";
import { indexPacks } from "./derive";

const monsters = loadSrd52Pack("monsters");
const index = indexPacks(...srd52Packs, monsters);
const get = (slug: string) => index.get(`srd52:monster/${slug}`);

describe("the 2024 monsters", () => {
  it("are the 342 of the SRD, every id a 2024 one", () => {
    expect(monsters.entries.length).toBe(342);
    for (const e of monsters.entries) {
      expect(e.kind).toBe("monster");
      expect(e.id.startsWith("srd52:monster/")).toBe(true);
    }
  });

  it("keep the stat block as the book has it", () => {
    expect(get("aboleth")?.data).toMatchObject({
      size: "large",
      type: "aberration",
      hitPoints: 150,
      hitPointsRoll: "20d10 + 40",
      challenge: 10,
      xp: 5900,
      proficiencyBonus: 4,
      saves: { dex: 3, con: 6, int: 8, wis: 6 },
      skills: { history: 12, perception: 10 },
    });
    expect(get("octopus")?.data).toMatchObject({ size: "small", challenge: 0, hitPoints: 3 });
  });

  it("point to the 2024 spells and forms, never to the 2014 ones", () => {
    const text = JSON.stringify(monsters.entries);
    expect(text).not.toContain("srd51:");
    expect(get("werewolf-hybrid")?.data.forms).toContain("srd52:monster/werewolf-human");
    for (const e of monsters.entries) {
      for (const list of ["actions", "special", "reactions", "legendary"] as const) {
        const actions = (e.data[list] ?? []) as {
          spellcasting?: { spells: { spell: string }[] };
        }[];
        for (const a of actions)
          for (const s of a.spellcasting?.spells ?? [])
            expect(index.has(s.spell), `${e.id} ${s.spell}`).toBe(true);
      }
    }
  });

  it("are listed for a character of the same edition only", () => {
    const both = indexPacks(...srd51Packs, ...srd52Packs, monsters);
    const of2024 = monstersOf(both, "srd52");
    expect(of2024.length).toBe(342);
    expect(of2024.every((e) => e.id.startsWith("srd52:"))).toBe(true);
    expect(monstersOf(both, "srd51").some((e) => e.id.startsWith("srd52:"))).toBe(false);
    expect(monstersOf(bothIndex, "srd52")).toEqual([]);
  });
});
