import { type DamageKind, adjustDamage } from "../../engine/play";
import { type UiKey, ui } from "../../i18n/ui";

/** The kinds, with the name of the button and the factor written under it. */
const KINDS: [DamageKind, UiKey, string][] = [
  ["normal", "play.damage", ""],
  ["resistant", "play.damageResistant", "(×½)"],
  ["vulnerable", "play.damageVulnerable", "(×2)"],
];

/**
 * The buttons that take a number the person typed as damage: as it is, halved for a resistance
 * (rage, a spell, an item) or doubled for a vulnerability. The number is the damage of the roll;
 * once typed, each button shows what it will take off. `apply` gets what is dealt. `kinds` picks
 * some of them (the hit points panel has the plain one beside the number and the others under).
 */
export function DamageButtons({
  amount,
  apply,
  kinds,
}: {
  amount: number;
  apply: (dealt: number) => void;
  kinds?: DamageKind[];
}) {
  return (
    <>
      {KINDS.filter(([kind]) => !kinds || kinds.includes(kind)).map(([kind, label, factor]) => {
        const dealt = adjustDamage(amount, kind);
        return (
          <button
            type="button"
            key={kind}
            class="danger-btn damage-kind"
            data-kind={kind}
            aria-label={factor ? `${ui(label)} ${factor}` : ui(label)}
            disabled={amount === 0}
            onClick={() => apply(dealt)}
          >
            {ui(label)}
            {factor && <small>{amount > 0 ? `${factor} → ${dealt}` : factor}</small>}
          </button>
        );
      })}
    </>
  );
}
