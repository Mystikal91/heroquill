/** The coins a character carries, to keep track of money. Nothing else reads them. */
export interface Coins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export const COINS = ["cp", "sp", "ep", "gp", "pp"] as const;
export type Coin = (typeof COINS)[number];

export const NO_COINS: Coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };

/** What a coin is worth in gold pieces. */
const IN_GOLD: Record<Coin, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** All the coins together, as gold pieces. */
export const goldValue = (coins: Coins | undefined): number =>
  COINS.reduce((sum, coin) => sum + (coins?.[coin] ?? 0) * IN_GOLD[coin], 0);

/** How many coins make a pound. */
export const COINS_PER_POUND = 50;

/** The weight of all the coins, in pounds. */
export const coinWeight = (coins: Coins | undefined): number =>
  COINS.reduce((sum, coin) => sum + (coins?.[coin] ?? 0), 0) / COINS_PER_POUND;

/** What a coin is worth in copper pieces: whole numbers, so a sum is never off by a rounding. */
const IN_COPPER: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** An amount of one kind of coin, in copper pieces. */
export const toCopper = (amount: number, coin: Coin): number =>
  Math.round(amount * IN_COPPER[coin]);

/** All the coins together, in copper pieces. */
export const copperValue = (coins: Coins | undefined): number =>
  COINS.reduce((sum, coin) => sum + (coins?.[coin] ?? 0) * IN_COPPER[coin], 0);

/** What a spending did: the purse that is left, the coins handed over and the change given back. */
export interface Spending {
  coins: Coins;
  paid: Coins;
  change: Coins;
}

/** The kinds of coin change is given in, the biggest first. Electrum is only ever paid, never given. */
const CHANGE_COINS: readonly Coin[] = ["pp", "gp", "sp", "cp"];

/**
 * Pays `cost` (copper pieces) from a purse. The biggest coins that do not go over are handed over
 * first, so a price in gold is paid in gold and platinum as it would at a counter; what is still
 * owed is covered with the smallest coin that is left (which is worth more than what is owed), and
 * the difference comes back as change in the biggest coins there are: 15 gp with 2 pp gives back
 * 5 gp. Nothing when the purse is worth less than the price (or the price is not a positive number).
 */
export function spendCoins(coins: Coins | undefined, cost: number): Spending | undefined {
  const purse: Coins = { ...NO_COINS, ...coins };
  if (!Number.isFinite(cost) || cost <= 0 || copperValue(purse) < cost) return undefined;
  const paid: Coins = { ...NO_COINS };
  let owed = cost;
  for (const coin of [...COINS].sort((a, b) => IN_COPPER[b] - IN_COPPER[a])) {
    const take = Math.min(purse[coin], Math.floor(owed / IN_COPPER[coin]));
    paid[coin] += take;
    owed -= take * IN_COPPER[coin];
  }
  for (const coin of [...COINS].sort((a, b) => IN_COPPER[a] - IN_COPPER[b])) {
    if (owed <= 0) break;
    const take = Math.min(purse[coin] - paid[coin], Math.ceil(owed / IN_COPPER[coin]));
    paid[coin] += take;
    owed -= take * IN_COPPER[coin];
  }
  let back = Math.max(0, -owed);
  const change: Coins = { ...NO_COINS };
  for (const coin of CHANGE_COINS) {
    change[coin] = Math.floor(back / IN_COPPER[coin]);
    back -= change[coin] * IN_COPPER[coin];
  }
  const left = { ...NO_COINS };
  for (const coin of COINS) left[coin] = purse[coin] - paid[coin] + change[coin];
  return { coins: left, paid, change };
}

/** Whether a purse can pay a price (copper pieces). */
export const canPay = (coins: Coins | undefined, cost: number): boolean =>
  spendCoins(coins, cost) !== undefined;

/** The coins with one kind set to a whole number of at least zero. */
export function withCoin(coins: Coins | undefined, coin: Coin, amount: number): Coins {
  const whole = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  return { ...NO_COINS, ...coins, [coin]: whole };
}
