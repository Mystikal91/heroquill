import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { character, content, sheet } from "../../app/store";
import type { ExplainTarget } from "../../engine/explain";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { ExplainButton } from "../Explain";
import { movementLines } from "../movementLines";
import { DamageEffectsList, damageEffectRows } from "./DamageEffects";
import { beastArmorClass } from "./beastArmorClass";
import { MoreIcon } from "./icons";

/** Whether the dialog with all the numbers is open. */
const moreOpen = signal(false);

/** The small button of the phone bar that opens the dialog: a picture, not a word, to save room. */
export function MoreButton() {
  return (
    <button
      type="button"
      class="ps-more"
      aria-label={ui("more.open")}
      title={ui("more.open")}
      aria-haspopup="dialog"
      onClick={() => {
        moreOpen.value = true;
      }}
    >
      <MoreIcon />
    </button>
  );
}

/** A line of the dialog: a name and a value; a number that can be taken apart opens how it adds up. */
function Row({
  name,
  value,
  target,
}: {
  name: ComponentChildren;
  value: ComponentChildren;
  target?: ExplainTarget;
}) {
  return (
    <li>
      {target ? (
        <ExplainButton class="more-row" target={target}>
          <span>{name}</span>
          <b>{value}</b>
        </ExplainButton>
      ) : (
        <>
          <span>{name}</span>
          <b>{value}</b>
        </>
      )}
    </li>
  );
}

/**
 * Every number the wide screen keeps in its strip, and a few more, in one dialog: the phone bar has
 * no room for them. Mount it once, in the Play tab.
 */
export function MoreStatsDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = moreOpen.value;
  const s = sheet.value;
  const c = content.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    moreOpen.value = false;
  };
  const ruleset = character.value.ruleset;
  const beastAc = c ? beastArmorClass(c, character.value.play) : undefined;
  const caster = s?.spellcasters[0];
  const passive = (slug: string) => {
    const skill = s?.skills.find((k) => k.id === `${ruleset}:skill/${slug}`);
    return skill ? 10 + skill.bonus : undefined;
  };
  const investigation = passive("investigation");
  const insight = passive("insight");
  const senses = s ? movementLines(s.movement, s.senses) : [];
  const effects = damageEffectRows();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Close button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog more-dialog"
      aria-labelledby="more-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {open && s && (
        <div class="spell-dialog-body">
          <button type="button" class="secondary close" onClick={close}>
            {ui("spells.closeInfo")}
          </button>
          <h3 id="more-title">{ui("more.title")}</h3>

          <h4>{ui("more.defense")}</h4>
          <ul class="explain-lines more-lines">
            <Row
              name={ui("sheet.armorClass")}
              value={beastAc ?? s.armorClass.value}
              target={beastAc === undefined ? { kind: "ac" } : undefined}
            />
            <Row name={ui("sheet.initiative")} value={signed(s.initiative)} />
            <Row
              name={ui("sheet.speed")}
              value={s.speed === undefined ? "—" : distance(s.speed)}
              target={{ kind: "speed" }}
            />
            {senses.map(([label, value]) => (
              <Row key={label} name={label} value={value} />
            ))}
          </ul>

          {effects.length > 0 && (
            <>
              <h4>{ui("play.damageEffects")}</h4>
              <DamageEffectsList rows={effects} />
            </>
          )}

          <h4>{ui("more.senses")}</h4>
          <ul class="explain-lines more-lines">
            <Row
              name={ui("sheet.passivePerception")}
              value={s.passivePerception}
              target={{ kind: "passivePerception" }}
            />
            {investigation !== undefined && (
              <Row name={ui("more.passiveInvestigation")} value={investigation} />
            )}
            {insight !== undefined && <Row name={ui("more.passiveInsight")} value={insight} />}
          </ul>

          <h4>{ui("more.attacks")}</h4>
          <ul class="explain-lines more-lines">
            <Row name={ui("sheet.proficiencyBonus")} value={signed(s.proficiencyBonus)} />
            <Row
              name={ui("play.martialDc")}
              value={s.martialSaveDc}
              target={{ kind: "martialDc" }}
            />
            {caster && (
              <>
                <Row
                  name={ui("sheet.spellSaveDc")}
                  value={caster.saveDc}
                  target={{ kind: "spellDc" }}
                />
                <Row
                  name={ui("sheet.spellAttack")}
                  value={signed(caster.attackBonus)}
                  target={{ kind: "spellAttack" }}
                />
              </>
            )}
            {s.critRange < 20 && (
              <Row name={ui("more.critRange", { min: s.critRange })} value={`${s.critRange}–20`} />
            )}
            {s.attunement.max > 0 && s.attunement.used > 0 && (
              <Row
                name={ui("equip.attunement", { used: s.attunement.used, max: s.attunement.max })}
                value=""
              />
            )}
          </ul>
        </div>
      )}
    </dialog>
  );
}
