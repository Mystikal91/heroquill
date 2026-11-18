import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { copyEntriesTo, duplicateEntries, moveEntriesTo } from "../../app/arrange";
import { nameTheId } from "../../app/arrange";
import { content } from "../../app/store";
import { applyChange, selectedEntry, undoChange } from "../../app/studio";
import { offerUndo } from "../../app/undo";
import type { Entry } from "../../data/schema";
import { blankData } from "../../homebrew/blanks";
import { readClassCasting, readSubclassCasting } from "../../homebrew/casting";
import { DATA_FIELDS, KIND_META } from "../../homebrew/catalog";
import {
  deleteEntry,
  ownedOfKind,
  readTable,
  setTable,
  setText,
  updateEntry,
} from "../../homebrew/entries";
import { warningsFor } from "../../homebrew/warnings";
import { ui } from "../../i18n/ui";
import type { UserPackRecord } from "../../storage/packs";
import { entriesOfKind } from "../build/fields";
import { PackPicker } from "./Arrange";
import { ClassCasting, SubclassCasting } from "./Casting";
import { NumberBox, SelectBox, TextBox, withCurrent } from "./Controls";
import { EffectList } from "./Effects";
import { LevelStrip } from "./LevelStrip";
import { SpellTable, ValuesTable } from "./LevelTables";
import { OwnedList } from "./Owned";
import { PreviewBody } from "./Preview";
import {
  SpellCasting,
  SpellClasses,
  SpellLevelSchool,
  SpellNumbers,
  SpellTexts,
} from "./SpellForm";
import { StartingGear } from "./StartingGear";
import { type TabSpec, Tabs } from "./Tabs";
import { LanguageBar, TranslationPanel } from "./Translate";
import { DataControls, useEntryWrites } from "./entryWrites";
import { fieldLabel, optionLabel } from "./labels";
import { LAYOUTS } from "./layouts";
import { useEdit } from "./scope";

/** The tab of each entry that was opened, so that it is the same when the person comes back; a new entry starts at the first. */
export const entryTab = signal<Record<string, string>>({});

export function Delete({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  const name = record.strings[`${entry.id}.name`] || ui("studio.unnamed");
  return (
    <button
      type="button"
      class="danger"
      onClick={() => {
        applyChange(deleteEntry(record, entry.id));
        selectedEntry.value = undefined;
        offerUndo(ui("undo.deleted", { name }), undoChange);
      }}
    >
      {ui("studio.delete")}
    </button>
  );
}

/** What can be done with the entry as a whole: duplicate it, move or copy it to another pack, delete it. */
export function EntryTools({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  if (KIND_META[entry.kind].role === "owned") return null;
  return (
    <div class="studio-actions">
      <button type="button" onClick={() => void duplicateEntries([entry.id])}>
        {ui("studio.duplicate")}
      </button>
      <PackPicker label={ui("studio.moveTo")} onPick={(id) => void moveEntriesTo(id, [entry.id])} />
      <PackPicker label={ui("studio.copyTo")} onPick={(id) => void copyEntriesTo(id, [entry.id])} />
      <Delete record={record} entry={entry} />
    </div>
  );
}

/** The name of the entry, first thing of its main data; a new entry waits for it, and its id follows it. */
export function EntryName({ record, entry }: { record: UserPackRecord; entry: Entry }) {
  return (
    <TextBox
      key={entry.id}
      focusOnMount={!record.strings[`${entry.id}.name`]}
      label={ui("hb.f.name")}
      value={record.strings[`${entry.id}.name`] ?? ""}
      placeholder={ui("studio.unnamed")}
      onChange={(v) => applyChange(setText(record, entry.id, "name", v), `${entry.id}.name`)}
      onCommit={() => void nameTheId(entry.id)}
    />
  );
}

/** The tabs every entry has in the same place: the translations, how it reads with what to check, what can be done with it. */
export function commonTabs(
  record: UserPackRecord,
  shown: UserPackRecord,
  entry: Entry,
  language: string | undefined,
): { translation: TabSpec; preview: TabSpec; tools: TabSpec } {
  const problems = warningsFor(shown, entry, { packs: content.value?.packs ?? [] }).length;
  return {
    translation: {
      id: "translation",
      label: ui("studio.tab.translation"),
      body: () => (
        <>
          <LanguageBar record={record} entry={entry} />
          {language ? (
            <TranslationPanel record={record} entry={entry} language={language} />
          ) : (
            <p class="muted">{ui("studio.translateHint")}</p>
          )}
        </>
      ),
    },
    preview: {
      id: "preview",
      label: ui("studio.tab.preview"),
      badge: problems,
      body: () => <PreviewBody record={shown} entry={entry} />,
    },
    tools: {
      id: "tools",
      label: ui("studio.tab.tools"),
      body: () => <EntryTools record={record} entry={entry} />,
    },
  };
}

/**
 * The page of a spell in tabs: the main data, how it is cast, who can learn it, the numbers the
 * game rolls (advanced mode), the translations, how it reads with what to check, and what can be done
 * with it. The language chosen in the translation tab is the one the preview reads in.
 */
export function SpellTabs({
  record,
  shown,
  entry,
  language,
}: {
  record: UserPackRecord;
  /** The pack as the preview reads it (with the texts of the language being written). */
  shown: UserPackRecord;
  entry: Entry;
  language: string | undefined;
}) {
  const { translation, preview, tools } = commonTabs(record, shown, entry, language);
  const tabs: TabSpec[] = [
    {
      id: "main",
      label: ui("studio.tab.main"),
      body: () => (
        <div class="studio-form">
          <EntryName record={record} entry={entry} />
          <SpellLevelSchool record={record} entry={entry} />
          <SpellTexts record={record} entry={entry} />
        </div>
      ),
    },
    {
      id: "cast",
      label: ui("studio.tab.cast"),
      body: () => (
        <div class="studio-form">
          <SpellCasting record={record} entry={entry} />
        </div>
      ),
    },
    {
      id: "classes",
      label: ui("studio.tab.classes"),
      body: () => (
        <div class="studio-form">
          <SpellClasses record={record} entry={entry} />
        </div>
      ),
    },
    ...[
      {
        id: "numbers",
        label: ui("studio.tab.numbers"),
        body: () => (
          <div class="studio-form">
            <SpellNumbers record={record} entry={entry} />
          </div>
        ),
      },
    ],
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

/** The part of the data of an item that goes with each category: what the category asks for. */
const SECTION_OF: Record<string, "weapon" | "armor" | "gear" | "tool" | "vehicle"> = {
  weapon: "weapon",
  armor: "armor",
  "adventuring-gear": "gear",
  tools: "tool",
  "mounts-and-vehicles": "vehicle",
};
const SECTIONS = ["weapon", "armor", "gear", "tool", "vehicle"] as const;

/** An empty section of an item, valid from the start. */
function blankSection(section: (typeof SECTIONS)[number]): unknown {
  if (section === "weapon") return blankData("item", "weapon").weapon;
  if (section === "armor") return blankData("item", "armor").armor;
  if (section === "gear") return { category: "standard-gear" };
  return {};
}

/**
 * The page of an item in tabs. The category (chosen in the main data) decides which tab there is:
 * a weapon has its weapon tab, an armor its armor tab. A rarity makes the item a magic one and asks
 * where it is worn and whether it needs attunement, right under it. Then the effects it gives while it
 * is equipped, the rest of the fields (advanced mode), the translations, how it reads, and the actions.
 */
export function ItemTabs({
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
  const { data, text, writeText, writeData, writeEffects, writeDataMany } = useEntryWrites(
    record,
    entry,
  );
  // An enchantment is not carried: it is put on a weapon the character has, so it has no cost, weight or
  // category of its own, only a rarity, a bonus and what it does.
  const enchants = data.enchants === true;
  const cost = data.cost as { amount?: number; unit?: string } | undefined;
  const category = typeof data.category === "string" ? data.category : "";
  const own = SECTION_OF[category];
  // A rarity says how rare an item is, not what it is: it asks where it is worn and for attunement, and
  // leaves the category as it is. Whether a weapon counts as magic is a tick of its own, in the weapon tab.
  const magic = category === "magic-items" || data.rarity !== undefined;
  const hasWeapon = !enchants && (category === "weapon" || Boolean(data.weapon));
  const hasArmor = !enchants && (category === "armor" || Boolean(data.armor));
  // The section of the other categories (gear, tool, vehicle) has one tab, in the advanced mode.
  const typeKey = enchants
    ? undefined
    : (["gear", "tool", "vehicle"] as const).find((k) => own === k || Boolean(data[k]));
  const gear = data.gear as { category?: string } | undefined;
  const gearKind = gear?.category;
  const categories = (() => {
    const spec = DATA_FIELDS.item.find((f) => f.key === "category");
    return spec?.type.type === "text" ? (spec.type.options ?? []) : [];
  })();

  // Choosing a category brings the section it needs and takes away the ones of the others (one step, so
  // it can be undone): an item is a weapon because it says so, not because a section was added by hand.
  const changeCategory = (next: string | undefined) => {
    if (!next) return;
    const keep = SECTION_OF[next];
    const changes: Record<string, unknown> = { category: next };
    for (const section of SECTIONS) if (section !== keep) changes[section] = undefined;
    if (keep && data[keep] === undefined) changes[keep] = blankSection(keep);
    if (next === "magic-items" && data.rarity === undefined) changes.rarity = "uncommon";
    writeDataMany(changes);
  };

  const rest = DATA_FIELDS.item.filter(
    (f) =>
      ![
        "category",
        "cost",
        "weight",
        "rarity",
        "slot",
        "enhancement",
        "enchants",
        "magical",
        "poison",
        "weapon",
        "armor",
        "gear",
        "tool",
        "vehicle",
      ].includes(f.key),
  );
  const kindOf = (f: (typeof rest)[number]) => f.type.type;
  const flags = rest.filter((f) => kindOf(f) === "boolean").map((f) => f.key);
  const sections = rest
    .filter((f) => ["object", "record", "list"].includes(kindOf(f)))
    .map((f) => f.key);
  const scalars = rest.map((f) => f.key).filter((k) => !flags.includes(k) && !sections.includes(k));
  const form = (body: () => ComponentChildren) => () => <div class="studio-form">{body()}</div>;

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
            rows={5}
            onChange={(v) => writeText("desc", v)}
          />
          <div class="studio-grid">
            {!enchants && (
              <SelectBox
                label={fieldLabel("category")}
                value={category || undefined}
                options={withCurrent(
                  categories.map((id) => ({ id, label: optionLabel(id) })),
                  category,
                )}
                onChange={changeCategory}
              />
            )}
            <DataControls record={record} entry={entry} keys={["rarity"]} />
          </div>
          {!enchants && (
            <div class="studio-grid studio-grid-line">
              <NumberBox
                label={fieldLabel("cost")}
                min={0}
                value={cost?.amount}
                onChange={(v) => writeData("cost", { unit: "gp", ...cost, amount: v ?? 0 })}
              />
              <SelectBox
                label={fieldLabel("unit")}
                value={cost?.unit ?? "gp"}
                options={["cp", "sp", "gp"].map((id) => ({ id, label: optionLabel(id) }))}
                onChange={(v) => writeData("cost", { amount: 0, ...cost, unit: v ?? "gp" })}
              />
              <DataControls record={record} entry={entry} keys={["weight"]} />
              {magic && <DataControls record={record} entry={entry} keys={["slot"]} />}
            </div>
          )}
          {enchants && (
            <div class="studio-grid studio-grid-line">
              <DataControls record={record} entry={entry} keys={["enhancement"]} />
            </div>
          )}
        </>
      )),
    },
    ...(hasWeapon
      ? [
          {
            id: "weapon",
            label: ui("hb.kind.weapon"),
            body: form(() => (
              <DataControls
                record={record}
                entry={entry}
                keys={["weapon", "enhancement", "magical"]}
              />
            )),
          },
        ]
      : []),
    ...(hasArmor
      ? [
          {
            id: "armor",
            label: ui("hb.kind.armor"),
            body: form(() => (
              <DataControls record={record} entry={entry} keys={["armor", "enhancement"]} />
            )),
          },
        ]
      : []),
    ...(typeKey
      ? [
          {
            id: "type",
            label: optionLabel(category || typeKey),
            body: form(() => (
              <DataControls
                record={record}
                entry={entry}
                keys={
                  typeKey === "gear" && (gearKind === "poisons" || data.poison)
                    ? [typeKey, "poison"]
                    : [typeKey]
                }
              />
            )),
          },
        ]
      : []),
    {
      id: "effects",
      label: ui("studio.effects"),
      badge: entry.effects.length,
      body: form(() => (
        <>
          <p class="muted">{ui("studio.itemEffectsHint")}</p>
          <EffectList effects={entry.effects} onChange={writeEffects} />
        </>
      )),
    },
    ...[
      {
        id: "details",
        label: ui("studio.advancedFields"),
        body: form(() => (
          <>
            <div class="studio-grid">
              <DataControls record={record} entry={entry} keys={scalars} />
            </div>
            <div class="studio-checks">
              <DataControls record={record} entry={entry} keys={flags} />
            </div>
            {sections.length > 0 && (
              <>
                <h4>{ui("studio.itemSections")}</h4>
                <div class="studio-sections">
                  <DataControls record={record} entry={entry} keys={sections} />
                </div>
              </>
            )}
          </>
        )),
      },
    ],
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

/**
 * The page of a species (or a subspecies) in tabs: the main data (name, description, size, speed and,
 * for a subspecies, the species it belongs to), the traits it owns, the effects it gives, the rest of the
 * fields (advanced mode), the translations, how it reads, and the actions.
 */
export function SpeciesTabs({
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
  const { text, writeText, writeEffects } = useEntryWrites(record, entry);
  const { apply } = useEdit();
  const sub = entry.kind === "subspecies";
  const main = sub ? ["replacesSpecies", "speed", "size"] : ["speed", "size"];
  const rest = DATA_FIELDS[entry.kind].map((f) => f.key).filter((k) => !main.includes(k));
  const traits = ownedOfKind(record, entry.id, "trait").length;
  const form = (body: () => ComponentChildren) => () => <div class="studio-form">{body()}</div>;
  const tabs: TabSpec[] = [
    {
      id: "main",
      label: ui("studio.tab.main"),
      body: form(() => (
        <>
          <EntryName record={record} entry={entry} />
          {sub && !entry.parent && (
            <p class="studio-callout warn">{ui("studio.subspeciesNoParent")}</p>
          )}
          {sub && (
            <SelectBox
              label={ui("studio.parent")}
              value={entry.parent}
              options={entriesOfKind("species")}
              blank={ui("form.none")}
              onChange={(v) =>
                apply(
                  updateEntry(record, entry.id, { parent: v as Entry["id"] | undefined }),
                  `${entry.id}.parent`,
                )
              }
            />
          )}
          <TextBox
            label={ui("hb.f.desc")}
            placeholder={ui("hint.desc")}
            value={text("desc")}
            area
            rows={5}
            onChange={(v) => writeText("desc", v)}
          />
          <div class="studio-grid studio-grid-line">
            <DataControls record={record} entry={entry} keys={["speed", "size"]} />
          </div>
          {sub && <small class="muted">{ui("studio.subspeciesInherit")}</small>}
          {sub && (
            <div class="studio-checks">
              <DataControls record={record} entry={entry} keys={["replacesSpecies"]} />
            </div>
          )}
        </>
      )),
    },
    {
      id: "traits",
      label: ui("studio.traits"),
      badge: traits,
      body: form(() => <OwnedList record={record} owner={entry} kind="trait" />),
    },
    {
      id: "effects",
      label: ui("studio.effects"),
      badge: entry.effects.filter((e) => e.type !== "trait").length,
      body: form(() => (
        <EffectList hidden={["trait"]} effects={entry.effects} onChange={writeEffects} />
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

/** The kinds whose page is the one made from their layout (see `LayoutTabs`). */
export const LAYOUT_TABBED = new Set([
  "background",
  "feat",
  "language",
  "property",
  "deity",
  "condition",
  "skill",
  "proficiency",
  "school",
  "alignment",
  "ability",
  "option",
  "reserve",
  "damage",
  "component",
]);

/**
 * The page in tabs of the kinds that are made from their layout: the main data (name, texts and the
 * fields a beginner is shown), what a background adds (personality, the feature it gives), the effects,
 * the rest of the fields (advanced mode), the translations, how it reads, and the actions.
 */
export function LayoutTabs({
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
  const { data, text, writeText, writeData, writeEffects } = useEntryWrites(record, entry);
  const { apply } = useEdit();
  const layout = LAYOUTS[entry.kind];
  const background = entry.kind === "background";
  const guided = layout.guided(entry);
  const specs = DATA_FIELDS[entry.kind];
  const gearKeys = background ? ["startingGold", "startingEquipment", "startingChoices"] : [];
  const rest = specs.map((s) => s.key).filter((k) => !guided.includes(k) && !gearKeys.includes(k));
  const own = (field: string) =>
    !(background && (field === "featureName" || field === "featureDesc"));
  const box = ([field, area]: [string, boolean]) => (
    <TextBox
      key={field}
      label={fieldLabel(field)}
      placeholder={field === "desc" ? ui("hint.desc") : undefined}
      value={text(field)}
      area={area}
      rows={area ? 5 : undefined}
      onChange={(v) => writeText(field, v)}
    />
  );
  const form = (body: () => ComponentChildren) => () => <div class="studio-form">{body()}</div>;
  const tabs: TabSpec[] = [
    {
      id: "main",
      label: ui("studio.tab.main"),
      body: form(() => (
        <>
          <EntryName record={record} entry={entry} />
          {layout.texts.filter(([f]) => own(f)).map(box)}
          {background && <p class="muted">{ui("studio.bg2024")}</p>}
          {guided.length > 0 && (
            <div class="studio-grid studio-grid-line">
              <DataControls record={record} entry={entry} keys={guided} />
            </div>
          )}
        </>
      )),
    },
    ...(background
      ? [
          {
            id: "personality",
            label: ui("studio.tab.personality"),
            body: form(() => (
              <>
                <p class="muted">{ui("studio.bg2014")}</p>
                {layout.tables?.map(([field, picks]) => (
                  <TextBox
                    key={field}
                    label={fieldLabel(field)}
                    hint={ui("studio.tableHint")}
                    area
                    rows={3}
                    value={readTable(record, entry.id, field).join("\n")}
                    onChange={(v) =>
                      apply(
                        setTable(record, entry.id, field, v.split("\n"), picks),
                        `${entry.id}.${field}`,
                      )
                    }
                  />
                ))}
              </>
            )),
          },
          {
            id: "feature",
            label: ui("studio.tab.backgroundFeature"),
            body: form(() => (
              <>
                <p class="muted">{ui("studio.bg2014")}</p>
                {layout.texts.filter(([f]) => !own(f)).map(box)}
              </>
            )),
          },
          {
            id: "gear",
            label: ui("studio.tab.startingGear"),
            body: form(() => (
              <>
                <DataControls record={record} entry={entry} keys={["startingGold"]} />
                <StartingGear
                  fixed={data.startingEquipment}
                  choices={data.startingChoices}
                  onFixed={(v) => writeData("startingEquipment", v)}
                  onChoices={(v) => writeData("startingChoices", v)}
                />
              </>
            )),
          },
        ]
      : []),
    ...(layout.effects
      ? [
          {
            id: "effects",
            label: ui("studio.effects"),
            badge: entry.effects.length,
            body: form(() => <EffectList effects={entry.effects} onChange={writeEffects} />),
          },
        ]
      : []),
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

/**
 * The page of a class (or a subclass) in tabs: the main data (name, description, hit die, the class a
 * subclass belongs to), the features by level, the spells it casts, the table of values by level (a
 * class), the effects, the rest of the fields (advanced mode), the translations, how it reads, and the
 * actions.
 */
export function ClassTabs({
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
  const { data, text, writeText, writeData, writeEffects } = useEntryWrites(record, entry);
  const { apply } = useEdit();
  const sub = entry.kind === "subclass";
  const casts = sub ? readSubclassCasting(data).enabled : readClassCasting(data).kind !== "none";
  const main = sub ? [] : ["hitDie", "primaryAbility"];
  const spellKeys = sub ? ["spells"] : [];
  const rest = DATA_FIELDS[entry.kind]
    .map((f) => f.key)
    .filter(
      (k) =>
        !main.includes(k) &&
        !spellKeys.includes(k) &&
        k !== "levels" &&
        !["startingEquipment", "startingChoices", "startingWealth"].includes(k),
    );
  const features = ownedOfKind(record, entry.id, "feature").length;
  const form = (body: () => ComponentChildren) => () => <div class="studio-form">{body()}</div>;
  const tabs: TabSpec[] = [
    {
      id: "main",
      label: ui("studio.tab.main"),
      body: form(() => (
        <>
          <EntryName record={record} entry={entry} />
          {sub && (
            <SelectBox
              label={ui("studio.parent")}
              value={entry.parent}
              options={entriesOfKind("class")}
              blank={ui("form.none")}
              onChange={(v) =>
                apply(
                  updateEntry(record, entry.id, { parent: v as Entry["id"] | undefined }),
                  `${entry.id}.parent`,
                )
              }
            />
          )}
          <TextBox
            label={ui("hb.f.desc")}
            placeholder={ui("hint.desc")}
            value={text("desc")}
            area
            rows={5}
            onChange={(v) => writeText("desc", v)}
          />
          {main.length > 0 && <DataControls record={record} entry={entry} keys={main} />}
        </>
      )),
    },
    {
      id: "features",
      label: ui("studio.features"),
      badge: features,
      body: form(() => (
        <>
          <LevelStrip record={record} entry={entry} />
          <OwnedList record={record} owner={entry} kind="feature" />
        </>
      )),
    },
    {
      id: "spells",
      label: ui("studio.spellsSection"),
      body: form(() => (
        <>
          {sub ? (
            <SubclassCasting record={record} entry={entry} />
          ) : (
            <ClassCasting record={record} entry={entry} />
          )}
          {casts && <SpellTable record={record} entry={entry} />}
          {spellKeys.length > 0 && <DataControls record={record} entry={entry} keys={spellKeys} />}
        </>
      )),
    },
    ...(sub
      ? []
      : [
          {
            id: "values",
            label: ui("studio.valuesSection"),
            body: form(() => <ValuesTable record={record} entry={entry} />),
          },
          {
            id: "gear",
            label: ui("studio.tab.startingGear"),
            body: form(() => (
              <>
                <StartingGear
                  fixed={data.startingEquipment}
                  choices={data.startingChoices}
                  onFixed={(v) => writeData("startingEquipment", v)}
                  onChoices={(v) => writeData("startingChoices", v)}
                />
                <DataControls record={record} entry={entry} keys={["startingWealth"]} />
              </>
            )),
          },
        ]),
    {
      id: "effects",
      label: ui("studio.effects"),
      badge: entry.effects.length,
      body: form(() => <EffectList effects={entry.effects} onChange={writeEffects} />),
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
