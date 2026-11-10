import { type Coin, NO_COINS, type Spending, spendCoins, withCoin } from "../engine/coins";
import { character, updateCharacter } from "./store";

/** Puts the coins back as they were: what "undo" does after a spending or a gain. */
function restoreCoins(before: typeof NO_COINS) {
  updateCharacter((d) => {
    d.coins = { ...before };
  });
}

/**
 * Pays a price (copper pieces) from the coins of the character, with change. Nothing when they do
 * not have enough. `undo` puts the coins back.
 */
export function spendFromPurse(cost: number): (Spending & { undo: () => void }) | undefined {
  const before = { ...NO_COINS, ...character.value.coins };
  const spending = spendCoins(before, cost);
  if (!spending) return undefined;
  updateCharacter((d) => {
    d.coins = spending.coins;
  });
  return { ...spending, undo: () => restoreCoins(before) };
}

/** Adds coins as they are: 150 silver stays 150 silver. `undo` puts the coins back. */
export function gainCoins(coin: Coin, amount: number): { undo: () => void } | undefined {
  const whole = Math.floor(amount);
  if (!Number.isFinite(whole) || whole <= 0) return undefined;
  const before = { ...NO_COINS, ...character.value.coins };
  updateCharacter((d) => {
    d.coins = withCoin(d.coins, coin, (d.coins?.[coin] ?? 0) + whole);
  });
  return { undo: () => restoreCoins(before) };
}
