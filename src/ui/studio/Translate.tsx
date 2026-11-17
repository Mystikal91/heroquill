import { useState } from "preact/hooks";
import { LANGUAGES } from "../../app/language.logic";
import { applyChange, studioLanguage } from "../../app/studio";
import type { Entry } from "../../data/schema";
import {
  DAMAGE_OWNER,
  addDamageType,
  damageLabel,
  ownDamageTypes,
  removeDamageType,
  setDamageName,
} from "../../homebrew/damage";
import { ownedEntries, setText } from "../../homebrew/entries";
import {
  RESERVE_OWNER,
  addReserve,
  ownReserves,
  removeReserve,
  reserveLabel,
  setReserveName,
} from "../../homebrew/reserves";
import {
  addLanguage,
  progress,
  removeLanguage,
  textKeys,
  textOwners,
} from "../../homebrew/translate";
import { ui } from "../../i18n/ui";
import { type UserPackRecord, damageSlug, packLanguages } from "../../storage/packs";
import { DAMAGE_KINDS, TextBox } from "./Controls";
import { fieldLabel } from "./labels";

/** A language by its own name. */
export const languageName = (code: string) => LANGUAGES.find((l) => l.code === code)?.name ?? code;

/** The languages a pack could still be translated into. */
const missingLanguages = (record: UserPackRecord) =>
  LANGUAGES.filter((l) => !packLanguages(record).includes(l.code));

function AddLanguage({ record }: { record: UserPackRecord }) {
  const options = missingLanguages(record);
  if (options.length === 0) return null;
  return (
    <select
      class="studio-pick"
      value=""
      aria-label={ui("studio.addLanguage")}
      onChange={(e) => {
        const code = e.currentTarget.value;
        e.currentTarget.value = "";
        if (!code) return;
        applyChange(addLanguage(record, code));
        studioLanguage.value = code;
      }}
    >
      <option value="">{ui("studio.addLanguage")}</option>
      {options.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

/**
 * Which language the entry is written in: the original, or a translation of it. Each language says
 * how many of the entry's texts it still lacks.
 */
export function LanguageBar({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const owners = textOwners(record, entry.id);
  const current = studioLanguage.value;
  const languages = packLanguages(record);
  return (
    <div class="studio-languages" role="tablist" aria-label={ui("studio.languages")}>
      {languages.map((code) => {
        const isOriginal = code === record.lang;
        const p = isOriginal ? undefined : progress(record, code, owners);
        const missing = p ? p.total - p.done : 0;
        const on = isOriginal ? !current || current === code : current === code;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={on}
            key={code}
            class={on ? "studio-lang on" : "studio-lang"}
            onClick={() => {
              studioLanguage.value = isOriginal ? undefined : code;
            }}
          >
            {languageName(code)}
            {isOriginal ? (
              <small>{ui("studio.original")}</small>
            ) : (
              missing > 0 && <small>{missing}</small>
            )}
          </button>
        );
      })}
      <AddLanguage record={record} />
    </div>
  );
}

/** What a text is called in the list: the field, and for what the entry owns, the owner's name. */
function labelOf(record: UserPackRecord, key: string, owners: string[]): string {
  const owner =
    owners.filter((id) => key.startsWith(`${id}.`)).sort((a, b) => b.length - a.length)[0] ?? "";
  const field = key.slice(owner.length + 1);
  const [base = "", ...rest] = field.split(".");
  const name = fieldLabel(base) + (rest.length ? ` ${rest.join(".")}` : "");
  if (owner === owners[0]) return name;
  const who = record.strings[`${owner}.name`] || ui("studio.unnamed");
  return `${who} · ${name}`;
}

/**
 * The texts of the entry (and of what it owns) next to their translations: the original to read,
 * a box to write the translation in. Where a translation is empty, the original is shown instead.
 */
export function TranslationPanel({
  record,
  entry,
  language,
}: {
  record: UserPackRecord;
  entry: Entry;
  language: string;
}) {
  const owners = textOwners(record, entry.id);
  const keys = textKeys(record, owners);
  const there = record.translations?.[language] ?? {};
  const write = (key: string, value: string) => {
    const owner =
      owners.filter((id) => key.startsWith(`${id}.`)).sort((a, b) => b.length - a.length)[0] ??
      entry.id;
    applyChange(
      setText(record, owner, key.slice(owner.length + 1), value, language),
      `tr.${language}.${key}`,
    );
  };
  return (
    <div class="studio-form studio-translate">
      <p class="muted">{ui("studio.translating", { language: languageName(language) })}</p>
      {keys.length === 0 && <p class="muted">{ui("studio.nothingToTranslate")}</p>}
      {keys.map((key) => (
        <div class="studio-tr-row" key={key}>
          <div class="studio-tr-original">
            <small>
              {labelOf(record, key, owners)} · {languageName(record.lang)}
            </small>
            <p>{record.strings[key]}</p>
          </div>
          <TextBox
            label={`${languageName(language)}`}
            value={there[key] ?? ""}
            area
            rows={Math.min(8, Math.max(2, Math.ceil((record.strings[key] ?? "").length / 60)))}
            onChange={(v) => write(key, v)}
          />
        </div>
      ))}
    </div>
  );
}

/** The translations of a pack, with how far each has got: for the page of the pack. */
export function PackLanguages({ record }: { record: UserPackRecord }) {
  const translations = Object.keys(record.translations ?? {});
  return (
    <section class="studio-pack-languages">
      <h4>{ui("studio.languages")}</h4>
      <p class="muted">{ui("studio.writtenIn", { language: languageName(record.lang) })}</p>
      <ul class="plain">
        {translations.map((code) => {
          const p = progress(record, code);
          return (
            <li key={code} class="studio-pack-language">
              <b>{languageName(code)}</b>
              <span class="muted">{ui("studio.translated", { done: p.done, total: p.total })}</span>
              <button
                type="button"
                class="danger"
                onClick={() => {
                  if (studioLanguage.value === code) studioLanguage.value = undefined;
                  applyChange(removeLanguage(record, code));
                }}
              >
                {ui("studio.removeLanguage")}
              </button>
            </li>
          );
        })}
      </ul>
      <AddLanguage record={record} />
    </section>
  );
}

/**
 * The kinds of damage the pack adds: a way to declare one (the form of a spell has the same) and, for
 * each, one box per language of the pack. They belong to no entry, so this is where they are written
 * and translated.
 */
export function DamageNames({ record }: { record: UserPackRecord }) {
  const [name, setName] = useState("");
  const types = ownDamageTypes(record);
  const languages = packLanguages(record);
  const slug = damageSlug(name);
  const known = !!slug && (DAMAGE_KINDS.includes(slug) || types.includes(slug));
  const add = () => {
    if (!slug || known) return;
    const made = addDamageType(record, name);
    if (!made) return;
    applyChange(made.record, `dmg.${made.slug}`);
    setName("");
  };
  return (
    <section class="studio-pack-languages studio-damage-names">
      <h4>{ui("studio.damageNames")}</h4>
      <p class="muted">{ui("studio.damageNamesHint")}</p>
      {types.map((slug) => (
        <fieldset key={slug} class="studio-damage-name">
          <legend>{damageLabel(record, slug, record.lang)}</legend>
          {languages.map((code) => (
            <TextBox
              key={code}
              label={languageName(code)}
              value={
                code === record.lang
                  ? (record.strings[`${DAMAGE_OWNER}.${slug}`] ?? "")
                  : (record.translations?.[code]?.[`${DAMAGE_OWNER}.${slug}`] ?? "")
              }
              onChange={(v) =>
                applyChange(setDamageName(record, slug, v, code), `dmg.${slug}.${code}`)
              }
            />
          ))}
          <button
            type="button"
            class="danger"
            onClick={() => applyChange(removeDamageType(record, slug), `dmg.${slug}`)}
          >
            {ui("form.remove")}
          </button>
        </fieldset>
      ))}
      <div class="studio-damage-new">
        <input
          type="text"
          value={name}
          placeholder={ui("studio.damageNew")}
          aria-label={ui("studio.damageNew")}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" disabled={!slug || known} onClick={add}>
          {ui("studio.add")}
        </button>
      </div>
    </section>
  );
}

/**
 * The reserves of points the pack declares (psi points, mana): their names in each language of the
 * pack, a way to declare one and to take one away. A feature adds points to one by name, and what
 * spends points takes them from it.
 */
export function Reserves({ record }: { record: UserPackRecord }) {
  const [name, setName] = useState("");
  const reserves = ownReserves(record);
  const languages = packLanguages(record);
  const add = () => {
    const made = addReserve(record, name);
    if (!made) return;
    applyChange(made.record, `reserve.${made.slug}`);
    setName("");
  };
  return (
    <section class="studio-pack-languages studio-reserves">
      <h4>{ui("studio.reserves")}</h4>
      <p class="muted">{ui("studio.reservesHint")}</p>
      {reserves.map((slug) => (
        <fieldset key={slug} class="studio-damage-name">
          <legend>{reserveLabel(record, slug, record.lang)}</legend>
          {languages.map((code) => (
            <TextBox
              key={code}
              label={languageName(code)}
              value={
                code === record.lang
                  ? (record.strings[`${RESERVE_OWNER}.${slug}`] ?? "")
                  : (record.translations?.[code]?.[`${RESERVE_OWNER}.${slug}`] ?? "")
              }
              onChange={(v) =>
                applyChange(setReserveName(record, slug, v, code), `reserve.${slug}.${code}`)
              }
            />
          ))}
          <button
            type="button"
            class="danger"
            onClick={() => applyChange(removeReserve(record, slug), `reserve.${slug}`)}
          >
            {ui("form.remove")}
          </button>
        </fieldset>
      ))}
      <div class="studio-damage-new">
        <input
          type="text"
          value={name}
          placeholder={ui("studio.reserveNew")}
          aria-label={ui("studio.reserveNew")}
          onInput={(e) => setName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" disabled={!damageSlug(name)} onClick={add}>
          {ui("studio.add")}
        </button>
      </div>
    </section>
  );
}

/**
 * The spell components the pack adds to V, S and M, by their short code (A, O): the spell form then
 * offers a tick for each. Nothing to translate: a component is its letter.
 */
export function ComponentCodes({ record }: { record: UserPackRecord }) {
  const [code, setCode] = useState("");
  const codes = record.meta?.components ?? [];
  const clean = code.trim().toUpperCase().slice(0, 3);
  const taken = ["V", "S", "M", ...codes].includes(clean);
  const set = (next: string[]) =>
    applyChange({ ...record, meta: { ...record.meta, components: next } }, "pack.components");
  return (
    <section class="studio-pack-languages studio-components">
      <h4>{ui("studio.components")}</h4>
      <p class="muted">{ui("studio.componentsHint")}</p>
      {codes.length > 0 && (
        <ul class="plain studio-component-codes">
          {codes.map((c) => (
            <li key={c}>
              <b>{c}</b>
              <button
                type="button"
                class="link"
                aria-label={ui("studio.componentRemove", { code: c })}
                onClick={() => set(codes.filter((x) => x !== c))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="studio-damage-new">
        <input
          type="text"
          value={code}
          maxLength={3}
          placeholder={ui("studio.componentNew")}
          aria-label={ui("studio.componentNew")}
          onInput={(e) => setCode(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && clean && !taken) {
              e.preventDefault();
              set([...codes, clean]);
              setCode("");
            }
          }}
        />
        <button
          type="button"
          disabled={!clean || taken}
          onClick={() => {
            set([...codes, clean]);
            setCode("");
          }}
        >
          {ui("studio.add")}
        </button>
      </div>
    </section>
  );
}

export { ownedEntries };
