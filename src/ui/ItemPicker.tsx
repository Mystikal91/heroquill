import { signal } from "@preact/signals";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { addFreeItem, addItem, removeSome } from "../app/addItems";
import { isHomebrewId } from "../app/homebrew";
import { recentItems } from "../app/recentItems";
import { character, content, sheet } from "../app/store";
import { itemData } from "../data/items";
import { proficiencyKeys } from "../engine/equipment";
import { itemKind, packContents } from "../engine/gear";
import {
  ITEM_FILTERS,
  type ItemFilter,
  type ItemOption,
  freeItemName,
  searchItems,
  splitQuantity,
} from "../engine/itemSearch";
import { type UiKey, ui } from "../i18n/ui";
import { itemFacts, itemTag } from "./ItemTag";

/** Whether the window to add things is open. */
export const itemPickerOpen = signal(false);

export function openItemPicker() {
  itemPickerOpen.value = true;
}

/** How many results are drawn before "Show more": a list of hundreds is slow to draw and to scroll. */
const PAGE = 60;

/** One row: the name with what the item is, and the buttons that add it. */
function Row({
  option,
  have,
  base,
  amount,
  onAdd,
}: {
  option: ItemOption;
  have: number;
  base: number;
  amount: number;
  onAdd: (id: string, amount: number) => void;
}) {
  const c = content.value;
  const entry = c?.index.get(option.id);
  const tag = itemTag(option.id);
  const facts = itemFacts(option.id);
  let rarity: string | undefined;
  try {
    const data = entry ? itemData(entry) : undefined;
    rarity = data?.rarity ? ui(`equip.rarity.${data.rarity}` as UiKey) : undefined;
  } catch {
    rarity = undefined;
  }
  const isPack = entry ? packContents(entry).length > 0 : false;
  const meta = [tag, facts, rarity].filter(Boolean).join(" · ");
  const added = have - base;
  return (
    <li class="picker-row" data-added={added > 0 ? "" : undefined}>
      <div class="picker-name">
        <b>{option.name}</b>
        {meta && <span class="picker-meta">{meta}</span>}
        {isPack && <span class="picker-meta">{ui("picker.pack")}</span>}
      </div>
      <span class="picker-buttons">
        {!isPack && added > 0 && (
          <>
            <button
              type="button"
              class="card-btn picker-step"
              aria-label={ui("picker.fewer", { name: option.name })}
              onClick={() => removeSome(option.id, 1)}
            >
              −
            </button>
            <output class="picker-count" aria-label={ui("inv.quantity", { name: option.name })}>
              {have}
            </output>
          </>
        )}
        <button
          type="button"
          class="card-btn card-primary picker-add"
          aria-label={ui("picker.add", { name: option.name })}
          onClick={() => onAdd(option.id, amount)}
        >
          {amount > 1 ? `+${amount}` : "+"}
        </button>
      </span>
    </li>
  );
}

/**
 * The window to add things to the inventory, from the Create screen, the Sheet and Play: search
 * as you type, a chip for each sort of thing, the last things added on top, and a button that
 * keeps adding without closing. "2 potions" adds two; what the rules do not list can be added as
 * a free item from the same field.
 */
export function ItemPickerDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const open = itemPickerOpen.value;
  const [typed, setTyped] = useState("");
  const [filter, setFilter] = useState<ItemFilter>("all");
  const [onlyProficient, setOnlyProficient] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [said, setSaid] = useState("");
  /** What the character carried when the window opened: the minus button only takes back what was added since. */
  const base = useRef(new Map<string, number>());
  const c = content.value;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      base.current = new Map(character.value.inventory.map((i) => [i.itemId, i.quantity]));
      setSaid("");
      el.showModal();
      field.current?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);

  const close = () => {
    itemPickerOpen.value = false;
    setTyped("");
    setFilter("all");
    setLimit(PAGE);
  };

  const options = useMemo<ItemOption[]>(() => {
    if (!c) return [];
    return [...c.index.values()]
      .filter((e) => e.kind === "item")
      .filter((e) => e.id.startsWith("srd51:") || !/^srd\d+:/.test(e.id))
      .flatMap((e) => {
        const kind = itemKind(e);
        return kind === "enchantment"
          ? []
          : [{ id: e.id, name: c.name(e.id), kind, homebrew: isHomebrewId(e.id) }];
      });
  }, [c]);

  const held = sheet.value ? proficiencyKeys(sheet.value.proficiencies) : undefined;
  const proficientIn = (o: ItemOption) => {
    if (!onlyProficient || !held) return true;
    const entry = c?.index.get(o.id);
    if (!entry) return true;
    try {
      const data = itemData(entry);
      const keys = (data.armor ?? data.weapon)?.proficiency;
      return keys === undefined || keys.some((k) => held.has(k));
    } catch {
      return true;
    }
  };

  const { quantity, name: query } = splitQuantity(typed);
  const found = searchItems(options, query, filter).filter(proficientIn);
  // With nothing typed the last things added come first.
  const recent = typed.trim()
    ? []
    : recentItems.value.flatMap((id) => {
        const hit = found.find((o) => o.id === id);
        return hit ? [hit] : [];
      });
  const rest = recent.length ? found.filter((o) => !recent.includes(o)) : found;
  const shownRest = rest.slice(0, limit);
  const freeName = freeItemName(query);
  const inventory = character.value.inventory;
  const have = (id: string) => inventory.find((i) => i.itemId === id)?.quantity ?? 0;

  const add = (id: string, amount: number) => {
    addItem(id, amount);
    const name = c?.name(id) ?? id;
    setSaid(ui("picker.added", { name, count: amount }));
  };
  const addFree = () => {
    if (!freeName) return;
    addFreeItem(freeName, quantity);
    setSaid(ui("picker.added", { name: freeName, count: quantity }));
    setTyped("");
    field.current?.focus();
  };

  const rows = (list: ItemOption[]) =>
    list.map((o) => (
      <Row
        key={o.id}
        option={o}
        have={have(o.id)}
        base={base.current.get(o.id) ?? 0}
        amount={quantity}
        onAdd={add}
      />
    ));

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the Done button are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog picker-dialog"
      aria-labelledby="picker-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {open && (
        <div class="spell-dialog-body picker">
          <div class="picker-top">
            <h3 id="picker-title">{ui("picker.title")}</h3>
            <button type="button" class="card-btn card-primary" onClick={close}>
              {ui("picker.done")}
            </button>
          </div>
          <input
            ref={field}
            type="search"
            class="picker-search"
            value={typed}
            placeholder={ui("picker.placeholder")}
            aria-label={ui("form.searchItems")}
            autocomplete="off"
            enterkeyhint="done"
            onInput={(e) => {
              setTyped(e.currentTarget.value);
              setLimit(PAGE);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const first = recent[0] ?? shownRest[0];
              if (first) {
                add(first.id, quantity);
                setTyped("");
              } else addFree();
            }}
          />
          <fieldset class="picker-chips" aria-label={ui("picker.filters")}>
            {ITEM_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                class="picker-chip"
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  setLimit(PAGE);
                }}
              >
                {ui(`picker.filter.${f}` as UiKey)}
              </button>
            ))}
          </fieldset>
          {(filter === "all" || filter === "weapon" || filter === "armor") && (
            <label class="check picker-proficient">
              <input
                type="checkbox"
                checked={onlyProficient}
                onChange={(e) => setOnlyProficient(e.currentTarget.checked)}
              />
              <span>{ui("form.onlyProficient")}</span>
            </label>
          )}
          <output class="picker-said muted">
            {said || (typed.trim() ? "" : ui("picker.hint"))}
          </output>

          {recent.length > 0 && (
            <section>
              <h5 class="card-group-head">{ui("picker.recent")}</h5>
              <ul class="plain picker-list">{rows(recent)}</ul>
            </section>
          )}
          {shownRest.length > 0 && (
            <section>
              {recent.length > 0 && <h5 class="card-group-head">{ui("picker.all")}</h5>}
              <ul class="plain picker-list">{rows(shownRest)}</ul>
              {rest.length > shownRest.length && (
                <button type="button" class="link" onClick={() => setLimit(limit + PAGE)}>
                  {ui("picker.more", { n: rest.length - shownRest.length })}
                </button>
              )}
            </section>
          )}
          {found.length === 0 && <p class="muted">{ui("picker.none")}</p>}
          {freeName && (
            <button type="button" class="card-btn picker-free" onClick={addFree}>
              {quantity > 1
                ? ui("picker.free.many", { name: freeName, count: quantity })
                : ui("picker.free", { name: freeName })}
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}

/** The button that opens the window. */
export function AddItemButton({ primary = false }: { primary?: boolean }) {
  return (
    <button
      type="button"
      class={primary ? "card-btn card-primary add-item-btn" : "card-btn add-item-btn"}
      onClick={openItemPicker}
    >
      {ui("picker.open")}
    </button>
  );
}
