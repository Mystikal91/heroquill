import { describe, expect, it } from "vitest";
import { syncItemData } from "./sync";

describe("facts that follow from others", () => {
  it("makes a weapon usable by the proficiency of its category", () => {
    const data = { weapon: { category: "martial", proficiency: ["weapon:simple-weapons"] } };
    expect(syncItemData(data).weapon).toEqual({
      category: "martial",
      proficiency: ["weapon:martial-weapons"],
    });
  });

  it("does the same for armor, shields included", () => {
    expect(
      (syncItemData({ armor: { category: "heavy" } }).armor as { proficiency: string[] })
        .proficiency,
    ).toEqual(["armor:heavy-armor"]);
    expect(
      (syncItemData({ armor: { category: "shield" } }).armor as { proficiency: string[] })
        .proficiency,
    ).toEqual(["armor:shields"]);
  });

  it("leaves other data alone", () => {
    const data = { category: "adventuring-gear", cost: { amount: 1, unit: "gp" } };
    expect(syncItemData(data)).toEqual(data);
  });
});
