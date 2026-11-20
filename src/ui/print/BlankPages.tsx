import { type Paper, printSettings } from "../../app/printSettings";
import { ui } from "../../i18n/ui";
import { Sheet } from "./PageFoot";
import { RuledArea } from "./RuledArea";

/**
 * The pages of a blank sheet that have no counterpart with values: a page of lines for the
 * features, and pages for the spells, as most printed sheets have them (a list by level, then
 * room to copy out the spells themselves).
 */

/**
 * The lines for each level of the spell list, column by column, made to fill one page: A4 is 17.6 mm
 * taller than US Letter, a few lines more in each column.
 */
const SPELL_LIST_COLUMNS: Record<Paper, [level: number, lines: number][][]> = {
  a4: [
    [
      [0, 10],
      [1, 16],
      [2, 13],
    ],
    [
      [3, 15],
      [4, 14],
      [5, 10],
    ],
    [
      [6, 10],
      [7, 10],
      [8, 8],
      [9, 8],
    ],
  ],
  letter: [
    [
      [0, 8],
      [1, 14],
      [2, 13],
    ],
    [
      [3, 14],
      [4, 13],
      [5, 9],
    ],
    [
      [6, 10],
      [7, 9],
      [8, 7],
      [9, 7],
    ],
  ],
};

/** Boxes to copy a spell into, on the page after the list. */
const SPELL_BOXES = 6;

export function BlankFeatures() {
  return (
    <Sheet class="p-blank">
      <h2 class="p-title">{ui("print.page.features")}</h2>
      <div class="p-blank-two">
        <section class="p-frame p-block">
          <RuledArea />
        </section>
        <section class="p-frame p-block">
          <RuledArea />
        </section>
      </div>
    </Sheet>
  );
}

function SpellLevelBox({ level, lines }: { level: number; lines: number }) {
  return (
    <section class="p-frame p-spell-level">
      <header class="p-spell-level-head">
        <span class="p-level">{level === 0 ? "C" : level}</span>
        <b>{level === 0 ? ui("spells.cantrips") : ui("spells.level", { level })}</b>
        {level > 0 && (
          <span class="p-spell-level-slots">
            <span class="p-write small" />
            <small>{ui("print.slotCount")}</small>
            <span class="p-write small" />
            <small>{ui("print.slotUsed")}</small>
          </span>
        )}
      </header>
      {Array.from({ length: lines }, (_, i) => (
        <div class="p-spell-line" key={`line-${level}-${i + 1}`}>
          {level > 0 && <span class="p-pip" title={ui("print.prepared")} />}
          <span class="p-write small" />
        </div>
      ))}
    </section>
  );
}

function SpellBox() {
  const fields = [
    ui("spells.castingTime"),
    ui("spells.range"),
    ui("spells.components"),
    ui("spells.duration"),
  ];
  return (
    <section class="p-frame p-block p-spell-box">
      <dl class="p-fields p-spell-box-head">
        <div class="wide">
          <dd> </dd>
          <dt>{ui("print.name")}</dt>
        </div>
        <div>
          <dd> </dd>
          <dt>{ui("print.slotLevel")}</dt>
        </div>
        {fields.map((label) => (
          <div key={label}>
            <dd> </dd>
            <dt>{label}</dt>
          </div>
        ))}
      </dl>
      <RuledArea />
    </section>
  );
}

export function BlankSpells() {
  return (
    <>
      <Sheet class="p-blank p-blank-spells">
        <h2 class="p-title">{ui("print.page.spells")}</h2>
        <dl class="p-fields p-blank-casting">
          {[
            ui("form.class"),
            ui("sheet.spellAbility"),
            ui("sheet.spellSaveDc"),
            ui("sheet.spellAttack"),
          ].map((label) => (
            <div key={label}>
              <dd> </dd>
              <dt>{label}</dt>
            </div>
          ))}
        </dl>
        <div class="p-spell-list-cols">
          {SPELL_LIST_COLUMNS[printSettings.value.paper].map((column) => (
            <div class="p-spell-list-col" key={`col-${column[0]?.[0]}`}>
              {column.map(([level, lines]) => (
                <SpellLevelBox level={level} lines={lines} key={`level-${level}`} />
              ))}
            </div>
          ))}
        </div>
      </Sheet>
      <Sheet class="p-blank p-blank-spells">
        <h2 class="p-title">{ui("print.page.spells")}</h2>
        <div class="p-spell-boxes">
          {Array.from({ length: SPELL_BOXES }, (_, i) => (
            <SpellBox key={`box-${i + 1}`} />
          ))}
        </div>
      </Sheet>
    </>
  );
}
