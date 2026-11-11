import { describe, expect, it } from "vitest";
import { bothIndex } from "../test/srd52";

type ItemData = {
  category?: string;
  rarity?: string;
  attunement?: boolean;
  slot?: string;
};

const items = [...bothIndex.values()].filter(
  (e) => e.id.startsWith("srd52:item/") && (e.data as ItemData).category === "magic-items",
);
const data = (slug: string) => bothIndex.get(`srd52:item/${slug}`)?.data as ItemData | undefined;

describe("the 2024 magic items", () => {
  it("are the 271 of the book: the entries that only point to their variants are left out", () => {
    expect(items.length).toBe(271);
    for (const pointer of ["armor", "weapon", "shield", "ammunition", "wand-of-the-war-mage"]) {
      expect(data(pointer)?.category, pointer).not.toBe("magic-items");
    }
    expect(data("armor-1")?.rarity).toBe("rare");
    expect(data("weapon-3")?.rarity).toBe("very-rare");
  });

  it("have the rarity and the attunement of the book", () => {
    expect(data("bag-of-holding")).toMatchObject({ rarity: "uncommon", attunement: false });
    expect(data("holy-avenger")).toMatchObject({ rarity: "legendary", attunement: true });
    expect(data("bead-of-nourishment")).toMatchObject({ rarity: "common", attunement: false });
  });

  it("have no rarity when it varies", () => {
    expect(data("potions-of-healing")).toBeDefined();
    expect(data("potions-of-healing")).not.toHaveProperty("rarity");
  });

  it("are worn where they go", () => {
    expect(data("ring-of-protection")?.slot).toBe("ring");
    expect(data("rod-of-resurrection")?.slot).toBe("oneHand");
    expect(data("energy-bow")?.slot).toBe("oneHand");
    expect(data("shield-of-the-cavalier")?.slot).toBe("shield");
    expect(data("potion-of-longevity")?.slot).toBeUndefined();
  });

  it("include the fifteen that the first file of the fork lacked", () => {
    for (const slug of [
      "bead-of-nourishment",
      "cloak-of-invisibility",
      "elixir-of-health",
      "energy-bow",
      "gloves-of-thievery",
      "hat-of-many-spells",
      "potion-of-invulnerability",
      "potion-of-longevity",
      "potion-of-vitality",
      "quarterstaff-of-the-acrobat",
      "rod-of-resurrection",
      "sending-stones",
      "sentinel-shield",
      "shield-of-the-cavalier",
      "thunderous-greatclub",
    ]) {
      expect(data(slug), slug).toBeDefined();
    }
  });
});
