import { itemData } from "../data/items";
import type { Ability, Sense } from "../data/schema";
import type { Character } from "./character";
import type { DerivedSheet, PackIndex } from "./derive";
import { SACRED_WEAPON } from "./equipment";
import type { Movement } from "./movement";
import { OVERRIDE } from "./overrides";

/** A number of the sheet that can be taken apart into what it is made of. */
export type ExplainTarget =
  | { kind: "ac" }
  | { kind: "initiative" }
  | { kind: "speed" }
  | { kind: "passivePerception" }
  | { kind: "spellDc" }
  | { kind: "spellAttack" }
  | { kind: "martialDc" }
  | { kind: "save"; ability: Ability }
  | { kind: "skill"; id: string }
  | { kind: "attack"; itemId: string };

/** What a line is: the sheet words it, so this module needs no texts. */
export type ExplainPart =
  | "base"
  | "armor"
  | "shield"
  | "ability"
  | "feature"
  | "proficiency"
  | "expertise"
  | "halfProficiency"
  | "enhancement"
  | "other";

export interface ExplainLine {
  part: ExplainPart;
  value: number;
  /** An entry id (armor, shield, feature) or an ability, for the words of the line. */
  ref?: string;
}

export interface Explained {
  /** The number as the sheet shows it. */
  total: number;
  /** A value forced in Free edit: the lines say what it would have been. */
  forced: boolean;
  lines: ExplainLine[];
  /** The speeds other than walking and the senses, for the number that has them (speed). */
  also?: { movement: Movement; senses: Partial<Record<Sense, number>> };
}

/** Whatever the lines do not account for, so they always add up to the number shown. */
function withRest(total: number, lines: ExplainLine[], rest: ExplainPart = "other"): ExplainLine[] {
  const known = lines.reduce((sum, l) => sum + l.value, 0);
  return known === total ? lines : [...lines, { part: rest, value: total - known }];
}

/** Takes a number of the sheet apart: what each part adds, and where it comes from. */
export function explain(
  target: ExplainTarget,
  sheet: DerivedSheet,
  character: Character,
  index: PackIndex,
): Explained | undefined {
  const pb = sheet.proficiencyBonus;
  switch (target.kind) {
    case "ac": {
      const armored = character.inventory
        .filter((i) => i.equipped)
        .flatMap((i) => {
          const entry = index.get(i.itemId);
          const armor = entry && itemData(entry).armor;
          return armor ? [{ id: i.itemId, shield: armor.category === "shield" }] : [];
        });
      const body = armored.find((a) => !a.shield)?.id;
      const shield = armored.find((a) => a.shield)?.id;
      const lines: ExplainLine[] = sheet.armorClass.parts.map((p) => {
        if (p.source === "armor") return { part: "armor", value: p.value, ref: body };
        if (p.source === "shield") return { part: "shield", value: p.value, ref: shield };
        if (p.source === "dex") return { part: "ability", value: p.value, ref: "dex" };
        if (p.source === "feature") return { part: "feature", value: p.value, ref: p.feature };
        return { part: "base", value: p.value };
      });
      return { total: sheet.armorClass.value, forced: sheet.armorClass.overridden, lines };
    }

    case "initiative": {
      const dex = sheet.abilities.dex.modifier;
      const bonuses = sheet.bonuses.filter((b) => b.target === "initiative");
      const lines: ExplainLine[] = [
        { part: "ability", value: dex, ref: "dex" },
        ...bonuses.map((b) => ({ part: "feature" as const, value: b.value, ref: b.source })),
      ];
      const forced = typeof character.overrides[OVERRIDE.initiative] === "number";
      return {
        total: sheet.initiative,
        forced,
        lines: forced ? lines : withRest(sheet.initiative, lines, "halfProficiency"),
      };
    }

    case "speed": {
      const base = index.get(character.choices.species ?? "")?.data.speed;
      const bonuses = sheet.bonuses.filter((b) => b.target === "speed");
      const lines: ExplainLine[] = [
        { part: "base", value: typeof base === "number" ? base : 0 },
        ...bonuses.map((b) => ({ part: "feature" as const, value: b.value, ref: b.source })),
      ];
      const forced = typeof character.overrides[OVERRIDE.speed] === "number";
      const total = sheet.speed ?? 0;
      return {
        total,
        forced,
        lines: forced ? lines : withRest(total, lines),
        also: { movement: sheet.movement, senses: sheet.senses },
      };
    }

    case "passivePerception": {
      // 10 and what the Perception check adds.
      const skill = explain(
        { kind: "skill", id: `${character.ruleset}:skill/perception` },
        sheet,
        character,
        index,
      );
      if (!skill) return undefined;
      return {
        total: sheet.passivePerception,
        forced: skill.forced,
        lines: [{ part: "base", value: 10 }, ...skill.lines],
      };
    }

    case "spellDc":
    case "spellAttack": {
      const caster = sheet.spellcasters[0];
      if (!caster) return undefined;
      const total = target.kind === "spellDc" ? caster.saveDc : caster.attackBonus;
      const lines: ExplainLine[] = [
        ...(target.kind === "spellDc" ? [{ part: "base" as const, value: 8 }] : []),
        { part: "ability", value: sheet.abilities[caster.ability].modifier, ref: caster.ability },
        { part: "proficiency", value: pb },
      ];
      return { total, forced: false, lines: withRest(total, lines) };
    }

    case "martialDc": {
      const better = sheet.abilities.dex.modifier > sheet.abilities.str.modifier ? "dex" : "str";
      const lines: ExplainLine[] = [
        { part: "base", value: 8 },
        { part: "ability", value: sheet.abilities[better].modifier, ref: better },
        { part: "proficiency", value: pb },
      ];
      const forced = typeof character.overrides[OVERRIDE.martialSaveDc] === "number";
      return { total: sheet.martialSaveDc, forced, lines };
    }

    case "save": {
      const save = sheet.saves[target.ability];
      const lines: ExplainLine[] = [
        { part: "ability", value: sheet.abilities[target.ability].modifier, ref: target.ability },
        ...(save.proficient ? [{ part: "proficiency" as const, value: pb }] : []),
        // What features add to every saving throw (an aura of protection).
        ...sheet.bonuses
          .filter((m) => m.target === "save")
          .map((m) => ({ part: "feature" as const, value: m.value, ref: m.source })),
      ];
      const forced = typeof character.overrides[OVERRIDE.save(target.ability)] === "number";
      return { total: save.bonus, forced, lines: forced ? lines : withRest(save.bonus, lines) };
    }

    case "skill": {
      const skill = sheet.skills.find((s) => s.id === target.id);
      if (!skill) return undefined;
      const mod = sheet.abilities[skill.ability].modifier;
      const lines: ExplainLine[] = [{ part: "ability", value: mod, ref: skill.ability }];
      const rest = skill.bonus - mod;
      if (skill.proficient) {
        lines.push({ part: "proficiency", value: pb });
        if (rest === 2 * pb) lines.push({ part: "expertise", value: pb });
      } else if (rest > 0) {
        lines.push({ part: "halfProficiency", value: rest });
      }
      const slug = target.id.split("/")[1] ?? "";
      const forced = typeof character.overrides[OVERRIDE.skill(slug)] === "number";
      return { total: skill.bonus, forced, lines: forced ? lines : withRest(skill.bonus, lines) };
    }

    case "attack": {
      const attack = [...sheet.attacks, ...(sheet.unarmed ? [sheet.unarmed] : [])].find(
        (a) => a.itemId === target.itemId,
      );
      if (!attack) return undefined;
      const mods = (attack.modifiers ?? []).filter((m) => m.target === "attack");
      const lines: ExplainLine[] = [
        ...(attack.proficient ? [{ part: "proficiency" as const, value: pb }] : []),
        ...(attack.enhancement > 0
          ? [{ part: "enhancement" as const, value: attack.enhancement }]
          : []),
        // The Channel Divinity: Sacred Weapon, while it is on the weapon.
        ...(attack.sacredWeapon
          ? [
              {
                part: "feature" as const,
                value: attack.sacredWeapon,
                ref:
                  sheet.features.find((f) => SACRED_WEAPON.test(f)) ??
                  "channel-divinity-sacred-weapon",
              },
            ]
          : []),
        ...mods.map((m) => ({ part: "feature" as const, value: m.value, ref: m.source })),
      ];
      const ability = attack.attackBonus - lines.reduce((sum, l) => sum + l.value, 0);
      return {
        total: attack.attackBonus,
        forced: false,
        lines: [{ part: "ability", value: ability }, ...lines],
      };
    }
  }
}
