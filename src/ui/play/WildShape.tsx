import { useEffect, useState } from "preact/hooks";
import { challengeText, speedText } from "../../app/monsterView";
import { changePlay, damageCharacter, rollDiceText } from "../../app/play";
import { monstersWanted } from "../../app/rulesView";
import { character, content, sheet, sheetForm, updateCharacter } from "../../app/store";
import { classData } from "../../data/progression";
import { monstersOf } from "../../engine/companions";
import { resourceLeft, setResourceUsed, slotsLeft } from "../../engine/play";
import {
  assumeBeast,
  assumeBeastKeepingHitPoints,
  canAssume,
  healBeast,
  healWithSlot,
  leaveBeast,
  trimForms,
  wildShapeLimits,
} from "../../engine/wildShape";
import { ui } from "../../i18n/ui";
import { MonsterBlock } from "../rules/MonsterBlock";
import { Panel } from "../sheet/parts";

/** What the druid is as the sheet sees them: the class, its level, and whether it is the Moon circle. */
function druidOf() {
  const c = content.value;
  const found = character.value.classes.find((cl) => cl.classId.endsWith("/druid"));
  const entry = found && c?.index.get(found.classId);
  if (!found || !entry) return undefined;
  const moon = /moon/i.test(found.subclassId ?? "");
  const limits = wildShapeLimits(classData(entry), found.level, moon);
  return limits && { limits, level: found.level, moon };
}

/** Wild Shape: turning into a beast, with the hit points of the beast while the shape lasts. */
export function WildShape() {
  const c = content.value;
  const play = character.value.play;
  const druid = druidOf();
  const [choosing, setChoosing] = useState(false);
  const shape = play.wildShape;
  // The monsters of the rules are a large pack: they come once a beast is wanted or worn.
  useEffect(() => {
    if (shape || choosing) monstersWanted.value = true;
  }, [shape, choosing]);
  if (!c || !druid) return null;

  const { limits, level } = druid;
  // The 2024 rules: known forms, the druid's own hit points and temporary hit points.
  const known = limits.knownForms !== undefined;
  const forms = trimForms(character.value.wildShapeForms, limits.knownForms ?? 0);
  const setForms = (next: string[]) =>
    updateCharacter((draft) => {
      draft.wildShapeForms = next;
    });
  const resource = sheet.value?.resources.find((r) => r.kind === "wildShape");
  // The Archdruid's uses are unlimited: there is always one left, and none is taken.
  const left = resource && !resource.unlimited ? resourceLeft(play, resource.id, resource.max) : 1;
  const cr = challengeText(limits.maxCr);
  const movement = limits.fly
    ? undefined
    : ui(limits.swim ? "play.wildShape.noFly" : "play.wildShape.noFlySwim");

  const assume = (id: string) => {
    const entry = c.index.get(id);
    const hp = entry?.data.hitPoints;
    if (typeof hp !== "number" || (known && !forms.includes(id))) return;
    changePlay(
      (p) => {
        const spent =
          resource && !resource.unlimited
            ? setResourceUsed(
                p,
                resource.id,
                (p.resourcesUsed?.[resource.id] ?? 0) + 1,
                resource.max,
              )
            : p;
        return known ? assumeBeastKeepingHitPoints(spent, id, level) : assumeBeast(spent, id, hp);
      },
      { undo: false },
    );
    // Each new shape starts with the sheet showing the beast.
    sheetForm.value = "beast";
    setChoosing(false);
  };

  if (shape) {
    // The slots a Moon druid can still spend to heal the beast.
    const slotLevels = (sheet.value?.spellSlots ?? [])
      .map((total, i) => ({ level: i + 1, total, left: slotsLeft(play, i + 1, total) }))
      .filter((slot) => slot.total > 0 && slot.left > 0);
    const monster = c.index.get(shape.monster);
    const armor = (monster?.data.armorClass as { value: number }[] | undefined)?.[0]?.value;
    const speed = monster?.data.speed as Record<string, number | true> | undefined;
    const percent = shape.max > 0 ? Math.round((shape.hp / shape.max) * 100) : 0;
    return (
      <Panel title={ui("play.wildShape")}>
        <p>
          <b>{ui("play.wildShape.in", { name: c.name(shape.monster) })}</b>
        </p>
        {shape.own ? (
          <p class="muted">{ui("play.wildShape.tempHp", { n: play.tempHp })}</p>
        ) : (
          <>
            <output class="hp-readout">
              <b class={shape.hp === 0 ? "zero" : ""}>{shape.hp}</b>
              <span>{ui("play.of", { max: shape.max })}</span>
            </output>
            <div
              class="hp-bar"
              data-state={percent <= 25 ? "low" : percent <= 50 ? "hurt" : "well"}
              role="img"
              aria-label={`${shape.hp} ${ui("play.of", { max: shape.max })}`}
            >
              <span style={{ width: `${percent}%` }} />
            </div>
            <div class="hp-quick companion-hp">
              {[5, 1].map((n) => (
                <button
                  type="button"
                  key={`d${n}`}
                  class="danger-btn"
                  aria-label={ui("play.damageBy", { n })}
                  onClick={() => damageCharacter(n)}
                >
                  {"−"}
                  {n}
                </button>
              ))}
              {[1, 5].map((n) => (
                <button
                  type="button"
                  key={`h${n}`}
                  aria-label={ui("play.healBy", { n })}
                  onClick={() => changePlay((p) => healBeast(p, n), { undo: false })}
                >
                  +{n}
                </button>
              ))}
            </div>
          </>
        )}
        <p class="muted">
          {armor !== undefined && `${ui("monster.ac")} ${armor}`}
          {armor !== undefined && speed && " · "}
          {speed && `${ui("monster.speed")} ${speedText(speed)}`}
        </p>
        <p class="muted">{ui(shape.own ? "play.wildShape.rulesOwn" : "play.wildShape.rules")}</p>
        {druid.moon && slotLevels.length > 0 && (
          <>
            <p class="muted">{ui("play.wildShape.combat")}</p>
            <div class="btn-row">
              {slotLevels.map(({ level, total, left }) => (
                <button
                  type="button"
                  key={level}
                  onClick={() => {
                    const roll = rollDiceText(
                      `${c.name(shape.monster)}: ${ui("play.wildShape.combatName")}`,
                      `${level}d8`,
                    );
                    if (roll)
                      changePlay((p) => healWithSlot(p, level, total, roll.total), { undo: false });
                  }}
                >
                  {ui("play.wildShape.combatHeal", { level })} ({left})
                </button>
              ))}
            </div>
          </>
        )}
        <button
          type="button"
          class="secondary"
          onClick={() => changePlay((p) => leaveBeast(p), { undo: false })}
        >
          {ui("play.wildShape.leave")}
        </button>
        <details class="companion-block" open>
          <summary>{ui("play.companions.statBlock")}</summary>
          <MonsterBlock id={shape.monster} />
        </details>
      </Panel>
    );
  }

  const beasts = monstersOf(c.index, character.value.ruleset)
    .filter((e) => canAssume(e, limits))
    .map((e) => ({ id: e.id, name: c.name(e.id), cr: challengeText(Number(e.data.challenge)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // With known forms only those can be assumed; the others are what can still be learned.
  const assumable = known ? beasts.filter((b) => forms.includes(b.id)) : beasts;
  const learnable = beasts.filter((b) => !forms.includes(b.id));

  return (
    <Panel title={ui("play.wildShape")}>
      <p class="muted">
        {ui("play.wildShape.limits", { cr, hours: limits.hours })} {movement}
      </p>
      {known && (
        <>
          <p class="muted">
            {ui("play.wildShape.forms", { n: forms.length, max: limits.knownForms ?? 0 })}
          </p>
          <ul class="wild-forms">
            {forms.map((id) => (
              <li key={id}>
                <span>{c.name(id)}</span>{" "}
                <button
                  type="button"
                  class="link"
                  aria-label={`${ui("play.wildShape.removeForm")}: ${c.name(id)}`}
                  onClick={() => setForms(forms.filter((f) => f !== id))}
                >
                  {"✕"}
                </button>
              </li>
            ))}
          </ul>
          {forms.length < (limits.knownForms ?? 0) &&
            (c.monsters ? (
              <label class="field">
                <span>{ui("play.wildShape.addForm")}</span>
                <select
                  value=""
                  onChange={(e) => {
                    const id = e.currentTarget.value;
                    if (id) setForms([...forms, id]);
                  }}
                >
                  <option value="">{"—"}</option>
                  {learnable.map((b) => (
                    <option key={b.id} value={b.id}>
                      {`${b.name} (${ui("play.wildShape.cr", { cr: b.cr })})`}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p class="muted">{ui("rules.loading")}</p>
            ))}
        </>
      )}
      {resource && (
        <p class="muted">
          {resource.unlimited
            ? ui("play.unlimited")
            : ui("play.wildShape.uses", { left, max: resource.max })}
        </p>
      )}
      {choosing ? (
        c.monsters ? (
          <label class="field">
            <span>{ui("play.wildShape.pick")}</span>
            <select
              value=""
              onChange={(e) => {
                const id = e.currentTarget.value;
                if (id) assume(id);
                else setChoosing(false);
              }}
            >
              <option value="">{"—"}</option>
              {assumable.map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.name} (${ui("play.wildShape.cr", { cr: b.cr })})`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p class="muted">{ui("rules.loading")}</p>
        )
      ) : known && forms.length === 0 ? (
        <p class="muted">{ui("play.wildShape.noForms")}</p>
      ) : left > 0 ? (
        <button type="button" class="secondary" onClick={() => setChoosing(true)}>
          {ui("play.wildShape.assume")}
        </button>
      ) : (
        <p class="muted">{ui("play.wildShape.noUses")}</p>
      )}
    </Panel>
  );
}
