import type { Coin, Coins } from "../engine/coins";
import { type UiKey, ui } from "../i18n/ui";
import { unitLocale } from "../i18n/units";

const BIGGEST_FIRST: readonly Coin[] = ["pp", "gp", "ep", "sp", "cp"];

/** Coins as words, the biggest first: "2 PP, 3 GP". Empty for no coins. */
export function coinsText(coins: Coins): string {
  return BIGGEST_FIRST.filter((coin) => coins[coin] > 0)
    .map((coin) => `${coins[coin].toLocaleString(unitLocale.value)} ${ui(`coin.${coin}` as UiKey)}`)
    .join(", ");
}

/**
 * A price (copper pieces) as the books write it: gold, silver and copper, never platinum, so 15 gp
 * stays "15 GP" and 250 is "2 GP, 5 SP".
 */
export function copperText(copper: number): string {
  const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  let rest = Math.max(0, Math.round(copper));
  for (const [coin, value] of [
    ["gp", 100],
    ["sp", 10],
    ["cp", 1],
  ] as const) {
    coins[coin] = Math.floor(rest / value);
    rest -= coins[coin] * value;
  }
  return coinsText(coins);
}
