import { signal } from "@preact/signals";
import { useState } from "preact/hooks";
import {
  addLog,
  changePlay,
  criticalExtra,
  criticalWeapon,
  rollCheck,
  rollDiceText,
} from "../../app/play";
import { character, content, sheet } from "../../app/store";
import { doubleDice } from "../../engine/dice";
import type { AttackResult } from "../../engine/equipment";
import {
  castSpell,
  setMagicWeapon,
  setSacredWeapon,
  setShillelagh,
  slotsLeft,
} from "../../engine/play";
import { canSpend, spendPool } from "../../engine/spends";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { attackName } from "../attackName";
import { damageName } from "../damageName";
import { ruleDetail } from "../rules/EntryDetail";
import { extraAmount, extraKey, extraName, extraNote } from "../sheet/ExtraDamage";
import { BowIcon, ChecksIcon, CriticalIcon, SwordIcon } from "./icons";

/** The weapon whose attack was just rolled: its damage button asks to be tapped. */
const damageDue = signal<string | undefined>(undefined);

const withBonus = (dice: string, bonus: number) =>
  `${dice}${bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : bonus}`;

/** One weapon: its name and what it is, then a button for the attack and one for each damage. */
function AttackCard({ a }: { a: AttackResult }) {
  const c = content.value;
  const s = sheet.value;
  if (!c || !s) return null;
  const name = attackName(c, a);
  // A rage adds to the melee attacks made with Strength.
  const rage = s.extraDamage.find((e) => e.kind === "rage");
  const rageBonus =
    character.value.play.raging && !a.ranged && a.ability === "str" && rage?.kind === "rage"
      ? rage.bonus
      : 0;
  const damages = [
    ...(a.damage ? [{ key: "one", label: undefined, part: a.damage }] : []),
    ...(a.twoHandedDamage
      ? [{ key: "two", label: ui("play.weaponTwoHands"), part: a.twoHandedDamage }]
      : []),
  ].map((d) => ({ ...d, dice: withBonus(d.part.dice, d.part.bonus + rageBonus) }));
  const critical = criticalWeapon.value === a.itemId;
  const due = damageDue.value === a.itemId;

  const attack = () => {
    const roll = rollCheck(`${name} - ${ui("play.attackRoll")}`, a.attackBonus, {
      critMin: s.critRange,
    });
    criticalExtra.value = roll.critical;
    // A natural 20 arms the critical damage; any other attack clears it.
    if (roll.critical) criticalWeapon.value = a.itemId;
    else if (criticalWeapon.value === a.itemId) criticalWeapon.value = undefined;
    // The damage is due, unless the attack was a fumble.
    damageDue.value = a.damage && !roll.fumble ? a.itemId : undefined;
  };
  // A paladin's Channel Divinity: Sacred Weapon, turned on from the weapon: it takes the use it costs
  // (unless it is only moved from another weapon) and ends with a rest or when the rounds run out.
  const sacredSpend = Object.entries(s.spends).find(([id]) =>
    id.endsWith("/channel-divinity-sacred-weapon"),
  )?.[1];
  const sacredElsewhere = character.value.play.sacredWeapon !== undefined;
  const sacredOn = a.sacredWeapon !== undefined;
  const sacredCannot =
    !sacredOn &&
    !sacredElsewhere &&
    sacredSpend !== undefined &&
    !canSpend(character.value.play, sacredSpend, s.resources);
  // A monk can spend a ki point for two unarmed strikes as a bonus action: Flurry of Blows.
  const flurryId = "srd51:feature/flurry-of-blows";
  const flurry = a.unarmed ? s.spends[flurryId] : undefined;
  const flurryNow = () => {
    if (!flurry) return;
    changePlay((p) => spendPool(p, flurry, s.resources));
    let landed = false;
    let fumbled = true;
    for (const n of [1, 2]) {
      const roll = rollCheck(`${name} - ${c.name(flurryId)} ${n}`, a.attackBonus, {
        critMin: s.critRange,
      });
      landed = landed || roll.critical;
      fumbled = fumbled && roll.fumble;
    }
    criticalExtra.value = landed;
    criticalWeapon.value = landed ? a.itemId : undefined;
    damageDue.value = a.damage && !fumbled ? a.itemId : undefined;
  };
  const hurt = (dice: string) => {
    const text = critical ? (doubleDice(dice) ?? dice) : dice;
    const label = `${name} - ${ui("play.damageRoll")}`;
    rollDiceText(critical ? `${label} (${ui("play.criticalDamage")})` : label, text);
    if (critical) criticalWeapon.value = undefined;
    damageDue.value = undefined;
  };

  const range = a.range.long
    ? ui("play.weaponRange", { normal: distance(a.range.normal), long: distance(a.range.long) })
    : a.ranged
      ? distance(a.range.normal)
      : "";
  const meta = [
    ui(a.ranged ? "play.weaponRanged" : "play.weaponMelee"),
    ...(a.offHand ? [ui("play.weaponOffHand")] : []),
    ...(a.bonusAction ? [ui("play.unarmedBonus")] : []),
    ...a.properties.map((p) => c.name(p)),
    ...(a.mastery ? [c.name(a.mastery)] : []),
    range,
  ].filter(Boolean);

  return (
    <li class="play-card attack-card" data-damage={a.damage?.type ?? ""}>
      <span class="card-badge" aria-hidden="true">
        {a.ranged ? <BowIcon /> : <SwordIcon />}
      </span>
      <div class="card-head">
        {a.unarmed ? (
          <b class="card-name">{name}</b>
        ) : (
          <button
            type="button"
            class="link card-name"
            aria-label={`${ui("spells.info")}: ${name}`}
            onClick={() => {
              ruleDetail.value = a.itemId;
            }}
          >
            {name}
            {a.enhancement > 0 && <span class="card-tag">+{a.enhancement}</span>}
          </button>
        )}
        <span class="card-meta">{meta.join(" · ")}</span>
      </div>
      <div class="card-actions attack-actions">
        <div class="card-main">
          <button type="button" class="card-btn card-primary card-wide" onClick={attack}>
            <ChecksIcon />
            <span>{ui("play.attackRoll")}</span>
            <b>{signed(a.attackBonus)}</b>
          </button>
          {a.damage && (
            <button
              type="button"
              class="card-btn card-crit"
              aria-pressed={critical}
              aria-label={ui("play.criticalHit")}
              title={ui("play.criticalHit")}
              onClick={() => {
                criticalWeapon.value = critical ? undefined : a.itemId;
              }}
            >
              <CriticalIcon />
            </button>
          )}
        </div>
        {flurry && (
          <button
            type="button"
            class="card-btn card-effect"
            disabled={!canSpend(character.value.play, flurry, s.resources)}
            onClick={flurryNow}
          >
            {`${c.name(flurryId)} · ${flurry.cost} ki`}
          </button>
        )}
        {(a.canMagicWeapon || a.magicWeapon) && (
          <div class="card-effect-group" title={ui("play.magicWeaponHint")}>
            <span>{ui("play.magicWeapon")}</span>
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                class="card-btn card-effect"
                aria-pressed={a.magicWeapon === n}
                aria-label={ui("play.magicWeaponBonus", { n })}
                onClick={() =>
                  changePlay((p) =>
                    setMagicWeapon(
                      p,
                      a.magicWeapon === n ? undefined : { itemId: a.itemId, bonus: n },
                    ),
                  )
                }
              >
                +{n}
              </button>
            ))}
          </div>
        )}
        {a.canSacredWeapon && (
          <button
            type="button"
            class="card-btn card-effect"
            aria-pressed={sacredOn}
            disabled={sacredCannot}
            title={ui("play.sacredWeaponHint")}
            onClick={() =>
              changePlay((p) =>
                sacredOn
                  ? setSacredWeapon(p, undefined)
                  : setSacredWeapon(
                      sacredSpend && p.sacredWeapon === undefined
                        ? spendPool(p, sacredSpend, s.resources)
                        : p,
                      a.itemId,
                    ),
              )
            }
          >
            {ui("play.sacredWeapon")}
          </button>
        )}
        {a.canShillelagh && (
          <button
            type="button"
            class="card-btn card-effect"
            aria-pressed={a.shillelagh === true}
            title={ui("play.shillelaghHint")}
            onClick={() => changePlay((p) => setShillelagh(p, a.shillelagh ? undefined : a.itemId))}
          >
            {ui("play.shillelagh")}
          </button>
        )}
        {damages.map((d) => {
          const dice = critical ? (doubleDice(d.dice) ?? d.dice) : d.dice;
          return (
            <button
              key={d.key}
              type="button"
              class="card-btn card-roll card-damage"
              data-damage={d.part.type}
              data-due={due || undefined}
              onClick={() => hurt(d.dice)}
            >
              <b>{dice}</b>
              <small>
                {d.label && d.part.type === a.damage?.type ? d.label : damageName(d.part.type)}
              </small>
            </button>
          );
        })}
      </div>
    </li>
  );
}

/** The weapons of the character, as cards. */
export function AttackCards() {
  const s = sheet.value;
  if (!s) return null;
  return (
    <ul class="plain card-list">
      {[...s.attacks, ...(s.unarmed ? [s.unarmed] : [])].map((a) => (
        <AttackCard key={a.itemId} a={a} />
      ))}
    </ul>
  );
}

/** Roll one extra damage: the dice double on a critical hit. */
function rollExtra(label: string, dice: string) {
  const critical = criticalExtra.value;
  const text = critical ? (doubleDice(dice) ?? dice) : dice;
  rollDiceText(critical ? `${label} (${ui("play.criticalDamage")})` : label, text);
}

/** What the classes add to an attack (sneak attack, smite, rage), as cards, with the dice to roll after the weapon's. */
export function ExtraCards() {
  const s = sheet.value;
  const critical = criticalExtra.value;
  const shown = (dice: string) => (critical ? (doubleDice(dice) ?? dice) : dice);
  const [slot, setSlot] = useState(1);
  if (!s || s.extraDamage.length === 0) return null;
  const play = character.value.play;
  const levels = s.spellSlots
    .map((total, i) => ({ level: i + 1, left: slotsLeft(play, i + 1, total), total }))
    .filter((x) => x.total > 0 && x.level <= 5);
  const chosen = levels.find((x) => x.level === slot)?.level ?? levels[0]?.level ?? 1;
  const rollable = s.extraDamage.some(
    (e) => e.kind === "sneakAttack" || e.kind === "divineSmite" || e.kind === "feature",
  );

  return (
    <section class="card-group extra-cards">
      <header class="card-group-head">
        <h4>{ui("extra.title")}</h4>
        {rollable && (
          <button
            type="button"
            class="card-btn card-crit"
            aria-pressed={criticalExtra.value}
            onClick={() => {
              criticalExtra.value = !criticalExtra.value;
            }}
          >
            <CriticalIcon />
            <span>{ui("play.criticalHit")}</span>
          </button>
        )}
      </header>
      <ul class="plain card-list">
        {s.extraDamage.map((extra) => (
          <li class="play-card extra-card" data-extra={extra.kind} key={extraKey(extra)}>
            <span class="card-badge" aria-hidden="true">
              <CriticalIcon />
            </span>
            <div class="card-head">
              <b class="extra-name">{extraName(extra)}</b>
              <span class="card-meta extra-meta">
                {extraAmount(extra)} · {extraNote(extra)}
              </span>
            </div>
            {(extra.kind === "sneakAttack" || extra.kind === "feature") && (
              <div class="card-actions">
                <button
                  type="button"
                  class="card-btn card-roll card-primary card-wide"
                  onClick={() => rollExtra(extraName(extra), extra.dice)}
                >
                  <ChecksIcon />
                  <span>{extraName(extra)}</span>
                  <b>{shown(extra.dice)}</b>
                </button>
              </div>
            )}
            {extra.kind === "divineSmite" && levels.length > 0 && (
              <>
                <div class="spell-slot-pick">
                  <small>{ui("play.spellAtSlot")}</small>
                  {levels.map((x) => (
                    <button
                      key={x.level}
                      type="button"
                      class="card-btn spell-slot-btn"
                      aria-label={`${ui("extra.slot")}: ${x.level}`}
                      aria-pressed={x.level === chosen}
                      disabled={x.left === 0}
                      onClick={() => setSlot(x.level)}
                    >
                      {x.level}
                    </button>
                  ))}
                </div>
                <div class="card-actions">
                  <button
                    type="button"
                    class="card-btn card-roll card-primary card-wide"
                    onClick={() => {
                      const cast = castSpell(play, chosen, s.spellSlots);
                      if (!cast) {
                        addLog({ label: extraName(extra), detail: ui("play.noSlot") });
                        return;
                      }
                      changePlay(() => cast.play);
                      rollExtra(
                        `${extraName(extra)} (${ui("play.castSlot", { level: cast.slot.level })})`,
                        `${Math.min(5, 1 + cast.slot.level)}d8`,
                      );
                    }}
                  >
                    <ChecksIcon />
                    <span>{extraName(extra)}</span>
                    <b>{shown(`${Math.min(5, 1 + chosen)}d8`)}</b>
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
