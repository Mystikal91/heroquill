import { describe, expect, it } from "vitest";
import { type Coins, NO_COINS, canPay, copperValue, spendCoins, toCopper } from "./coins";

const purse = (c: Partial<Coins>): Coins => ({ ...NO_COINS, ...c });

describe("spending coins", () => {
  it("pays 15 gp with 2 pp and gives 5 gp back", () => {
    const r = spendCoins(purse({ pp: 2 }), toCopper(15, "gp"));
    expect(r?.paid).toEqual(purse({ pp: 2 }));
    expect(r?.change).toEqual(purse({ gp: 5 }));
    expect(r?.coins).toEqual(purse({ gp: 5 }));
  });

  it("pays a price in gold with gold and platinum, keeping what is left", () => {
    const r = spendCoins(purse({ pp: 1, gp: 20 }), toCopper(15, "gp"));
    expect(r?.paid).toEqual(purse({ pp: 1, gp: 5 }));
    expect(r?.change).toEqual(NO_COINS);
    expect(r?.coins).toEqual(purse({ gp: 15 }));
  });

  it("gives change in the biggest coins, never in electrum", () => {
    const r = spendCoins(purse({ pp: 1 }), toCopper(1, "sp"));
    expect(r?.change).toEqual(purse({ gp: 9, sp: 9 }));
    const small = spendCoins(purse({ gp: 1 }), 1);
    expect(small?.change).toEqual(purse({ sp: 9, cp: 9 }));
    expect(small?.coins.ep).toBe(0);
  });

  it("uses the smallest coin that covers what is still owed", () => {
    // 60 cp owed with an electrum (50), a gold (100) and a platinum (1000): the electrum goes first,
    // and the 10 still owed is covered by the gold, not the platinum.
    const r = spendCoins(purse({ ep: 1, gp: 1, pp: 1 }), 60);
    expect(r?.paid).toEqual(purse({ ep: 1, gp: 1 }));
    expect(r?.change).toEqual(purse({ sp: 9, cp: 0 }));
    expect(r?.coins).toEqual(purse({ pp: 1, sp: 9 }));
  });

  it("never loses or makes money", () => {
    const start = purse({ cp: 7, sp: 3, ep: 1, gp: 4, pp: 2 });
    for (const cost of [1, 9, 10, 55, 100, 250, 999, 2000, 2284, 2287]) {
      const r = spendCoins(start, cost);
      if (!r) {
        expect(copperValue(start)).toBeLessThan(cost);
        continue;
      }
      expect(copperValue(r.coins)).toBe(copperValue(start) - cost);
      for (const coin of ["cp", "sp", "ep", "gp", "pp"] as const) {
        expect(r.coins[coin]).toBeGreaterThanOrEqual(0);
        expect(r.paid[coin]).toBeLessThanOrEqual(start[coin]);
      }
    }
  });

  it("says no when the purse is worth less, and for a price that is not a number", () => {
    expect(spendCoins(purse({ gp: 14 }), toCopper(15, "gp"))).toBeUndefined();
    expect(canPay(purse({ gp: 15 }), toCopper(15, "gp"))).toBe(true);
    expect(canPay(purse({ gp: 15 }), 0)).toBe(false);
    expect(canPay(undefined, 1)).toBe(false);
    expect(canPay(purse({ gp: 5 }), Number.NaN)).toBe(false);
  });

  it("reads prices with decimals in copper", () => {
    expect(toCopper(2.5, "gp")).toBe(250);
    expect(toCopper(0.5, "gp")).toBe(50);
    expect(toCopper(5, "sp")).toBe(50);
  });
});
