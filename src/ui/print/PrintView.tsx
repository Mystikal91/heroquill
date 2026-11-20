import {
  type Paper,
  type PrintSettings,
  type SpellMode,
  printSettings,
  updatePrintSettings,
} from "../../app/printSettings";
import { printsNothing } from "../../app/printSettings.logic";
import { content, printSheet } from "../../app/store";
import { type UiKey, ui } from "../../i18n/ui";
import { collectSpellRows } from "../spellRows";
import { Cards } from "./CardsGroup";
import { FeatureText } from "./FeatureText";
import { FrontMore } from "./FrontMore";
import { FrontPage } from "./FrontPage";
import { FrontPage2024 } from "./FrontPage2024";
import { PdfButton } from "./PdfButton";
import { SpellPages } from "./SpellPages";
import { StoryPage } from "./StoryPage";
import { printedCharacter } from "./printSource";

const PAGE_SIZE: Record<Paper, string> = { a4: "A4", letter: "letter" };

type FlagKey = {
  [K in keyof PrintSettings]: PrintSettings[K] extends boolean ? K : never;
}[keyof PrintSettings];

interface Toggle {
  key: FlagKey;
  label: UiKey;
  /** The option makes no sense for this character. */
  disabled?: boolean;
}

function Check({ toggle, settings }: { toggle: Toggle; settings: PrintSettings }) {
  return (
    <label>
      <input
        type="checkbox"
        checked={settings[toggle.key] && !toggle.disabled}
        disabled={toggle.disabled}
        onChange={(e) => updatePrintSettings({ [toggle.key]: e.currentTarget.checked })}
      />
      {ui(toggle.label)}
    </label>
  );
}

/** Print preview with its options. The page content is what the browser prints. */
export function PrintView() {
  const settings = printSettings.value;
  const c = content.value;
  const s = printSheet.value;
  const isCaster = Boolean(s?.spellcasting);
  const hasSpells = Boolean(c && s && collectSpellRows(c, s).length > 0);
  const nothing = printsNothing(settings, isCaster);

  const pageToggles: Toggle[] = [
    { key: "includeSheet", label: "print.sheet" },
    { key: "includeStory", label: "print.story" },
    { key: "includeFeatureText", label: "print.featureText" },
    ...(settings.blank ? [] : [{ key: "featureCards", label: "print.featureCards" } as Toggle]),
  ];
  const spellToggles: Toggle[] = [
    { key: "includeAvailable", label: "print.available", disabled: !isCaster },
    { key: "spellCards", label: "print.spellCards", disabled: !hasSpells },
  ];

  return (
    <div class={`print-root paper-${settings.paper}${settings.lowInk ? " low-ink" : ""}`}>
      {/* Paper size and margins for the real print job; the preview mimics them. */}
      <style>{`@page { size: ${PAGE_SIZE[settings.paper]}; margin: 12mm; }`}</style>

      <div class="card print-toolbar no-print">
        <div class="print-top">
          <h2>{ui("print.title")}</h2>
          <div class="print-actions">
            <button type="button" class="primary" onClick={() => window.print()} disabled={nothing}>
              {ui("print.print")}
            </button>
            <PdfButton disabled={nothing} />
          </div>
        </div>
        <p class="print-hint">
          {ui("print.hint")} {ui("print.pdfHint")}
        </p>

        <div class="print-groups">
          <fieldset class="print-group">
            <legend>{ui("print.group.what")}</legend>
            <div class="checks">
              <label>
                <input
                  type="radio"
                  name="print-what"
                  checked={!settings.blank}
                  onChange={() => updatePrintSettings({ blank: false })}
                />
                {ui("print.thisCharacter")}
              </label>
              <label>
                <input
                  type="radio"
                  name="print-what"
                  checked={settings.blank}
                  onChange={() => updatePrintSettings({ blank: true })}
                />
                {ui("print.blankSheet")}
              </label>
            </div>
            {settings.blank && <p class="print-group-hint">{ui("print.blankHint")}</p>}
          </fieldset>

          <fieldset class="print-group">
            <legend>{ui("print.group.paper")}</legend>
            <label class="field">
              <span>{ui("print.paper")}</span>
              <select
                value={settings.paper}
                onChange={(e) => updatePrintSettings({ paper: e.currentTarget.value as Paper })}
              >
                <option value="a4">{ui("print.paperA4")}</option>
                <option value="letter">{ui("print.paperLetter")}</option>
              </select>
            </label>
            <div class="checks">
              <Check toggle={{ key: "lowInk", label: "print.lowInk" }} settings={settings} />
            </div>
          </fieldset>

          <fieldset class="print-group">
            <legend>{ui("print.group.pages")}</legend>
            <div class="checks">
              {pageToggles.map((t) => (
                <Check key={t.key} toggle={t} settings={settings} />
              ))}
            </div>
          </fieldset>

          {settings.blank ? (
            <fieldset class="print-group">
              <legend>{ui("print.group.spells")}</legend>
              <div class="checks">
                <Check
                  toggle={{ key: "blankSpells", label: "print.blankSpells" }}
                  settings={settings}
                />
              </div>
            </fieldset>
          ) : (
            <fieldset class="print-group">
              <legend>{ui("print.group.spells")}</legend>
              <label class="field">
                <span>{ui("print.spells")}</span>
                <select
                  value={settings.spellMode}
                  onChange={(e) =>
                    updatePrintSettings({ spellMode: e.currentTarget.value as SpellMode })
                  }
                >
                  <option value="details">{ui("print.spellsDetails")}</option>
                  <option value="compact">{ui("print.spellsCompact")}</option>
                  <option value="none">{ui("print.spellsNone")}</option>
                </select>
              </label>
              <div class="checks">
                {spellToggles.map((t) => (
                  <Check key={t.key} toggle={t} settings={settings} />
                ))}
              </div>
            </fieldset>
          )}
        </div>
      </div>

      <div class="paper-scroll">
        <div class="paper" id="print-paper">
          {nothing && <p class="no-print">{ui("print.nothing")}</p>}
          {settings.includeSheet &&
            (printedCharacter.value.ruleset === "srd52" ? <FrontPage2024 /> : <FrontPage />)}
          {settings.includeSheet && <FrontMore />}
          {settings.includeStory && <StoryPage />}
          {settings.includeFeatureText && <FeatureText />}
          <SpellPages />
          <Cards />
        </div>
      </div>
    </div>
  );
}
