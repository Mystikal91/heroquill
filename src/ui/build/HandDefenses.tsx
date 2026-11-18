import { character, updateCharacter } from "../../app/store";
import type { ExtraDefense } from "../../engine/character";
import { ui } from "../../i18n/ui";
import { DAMAGE_TYPE_IDS, damageTitle } from "../damageName";
import { wordOptions } from "../studio/wordOptions";

const KINDS = [
  ["resistance", "sheet.resistances"],
  ["immunity", "sheet.immunities"],
  ["vulnerability", "sheet.vulnerabilities"],
  ["reduction", "sheet.damageReduction"],
] as const;

/**
 * Free edit of the defenses: what the rules do not give the character (a homebrew item, a spell that
 * lasts, a ruling of the table) is written here and added to the list of effects on damage. Nothing is
 * counted from it: it is a list, as the rest of it is.
 */
export function HandDefenses() {
  const rows = character.value.extraDefenses ?? [];
  const kinds = [
    ...DAMAGE_TYPE_IDS.map((id) => ({ id: id as string, label: damageTitle(id) })),
    ...wordOptions("damage", undefined, character.value.ruleset),
  ];
  const set = (next: ExtraDefense[]) =>
    updateCharacter((d) => {
      d.extraDefenses = next.length > 0 ? next : undefined;
    });
  const change = (i: number, patch: Partial<ExtraDefense>) =>
    set(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));

  return (
    <fieldset class="hand-defenses">
      <legend>{ui("freeEdit.defenses")}</legend>
      <p class="muted">{ui("freeEdit.defensesHint")}</p>
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the rows have no id and are edited in place
        <div class="hand-defense" key={i}>
          <select
            aria-label={ui("freeEdit.defenseKind")}
            value={row.kind}
            onChange={(e) => {
              const kind = e.currentTarget.value as ExtraDefense["kind"];
              change(i, {
                kind,
                damage: kind === "reduction" ? row.damage : (row.damage ?? "fire"),
                amount: kind === "reduction" ? (row.amount ?? 1) : undefined,
              });
            }}
          >
            {KINDS.map(([id, label]) => (
              <option key={id} value={id}>
                {ui(label)}
              </option>
            ))}
          </select>
          <select
            aria-label={ui("freeEdit.defenseDamage")}
            value={row.damage ?? ""}
            onChange={(e) => change(i, { damage: e.currentTarget.value || undefined })}
          >
            {row.kind === "reduction" && <option value="">{ui("freeEdit.defenseAll")}</option>}
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          {row.kind === "reduction" && (
            <>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label={ui("freeEdit.defenseAmount")}
                placeholder={ui("freeEdit.defenseAmount")}
                value={row.amount ?? ""}
                onInput={(e) => {
                  const n = Number.parseInt(e.currentTarget.value, 10);
                  change(i, { amount: Number.isFinite(n) && n > 0 ? n : undefined });
                }}
              />
              <input
                type="text"
                aria-label={ui("fx.f.note")}
                placeholder={ui("fx.f.note")}
                value={row.note ?? ""}
                onInput={(e) => change(i, { note: e.currentTarget.value || undefined })}
              />
            </>
          )}
          <button type="button" class="link" onClick={() => set(rows.filter((_, n) => n !== i))}>
            {ui("form.remove")}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => set([...rows, { kind: "resistance", damage: "fire" }])}>
        {ui("freeEdit.defenseAdd")}
      </button>
    </fieldset>
  );
}
