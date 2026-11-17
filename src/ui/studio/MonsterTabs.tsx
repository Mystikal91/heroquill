import type { ComponentChildren } from "preact";
import type { Entry } from "../../data/schema";
import { DATA_FIELDS, MONSTER_ACTION_FIELDS } from "../../homebrew/catalog";
import { updateEntry } from "../../homebrew/entries";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { FieldControl, TextBox } from "./Controls";
import { EntryName, commonTabs, entryTab } from "./EntryTabs";
import { type TabSpec, Tabs } from "./Tabs";
import { DataControls, useEntryWrites } from "./entryWrites";
import { fieldLabel } from "./labels";
import { useEdit } from "./scope";

/** The lists of a stat block that hold a name and a text each, with the title each has. */
const LISTS = [
  ["special", "studio.monster.special"],
  ["actions", "monster.actions"],
  ["bonusActions", "monster.bonusActions"],
  ["reactions", "monster.reactions"],
  ["legendary", "monster.legendary"],
] as const;

/**
 * Takes the texts of the item at `at` of a list away and moves the texts of the ones after it up by
 * one (the texts of a list are numbered from 1: `actions.2.name`), in the pack and in its translations.
 */
function dropTexts(record: UserPackRecord, id: string, list: string, at: number): UserPackRecord {
  const prefix = `${id}.${list}.`;
  const shift = (texts: Record<string, string>) => {
    const next: Record<string, string> = {};
    for (const [key, value] of Object.entries(texts)) {
      if (!key.startsWith(prefix)) {
        next[key] = value;
        continue;
      }
      const [n, ...field] = key.slice(prefix.length).split(".");
      const number = Number(n);
      if (!Number.isInteger(number)) next[key] = value;
      else if (number === at + 1) continue;
      else next[number > at + 1 ? `${prefix}${number - 1}.${field.join(".")}` : key] = value;
    }
    return next;
  };
  return {
    ...record,
    strings: shift(record.strings),
    ...(record.translations && {
      translations: Object.fromEntries(
        Object.entries(record.translations).map(([lang, texts]) => [lang, shift(texts)]),
      ),
    }),
  };
}

/** One list of a stat block: each item with its name and text, and what the game rolls for it (advanced). */
function ActionList({
  record,
  entry,
  list,
  title,
}: {
  record: UserPackRecord;
  entry: Entry;
  list: (typeof LISTS)[number][0];
  title: string;
}) {
  const { apply } = useEdit();
  const { data, text, writeText, writeData } = useEntryWrites(record, entry);
  const items = Array.isArray(data[list]) ? (data[list] as Record<string, unknown>[]) : [];
  const remove = (at: number) => {
    const without = items.filter((_, i) => i !== at);
    const texts = dropTexts(record, entry.id, list, at);
    apply(
      updateEntry(texts, entry.id, {
        data: { ...data, [list]: without.length ? without : undefined },
      }),
      `${entry.id}.${list}`,
    );
  };
  const change = (at: number, key: string, value: unknown) => {
    const next = items.map((item, i) => {
      if (i !== at) return item;
      const { [key]: _old, ...others } = item;
      return value === undefined ? others : { ...others, [key]: value };
    });
    writeData(list, next);
  };
  return (
    <section class="studio-gear">
      <h4>{title}</h4>
      {items.map((item, i) => {
        const prefix = `${list}.${i + 1}`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the items have no identity but their place
          <details class="studio-effect" key={i} open>
            <summary>
              <b>{text(`${prefix}.name`) || ui("studio.unnamed")}</b>
              <button
                type="button"
                class="danger"
                onClick={(e) => {
                  e.preventDefault();
                  remove(i);
                }}
              >
                {ui("form.remove")}
              </button>
            </summary>
            <TextBox
              label={ui("hb.f.name")}
              value={text(`${prefix}.name`)}
              onChange={(v) => writeText(`${prefix}.name`, v)}
            />
            <TextBox
              label={ui("hb.f.desc")}
              area
              rows={3}
              value={text(`${prefix}.desc`)}
              onChange={(v) => writeText(`${prefix}.desc`, v)}
            />
            {MONSTER_ACTION_FIELDS.map((spec) => (
              <FieldControl
                key={spec.key}
                label={fieldLabel(spec.key)}
                type={spec.type}
                value={item[spec.key]}
                optional
                onChange={(v) => change(i, spec.key, v)}
              />
            ))}
          </details>
        );
      })}
      <div class="studio-field">
        <button type="button" onClick={() => writeData(list, [...items, {}])}>
          {ui("studio.addNamed", { name: title })}
        </button>
      </div>
    </section>
  );
}

/**
 * The page of a monster in tabs, like its stat block: the main data (name, text, size, type, challenge), the
 * fighting numbers, the ability scores, the senses, the traits and actions, the rest of the fields (advanced
 * mode), the translations, how it reads, and the actions of the page.
 */
export function MonsterTabs({
  record,
  shown,
  entry,
  language,
}: {
  record: UserPackRecord;
  shown: UserPackRecord;
  entry: Entry;
  language: string | undefined;
}) {
  const { translation, preview, tools } = commonTabs(record, shown, entry, language);
  const { text, writeText } = useEntryWrites(record, entry);
  const groups = {
    main: ["size", "type", "subtype", "challenge", "xp", "proficiencyBonus"],
    combat: ["armorClass", "hitPoints", "hitDice", "hitPointsRoll", "speed"],
    abilities: ["abilities", "saves", "skills"],
    senses: ["senses", "passivePerception", "conditionImmunities", "blindBeyond"],
  };
  const placed = new Set([...Object.values(groups).flat(), ...LISTS.map(([key]) => key)]);
  const rest = DATA_FIELDS.monster.map((f) => f.key).filter((k) => !placed.has(k));
  const form = (body: () => ComponentChildren) => () => <div class="studio-form">{body()}</div>;
  const data = entry.data as Record<string, unknown>;
  const count = LISTS.reduce(
    (n, [key]) => n + (Array.isArray(data[key]) ? (data[key] as unknown[]).length : 0),
    0,
  );
  const tabs: TabSpec[] = [
    {
      id: "main",
      label: ui("studio.tab.main"),
      body: form(() => (
        <>
          <EntryName record={record} entry={entry} />
          <TextBox
            label={ui("hb.f.desc")}
            placeholder={ui("hint.desc")}
            value={text("desc")}
            area
            rows={4}
            onChange={(v) => writeText("desc", v)}
          />
          <div class="studio-grid studio-grid-line">
            <DataControls record={record} entry={entry} keys={groups.main} />
          </div>
        </>
      )),
    },
    {
      id: "combat",
      label: ui("studio.tab.combat"),
      body: form(() => <DataControls record={record} entry={entry} keys={groups.combat} />),
    },
    {
      id: "abilities",
      label: ui("studio.tab.abilities"),
      body: form(() => <DataControls record={record} entry={entry} keys={groups.abilities} />),
    },
    {
      id: "senses",
      label: ui("studio.tab.senses"),
      body: form(() => <DataControls record={record} entry={entry} keys={groups.senses} />),
    },
    {
      id: "actions",
      label: ui("studio.tab.monsterActions"),
      badge: count,
      body: form(() => (
        <>
          {LISTS.map(([key, title]) => (
            <ActionList key={key} record={record} entry={entry} list={key} title={ui(title)} />
          ))}
        </>
      )),
    },
    ...(rest.length > 0
      ? [
          {
            id: "details",
            label: ui("studio.advancedFields"),
            body: form(() => <DataControls record={record} entry={entry} keys={rest} />),
          },
        ]
      : []),
    translation,
    preview,
    tools,
  ];
  return (
    <Tabs
      tabs={tabs}
      current={entryTab.value[entry.id] ?? "main"}
      onChange={(id) => {
        entryTab.value = { ...entryTab.value, [entry.id]: id };
      }}
      label={ui("studio.tab.entryLabel")}
    />
  );
}
