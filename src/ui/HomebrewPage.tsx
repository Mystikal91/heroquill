import { useRef, useState } from "preact/hooks";
import {
  closeHomebrewPack,
  createHomebrewPack,
  deleteHomebrewEntry,
  editingPack,
  openHomebrewPack,
  renameHomebrewPack,
  saveHomebrewEntry,
  takeWaitingDraft,
} from "../app/homebrew";
import { leavePage } from "../app/navigation";
import { content } from "../app/store";
import { offerUndo } from "../app/undo";
import {
  addUserPack,
  exportPack,
  importPackFile,
  packError,
  removeUserPack,
  userPacks,
} from "../app/userPacks";
import {
  ABILITY_IDS,
  CASTING_KINDS,
  COIN_UNITS,
  DAMAGE_TYPES,
  DEFAULT_ASI_LEVELS,
  type Draft,
  type DraftTrait,
  HIT_DICE,
  HOMEBREW_KINDS,
  type HomebrewKind,
  PREPARATION_KINDS,
  SIZES,
  SUBCLASS_CASTING_KINDS,
  blankDraft,
  draftFromEntry,
  draftReady,
  editableEntries,
} from "../homebrew/model";
import { type UiKey, ui } from "../i18n/ui";
import { PropertyPicker } from "./PropertyPicker";
import { entriesOfKind } from "./build/fields";

const label = (key: string) => ui(`hb.f.${key}` as UiKey);
const option = (key: string) => ui(`hb.o.${key}` as UiKey);
const kindName = (kind: HomebrewKind) => ui(`hb.kind.${kind}` as UiKey);

export interface FormApi {
  draft: Draft;
  set: (key: string, value: string) => void;
  setTraits: (traits: DraftTrait[]) => void;
  /** Fields to leave out, when the place that opens the form already knows them. */
  hide?: string[];
  /** The properties an item can have; `create` is there where a new one can be written on the spot. */
  properties?: {
    options: { id: string; label: string }[];
    create?: (name: string, desc: string) => string;
  };
}

export function Text({
  api,
  name,
  area,
  fallback,
}: {
  api: FormApi;
  name: string;
  area?: boolean;
  fallback?: string;
}) {
  const value = api.draft.values[name] ?? fallback ?? "";
  if (area)
    return (
      <label class="field">
        <span>{label(name)}</span>
        <textarea rows={4} value={value} onInput={(e) => api.set(name, e.currentTarget.value)} />
      </label>
    );
  return (
    <label class="field">
      <span>{label(name)}</span>
      <input type="text" value={value} onInput={(e) => api.set(name, e.currentTarget.value)} />
    </label>
  );
}

export function Num({
  api,
  name,
  min,
  text,
}: { api: FormApi; name: string; min?: number; text?: string }) {
  return (
    <label class="field">
      <span>{text ?? label(name)}</span>
      <input
        type="number"
        min={min}
        value={api.draft.values[name] ?? ""}
        onInput={(e) => api.set(name, e.currentTarget.value)}
      />
    </label>
  );
}

export function Pick({
  api,
  name,
  options,
  blank,
  fallback,
}: {
  api: FormApi;
  name: string;
  options: { id: string; label: string }[];
  blank?: boolean;
  /** What the entry gets when the person leaves the field alone; it must match the builder's default. */
  fallback?: string;
}) {
  return (
    <label class="field">
      <span>{label(name)}</span>
      <select
        value={api.draft.values[name] ?? fallback ?? ""}
        onChange={(e) => api.set(name, e.currentTarget.value)}
      >
        {blank && <option value="">{ui("form.none")}</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Check({ api, name }: { api: FormApi; name: string }) {
  return (
    <label class="check">
      <input
        type="checkbox"
        checked={api.draft.values[name] === "true"}
        onChange={(e) => api.set(name, e.currentTarget.checked ? "true" : "")}
      />
      <span>{label(name)}</span>
    </label>
  );
}

/** A group of checkboxes whose picks are kept as ids joined by commas. */
function Many({
  api,
  name,
  options,
}: {
  api: FormApi;
  name: string;
  options: { id: string; label: string }[];
}) {
  const picked = new Set((api.draft.values[name] ?? "").split(",").filter(Boolean));
  const toggle = (id: string, on: boolean) => {
    if (on) picked.add(id);
    else picked.delete(id);
    api.set(name, [...picked].join(","));
  };
  return (
    <fieldset class="hb-many">
      <legend>{label(name)}</legend>
      <div class="hb-grid">
        {options.map((o) => (
          <label class="check" key={o.id}>
            <input
              type="checkbox"
              checked={picked.has(o.id)}
              onChange={(e) => toggle(o.id, e.currentTarget.checked)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    id: String(from + i),
    label: String(from + i),
  }));

export function Cost({ api }: { api: FormApi }) {
  return (
    <div class="hb-row">
      <Num api={api} name="costAmount" min={0} />
      <Pick
        api={api}
        name="costUnit"
        fallback="gp"
        options={COIN_UNITS.map((u) => ({ id: u, label: u }))}
      />
      <Num api={api} name="weight" min={0} />
    </div>
  );
}

function abilityOptions() {
  const c = content.value;
  return ABILITY_IDS.map((a) => ({
    id: a,
    label: c?.name(`srd51:ability/${a}`) ?? a.toUpperCase(),
  }));
}

function Fields({ api }: { api: FormApi }) {
  const abilities = abilityOptions();
  const proficiencies = (list: string[]) =>
    list.map((id) => ({ id, label: content.value?.name(`srd51:proficiency/${id}`) ?? id }));
  const slugs = (kind: string) =>
    entriesOfKind(kind).map((e) => ({ id: e.id.split("/")[1] ?? e.id, label: e.label }));
  switch (api.draft.kind) {
    case "spell":
      return (
        <>
          <div class="hb-row">
            <Pick api={api} name="level" fallback="0" options={range(0, 9)} />
            <Pick api={api} name="school" fallback="evocation" options={slugs("school")} />
          </div>
          <Text api={api} name="castingTime" />
          <Text api={api} name="range" />
          <Text api={api} name="duration" />
          <div class="hb-grid">
            <Check api={api} name="compV" />
            <Check api={api} name="compS" />
            <Check api={api} name="compM" />
            <Check api={api} name="ritual" />
            <Check api={api} name="concentration" />
          </div>
          <Text api={api} name="material" />
          {!api.hide?.includes("classes") && (
            <Many api={api} name="classes" options={entriesOfKind("class")} />
          )}
          <Text api={api} name="desc" area />
          <Text api={api} name="higherLevel" area />
        </>
      );
    case "weapon":
      return (
        <>
          <div class="hb-row">
            <Pick
              api={api}
              name="wcategory"
              fallback="simple"
              options={["simple", "martial"].map((id) => ({ id, label: option(id) }))}
            />
            <Pick
              api={api}
              name="wkind"
              fallback="melee"
              options={["melee", "ranged"].map((id) => ({ id, label: option(id) }))}
            />
          </div>
          <div class="hb-row">
            <Text api={api} name="damage" />
            <Pick
              api={api}
              name="damageType"
              fallback="slashing"
              options={DAMAGE_TYPES.map((id) => ({ id, label: option(id) }))}
            />
            <Text api={api} name="versatile" />
          </div>
          <div class="hb-row">
            <Num api={api} name="rangeNormal" min={0} />
            <Num api={api} name="rangeLong" min={0} />
          </div>
          <div class="hb-row">
            <Pick
              api={api}
              name="enhancement"
              fallback="0"
              options={[0, 1, 2, 3].map((n) => ({ id: String(n), label: n === 0 ? "—" : `+${n}` }))}
            />
          </div>
          <Check api={api} name="magical" />
          <PropertyPicker api={api} />
          <Cost api={api} />
          <Text api={api} name="desc" area />
        </>
      );
    case "armor":
      return (
        <>
          <div class="hb-row">
            <Pick
              api={api}
              name="acategory"
              fallback="light"
              options={["light", "medium", "heavy", "shield"].map((id) => ({
                id,
                label: option(id),
              }))}
            />
            <Num api={api} name="base" min={0} />
            <Num api={api} name="maxDex" min={0} />
            <Num api={api} name="strMin" min={0} />
          </div>
          <div class="hb-grid">
            <Check api={api} name="dexBonus" />
            <Check api={api} name="stealth" />
          </div>
          <PropertyPicker api={api} />
          <Cost api={api} />
          <Text api={api} name="desc" area />
        </>
      );
    case "gear":
      return (
        <>
          <Cost api={api} />
          <Text api={api} name="desc" area />
        </>
      );
    case "property":
      return (
        <>
          <Text api={api} name="desc" area />
        </>
      );
    case "language":
      return (
        <>
          <Text api={api} name="speakers" />
          <Text api={api} name="script" />
          <Text api={api} name="desc" area />
        </>
      );
    case "feat":
      return (
        <>
          <div class="hb-row">
            <Pick api={api} name="bonusAbility" options={abilities} blank />
            <Pick api={api} name="bonusValue" fallback="1" options={range(1, 2)} />
          </div>
          <div class="hb-row">
            <Pick api={api} name="prereqAbility" options={abilities} blank />
            <Num api={api} name="prereqMin" min={1} />
          </div>
          <Text api={api} name="desc" area />
        </>
      );
    case "species":
      return (
        <>
          <div class="hb-row">
            <Pick
              api={api}
              name="size"
              fallback="medium"
              options={SIZES.map((id) => ({ id, label: option(id) }))}
            />
            <Num api={api} name="speed" min={0} />
          </div>
          <fieldset class="hb-many">
            <legend>{label("bonus")}</legend>
            <div class="hb-grid">
              {abilities.map((a) => (
                <label class="field" key={a.id}>
                  <span>{a.label}</span>
                  <input
                    type="number"
                    value={api.draft.values[`bonus-${a.id}`] ?? ""}
                    onInput={(e) => api.set(`bonus-${a.id}`, e.currentTarget.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <Many api={api} name="languages" options={slugs("language")} />
          <Text api={api} name="desc" area />
          <Traits api={api} />
        </>
      );
    case "class":
      return (
        <>
          <div class="hb-row">
            <Pick
              api={api}
              name="hitDie"
              fallback="8"
              options={HIT_DICE.map((d) => ({ id: String(d), label: `d${d}` }))}
            />
            <Pick api={api} name="skillCount" fallback="2" options={range(0, 6)} />
          </div>
          <Many api={api} name="saves" options={abilities} />
          <Many
            api={api}
            name="armor"
            options={proficiencies(["light-armor", "medium-armor", "heavy-armor", "shields"])}
          />
          <Many
            api={api}
            name="weapons"
            options={proficiencies(["simple-weapons", "martial-weapons"])}
          />
          <Many api={api} name="skills" options={slugs("skill")} />
          <div class="hb-row">
            <Pick
              api={api}
              name="casting"
              fallback="none"
              options={CASTING_KINDS.map((id) => ({ id, label: option(id) }))}
            />
            <Pick api={api} name="castAbility" fallback="int" options={abilities} />
            <Pick
              api={api}
              name="preparation"
              fallback="prepared"
              options={PREPARATION_KINDS.map((id) => ({ id, label: option(id) }))}
            />
            <Num api={api} name="cantrips" min={0} />
          </div>
          {(api.draft.values.casting ?? "none") !== "none" && (
            <p class="muted">{ui("hb.classSpellsHint")}</p>
          )}
          <Text api={api} name="asiLevels" fallback={DEFAULT_ASI_LEVELS} />
          <div class="hb-row">
            <Pick api={api} name="multiAbility" options={abilities} blank />
            <Num api={api} name="multiMin" min={1} />
          </div>
          <Text api={api} name="desc" area />
          <Features api={api} />
        </>
      );
    case "subclass":
      return (
        <>
          <Pick api={api} name="parent" options={entriesOfKind("class")} blank />
          <Pick
            api={api}
            name="casting"
            fallback="none"
            options={SUBCLASS_CASTING_KINDS.map((id) => ({ id, label: option(id) }))}
          />
          {api.draft.values.casting === "third" && (
            <div class="hb-row">
              <Pick api={api} name="castAbility" fallback="int" options={abilities} />
              <Pick
                api={api}
                name="castList"
                fallback="srd51:class/wizard"
                options={entriesOfKind("class")}
              />
              <Num api={api} name="cantrips" min={0} text={label("cantripsThird")} />
            </div>
          )}
          {api.draft.values.casting === "third" && (
            <>
              <p class="muted">{ui("hb.castSchoolsHint")}</p>
              <Many api={api} name="castSchools" options={slugs("school")} />
            </>
          )}
          <Text api={api} name="desc" area />
          <Features api={api} />
        </>
      );
    case "background":
      return (
        <>
          <Many api={api} name="skills" options={slugs("skill")} />
          <Pick api={api} name="languageChoices" fallback="0" options={range(0, 4)} />
          <Text api={api} name="desc" area />
          <Text api={api} name="featureName" />
          <Text api={api} name="featureDesc" area />
          <p class="muted">{ui("hb.tablesHint")}</p>
          <Text api={api} name="personalityTraits" area />
          <Text api={api} name="ideals" area />
          <Text api={api} name="bonds" area />
          <Text api={api} name="flaws" area />
        </>
      );
  }
}

function Features({ api }: { api: FormApi }) {
  const rows = api.draft.traits;
  const update = api.setTraits;
  const patch = (i: number, change: Partial<DraftTrait>) =>
    update(rows.map((x, j) => (j === i ? { ...x, ...change } : x)));
  return (
    <fieldset class="hb-many">
      <legend>{label("features")}</legend>
      {rows.map((t, i) => (
        <div class="hb-trait" key={`feature-${i + 1}`}>
          <div class="hb-row">
            <label class="field">
              <span>{label("featureLevel")}</span>
              <input
                type="number"
                min={1}
                max={20}
                value={t.level ?? "1"}
                onInput={(e) => patch(i, { level: e.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>{label("featureName")}</span>
              <input
                type="text"
                value={t.name}
                onInput={(e) => patch(i, { name: e.currentTarget.value })}
              />
            </label>
          </div>
          <label class="field">
            <span>{label("featureDesc")}</span>
            <textarea
              rows={3}
              value={t.text}
              onInput={(e) => patch(i, { text: e.currentTarget.value })}
            />
          </label>
          <button
            type="button"
            class="danger"
            onClick={() => update(rows.filter((_, j) => j !== i))}
          >
            {ui("form.remove")}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => update([...rows, { name: "", text: "", level: "1" }])}>
        {label("addFeature")}
      </button>
    </fieldset>
  );
}

function Traits({ api }: { api: FormApi }) {
  const traits = api.draft.traits;
  const update = api.setTraits;
  return (
    <fieldset class="hb-many">
      <legend>{label("traits")}</legend>
      {traits.map((t, i) => (
        <div class="hb-trait" key={`trait-${i + 1}`}>
          <label class="field">
            <span>{label("traitName")}</span>
            <input
              type="text"
              value={t.name}
              onInput={(e) =>
                update(traits.map((x, j) => (j === i ? { ...x, name: e.currentTarget.value } : x)))
              }
            />
          </label>
          <label class="field">
            <span>{label("traitText")}</span>
            <textarea
              rows={3}
              value={t.text}
              onInput={(e) =>
                update(traits.map((x, j) => (j === i ? { ...x, text: e.currentTarget.value } : x)))
              }
            />
          </label>
          <button
            type="button"
            class="danger"
            onClick={() => update(traits.filter((_, j) => j !== i))}
          >
            {ui("form.remove")}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => update([...traits, { name: "", text: "" }])}>
        {label("addTrait")}
      </button>
    </fieldset>
  );
}

/** The fields of a spell, for writing one from the spells of a character. */
export function SpellFields({ api }: { api: FormApi }) {
  return (
    <>
      <Text api={api} name="name" />
      <Fields api={api} />
    </>
  );
}
function EntryForm({
  initial,
  editing,
  onDone,
}: {
  initial: Draft;
  editing?: string;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const api = {
    draft,
    set: (key: string, value: string) =>
      setDraft((d) => ({ ...d, values: { ...d.values, [key]: value } })),
    setTraits: (traits: DraftTrait[]) => setDraft((d) => ({ ...d, traits })),
  };
  const named = draftReady(draft);
  const save = async () => {
    if (!named || saving) return;
    setSaving(true);
    await saveHomebrewEntry(draft, editing);
    onDone();
  };
  return (
    <section class="hb-form">
      <h3>{kindName(draft.kind)}</h3>
      <Text api={api} name="name" />
      <Fields api={api} />
      {!named && (
        <p class="muted">{ui(draft.kind === "subclass" ? "hb.needClass" : "hb.needName")}</p>
      )}
      <div class="pack-actions">
        <button
          type="button"
          class="primary"
          disabled={!named || saving}
          onClick={() => void save()}
        >
          {ui("hb.save")}
        </button>
        <button type="button" onClick={onDone}>
          {ui("hb.cancel")}
        </button>
      </div>
    </section>
  );
}

/** What the page shows when no pack is open: the homebrew packs, to open, export or remove, and a way to add one. */
function PackList() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const packs = userPacks.value.filter((p) => p.origin === "homebrew");
  const error = packError.value;

  const remove = (record: (typeof packs)[number]) => {
    void removeUserPack(record.id).then(() =>
      offerUndo(ui("undo.packRemoved", { name: record.name }), () => addUserPack(record)),
    );
  };

  return (
    <article class="card packs">
      <button type="button" class="secondary" onClick={leavePage}>
        {ui("credits.back")}
      </button>
      <h2>{ui("hb.title")}</h2>
      <p>{ui("hb.intro")}</p>

      <h3>{ui("hb.packs")}</h3>
      {packs.length === 0 ? (
        <p class="muted">{ui("hb.noPacks")}</p>
      ) : (
        <ul class="plain pack-list">
          {packs.map((record) => (
            <li key={record.id} class="pack">
              <div>
                <b>{record.name}</b>
                <div class="muted">
                  {editableEntries(record).length} {ui("packs.entries")}
                </div>
              </div>
              <div class="pack-actions">
                <button type="button" class="primary" onClick={() => openHomebrewPack(record.id)}>
                  {ui("hb.edit")}
                </button>
                <button type="button" onClick={() => exportPack(record)}>
                  {ui("bar.export")}
                </button>
                <button type="button" class="danger" onClick={() => remove(record)}>
                  {ui("packs.remove")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3>{ui("hb.newPack")}</h3>
      <form
        class="pack-address"
        onSubmit={(e) => {
          e.preventDefault();
          void createHomebrewPack(name);
          setName("");
        }}
      >
        <input
          type="text"
          value={name}
          placeholder={ui("hb.packName")}
          aria-label={ui("hb.packName")}
          onInput={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit" class="primary">
          {ui("hb.create")}
        </button>
      </form>

      <div class="pack-actions">
        <button type="button" onClick={() => fileInput.current?.click()}>
          {ui("hb.addFile")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = "";
            if (file) void importPackFile(file);
          }}
        />
      </div>
      <p class="muted">{ui("hb.importHint")}</p>
      {(error === "exists" || error === "invalid") && (
        <p class="note" role="alert">
          {ui(error === "exists" ? "packs.exists" : "packs.invalid")}
        </p>
      )}
    </article>
  );
}

/** The homebrew page: the list of packs, and for the one that is open its entries and a form to make or change them. */
export function HomebrewPage() {
  // A copy of a rules entry waits here, to be saved as a new one.
  const [open, setOpen] = useState<{ draft: Draft; editing?: string } | undefined>(() => {
    const draft = takeWaitingDraft();
    return draft && { draft };
  });
  const [kind, setKind] = useState<HomebrewKind>("spell");
  const record = editingPack();
  if (!record) return <PackList />;
  const entries = editableEntries(record);
  const edit = (id: string) => {
    const entry = record.pack.entries.find((e) => e.id === id);
    const draft = entry && draftFromEntry(entry, record.strings, record.pack.entries);
    if (draft) setOpen({ draft, editing: id });
  };
  const remove = (id: string) => {
    const name = record.strings[`${id}.name`] ?? id;
    void deleteHomebrewEntry(id).then(() =>
      offerUndo(ui("undo.deleted", { name }), () => addUserPack(record)),
    );
  };

  return (
    <article class="card packs">
      <button type="button" class="secondary" onClick={closeHomebrewPack}>
        {ui("credits.back")}
      </button>
      <h2>{ui("hb.title")}</h2>
      <p>{ui("hb.intro")}</p>
      <label class="field">
        <span>{ui("hb.packName")}</span>
        <input
          type="text"
          value={record.name}
          onBlur={(e) => void renameHomebrewPack(e.currentTarget.value)}
        />
      </label>
      <div class="pack-actions">
        <button type="button" onClick={() => exportPack(record)}>
          {ui("bar.export")}
        </button>
      </div>

      <h3>{ui("hb.entries")}</h3>
      {entries.length === 0 ? (
        <p class="muted">{ui("hb.none")}</p>
      ) : (
        <ul class="plain pack-list">
          {entries.map((entry) => {
            const draft = draftFromEntry(entry, record.strings, record.pack.entries);
            return (
              <li key={entry.id} class="pack">
                <div>
                  <b>{record.strings[`${entry.id}.name`] ?? entry.id}</b>
                  {draft && <span class="pack-tag">{kindName(draft.kind)}</span>}
                </div>
                <div class="pack-actions">
                  <button type="button" onClick={() => edit(entry.id)}>
                    {ui("hb.edit")}
                  </button>
                  <button type="button" class="danger" onClick={() => remove(entry.id)}>
                    {ui("packs.remove")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <EntryForm
          key={open.editing ?? "new"}
          initial={open.draft}
          editing={open.editing}
          onDone={() => setOpen(undefined)}
        />
      ) : (
        <>
          <h3>{ui("hb.add")}</h3>
          <div class="pack-address">
            <select value={kind} onChange={(e) => setKind(e.currentTarget.value as HomebrewKind)}>
              {HOMEBREW_KINDS.map((k) => (
                <option key={k} value={k}>
                  {kindName(k)}
                </option>
              ))}
            </select>
            <button
              type="button"
              class="primary"
              onClick={() => setOpen({ draft: blankDraft(kind) })}
            >
              {ui("hb.new")}
            </button>
          </div>
        </>
      )}
    </article>
  );
}
