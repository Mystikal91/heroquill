import { useState } from "preact/hooks";
import { gainCoins, spendFromPurse } from "../app/purse";
import { character, updateCharacter } from "../app/store";
import { offerUndo } from "../app/undo";
import { COINS, type Coin, NO_COINS, canPay, goldValue, toCopper, withCoin } from "../engine/coins";
import { type UiKey, ui } from "../i18n/ui";
import { unitLocale } from "../i18n/units";
import { coinsText } from "./coinText";
import { Panel } from "./sheet/parts";
import { useHoldRepeat } from "./useHoldRepeat";

/** One counter per kind of coin: a number to type, and one up or down with the buttons. */
export function Coins() {
  const hold = useHoldRepeat();
  const coins = character.value.coins ?? NO_COINS;
  const set = (coin: Coin, amount: number) =>
    updateCharacter((d) => {
      d.coins = withCoin(d.coins, coin, amount);
    });
  // The buttons read the amount when pressed, so quick taps all count.
  const step = (coin: Coin, by: number) =>
    updateCharacter((d) => {
      d.coins = withCoin(d.coins, coin, (d.coins?.[coin] ?? 0) + by);
    });
  const total = goldValue(coins);

  return (
    <div class="coins">
      <div class="coin-row">
        {COINS.map((coin) => {
          const name = ui(`coin.${coin}.name` as UiKey);
          return (
            <div class="coin" key={coin}>
              <label htmlFor={`coin-${coin}`} title={name}>
                {ui(`coin.${coin}` as UiKey)}
              </label>
              <div class="coin-controls">
                <button
                  type="button"
                  class="hold"
                  aria-label={ui("coin.less", { coin: name })}
                  disabled={coins[coin] <= 0}
                  {...hold(() => step(coin, -1))}
                >
                  −
                </button>
                <input
                  id={`coin-${coin}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={coins[coin]}
                  onInput={(e) => set(coin, Number.parseInt(e.currentTarget.value, 10))}
                />
                <button
                  type="button"
                  class="hold"
                  aria-label={ui("coin.more", { coin: name })}
                  {...hold(() => step(coin, 1))}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p class="muted">
        {ui("coin.total", {
          gp: total.toLocaleString(unitLocale.value, { maximumFractionDigits: 2 }),
        })}
      </p>
      <SpendGain />
    </div>
  );
}

/**
 * Spend or gain an amount of one kind of coin. Spending works out which coins to hand over and
 * gives change in the biggest coins there are (15 gp with 2 pp leaves 5 gp); gaining adds the
 * coins as they are. Both can be taken back from the notice.
 */
function SpendGain() {
  const [text, setText] = useState("");
  const [coin, setCoin] = useState<Coin>("gp");
  const [said, setSaid] = useState("");
  const coins = character.value.coins ?? NO_COINS;
  const amount = Number(text.replace(",", "."));
  const valid = text.trim() !== "" && Number.isFinite(amount) && toCopper(amount, coin) >= 1;
  const cost = valid ? toCopper(amount, coin) : 0;
  const enough = valid && canPay(coins, cost);
  const named = `${amount.toLocaleString(unitLocale.value)} ${ui(`coin.${coin}` as UiKey)}`;

  const spend = () => {
    const done = valid ? spendFromPurse(cost) : undefined;
    if (!done) {
      setSaid(ui("coin.spend.none"));
      return;
    }
    const line = coinsText(done.change)
      ? ui("coin.spent", {
          cost: named,
          paid: coinsText(done.paid),
          change: coinsText(done.change),
        })
      : ui("coin.spent.exact", { cost: named, paid: coinsText(done.paid) });
    setSaid(line);
    setText("");
    offerUndo(line, done.undo);
  };
  const gain = () => {
    const done = valid && Number.isInteger(amount) ? gainCoins(coin, amount) : undefined;
    if (!done) {
      setSaid(ui("coin.gain.whole"));
      return;
    }
    const line = ui("coin.gained", { gain: named });
    setSaid(line);
    setText("");
    offerUndo(line, done.undo);
  };

  return (
    <div class="coin-spend">
      <input
        type="text"
        inputMode="decimal"
        class="coin-spend-amount"
        value={text}
        placeholder={ui("coin.spend.placeholder")}
        aria-label={ui("coin.spend.amount")}
        onInput={(e) => {
          setText(e.currentTarget.value);
          setSaid("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && enough) spend();
        }}
      />
      <select
        class="coin-spend-unit"
        value={coin}
        aria-label={ui("coin.spend.unit")}
        onChange={(e) => setCoin(e.currentTarget.value as Coin)}
      >
        {COINS.map((c) => (
          <option key={c} value={c}>
            {ui(`coin.${c}` as UiKey)}
          </option>
        ))}
      </select>
      <button
        type="button"
        class="card-btn card-primary"
        disabled={!enough}
        title={valid && !enough ? ui("coin.spend.none") : undefined}
        onClick={spend}
      >
        {ui("coin.spend")}
      </button>
      <button
        type="button"
        class="card-btn"
        disabled={!valid || !Number.isInteger(amount)}
        onClick={gain}
      >
        {ui("coin.gain")}
      </button>
      <output class="coin-spend-said muted">{said}</output>
    </div>
  );
}

/** The coins as a panel of their own, for the Play screen. */
export function CoinsPanel() {
  return (
    <Panel title={ui("coin.title")}>
      <Coins />
    </Panel>
  );
}
