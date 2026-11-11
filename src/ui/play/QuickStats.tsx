import type { ComponentChildren } from "preact";
import { rollCheck } from "../../app/play";
import { character, content, sheet } from "../../app/store";
import type { ExplainTarget } from "../../engine/explain";
import { signed, ui } from "../../i18n/ui";
import { distance } from "../../i18n/units";
import { ExplainButton } from "../Explain";
import { beastArmorClass } from "./beastArmorClass";
import { BootIcon, EyeIcon, FocusIcon, MagicIcon, StarIcon, SwordIcon } from "./icons";

/** One number: a small icon and a short name above the value. The full name is in the tooltip. */
function Stat({
  icon,
  short,
  full,
  value,
  target,
  onRoll,
}: {
  icon: ComponentChildren;
  short: string;
  full: string;
  value: string | number;
  target?: ExplainTarget;
  onRoll?: () => void;
}) {
  const inside = (
    <>
      <small>
        {icon}
        {short}
      </small>
      <b>{value}</b>
    </>
  );
  if (onRoll)
    return (
      <button type="button" class="qs-stat qs-roll" title={full} onClick={onRoll}>
        {inside}
      </button>
    );
  if (target)
    return (
      <ExplainButton class="qs-stat" target={target}>
        {inside}
      </ExplainButton>
    );
  return (
    <span class="qs-stat" title={full}>
      {inside}
    </span>
  );
}

/**
 * The numbers a player looks for all the time, in a strip that stays under the tabs on a wide
 * screen. Armor class is the crest; the rest are in groups by meaning, with a thin line between:
 * moving (initiative, speed), noticing and training (passive Perception, proficiency bonus) and
 * the numbers others roll against or that the character rolls (the martial save DC and, for a
 * caster, the spell save DC and attack bonus). Every number but the proficiency bonus and the
 * initiative opens how it adds up; the initiative rolls when tapped. On a phone the bar of the
 * play head has the armor class and the initiative, and this strip is not shown.
 */
export function QuickStats() {
  const s = sheet.value;
  const c = content.value;
  const play = character.value.play;
  if (!s || !c) return null;
  // In the shape of a beast the armor class is the beast's.
  const beastAc = beastArmorClass(c, play);
  const caster = s.spellcasters[0];
  const crest = (
    <>
      <b>{beastAc ?? s.armorClass.value}</b>
      <small>{ui("play.ac")}</small>
    </>
  );

  return (
    <div class="play-quick">
      <div class="qs-group">
        {beastAc !== undefined ? (
          <span class="qs-crest" title={ui("sheet.armorClass")}>
            {crest}
          </span>
        ) : (
          <ExplainButton class="qs-crest" target={{ kind: "ac" }}>
            {crest}
          </ExplainButton>
        )}
        <Stat
          icon={<FocusIcon />}
          short={ui("quick.initiative")}
          full={ui("sheet.initiative")}
          value={signed(s.initiative)}
          onRoll={() =>
            rollCheck(ui("play.initiative"), s.initiative, undefined, undefined, "check", "dex")
          }
        />
        <Stat
          icon={<BootIcon />}
          short={ui("quick.speed")}
          full={ui("sheet.speed")}
          value={s.speed === undefined ? "—" : distance(s.speed)}
          target={{ kind: "speed" }}
        />
      </div>
      <div class="qs-group">
        <Stat
          icon={<EyeIcon />}
          short={ui("quick.perception")}
          full={ui("sheet.passivePerception")}
          value={s.passivePerception}
          target={{ kind: "passivePerception" }}
        />
        <Stat
          icon={<StarIcon />}
          short={ui("quick.proficiency")}
          full={ui("sheet.proficiencyBonus")}
          value={signed(s.proficiencyBonus)}
        />
      </div>
      <div class="qs-group">
        <Stat
          icon={<SwordIcon />}
          short={ui("quick.martialDc")}
          full={ui("play.martialDc")}
          value={s.martialSaveDc}
          target={{ kind: "martialDc" }}
        />
        {caster && (
          <>
            <Stat
              icon={<MagicIcon />}
              short={ui("quick.spellDc")}
              full={ui("sheet.spellSaveDc")}
              value={caster.saveDc}
              target={{ kind: "spellDc" }}
            />
            <Stat
              icon={<MagicIcon />}
              short={ui("quick.spellAttack")}
              full={ui("sheet.spellAttack")}
              value={signed(caster.attackBonus)}
              target={{ kind: "spellAttack" }}
            />
          </>
        )}
      </div>
    </div>
  );
}
