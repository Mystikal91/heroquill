import { describe, expect, it } from "vitest";
import srd from "../../data/srd51/items.json";
import en from "../../locales/en/srd51/items.json";
import { healingDice } from "../import/aurora/items";
import { healingOf } from "./gear";

type Item = { id: string; kind: string; data: Record<string, unknown> };
const items = (srd as { entries: Item[] }).entries.filter((e) => e.kind === "item");
const potion = (slug: string) => items.find((e) => e.id === `srd51:item/${slug}`);
const text = (slug: string) => (en as Record<string, string>)[`${slug}.desc`] ?? "";

describe("the hit points a potion of healing gives back", () => {
  // The Potions of Healing table of the SRD 5.1, p. 234.
  const TABLE = {
    "potion-of-healing-common": "2d4+2",
    "potion-of-healing-greater": "4d4+4",
    "potion-of-healing-superior": "8d4+8",
    "potion-of-healing-supreme": "10d4+20",
  };

  for (const [slug, dice] of Object.entries(TABLE)) {
    it(`${slug} heals ${dice}, as the table and its own text say`, () => {
      const entry = potion(slug) as Parameters<typeof healingOf>[0];
      expect(healingOf(entry)).toBe(dice);
      // The number in the data is the one in the text of the potion: the two cannot drift apart.
      expect(healingDice(text(slug))).toBe(dice);
    });
  }

  it("is only on the four potions: no other SRD item says it heals when used", () => {
    const healing = items
      .filter((e) => healingOf(e as Parameters<typeof healingOf>[0]) !== undefined)
      .map((e) => e.id.split("/").pop());
    expect(healing.sort()).toEqual(Object.keys(TABLE).sort());
  });
});
