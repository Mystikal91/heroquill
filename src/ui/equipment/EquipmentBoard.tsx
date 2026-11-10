import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import { canCustomize } from "../../app/customizeItem";
import { putOn, takeOff } from "../../app/equipment";
import { useItem } from "../../app/play";
import { character, content, sheet, updateCharacter } from "../../app/store";
import { itemData } from "../../data/items";
import type { InventoryItem } from "../../engine/character";
import { healingOf, isUsable, itemKind } from "../../engine/gear";
import {
  BOARD_SLOTS,
  type BoardSlot,
  candidatesFor,
  itemSlot,
  placeEquipment,
  visibleSlots,
} from "../../engine/slots";
import { type UiKey, ui } from "../../i18n/ui";
import { weight } from "../../i18n/units";
import { CustomizeButton } from "../ItemCustomize";
import { AddItemButton } from "../ItemPicker";
import { itemFacts, itemTag } from "../ItemTag";
import { ruleDetail } from "../rules/EntryDetail";
import { useHoldRepeat } from "../useHoldRepeat";
import { SlotIcon } from "./slotIcons";

type Mode = "sheet" | "play";

/** The place of the board that is being chosen for, or nothing. */
const picking = signal<BoardSlot | undefined>(undefined);

const slotName = (slot: BoardSlot) => ui(`equip.slot.${slot}` as UiKey);

/** The name of an item of the inventory. */
function nameOf(item: InventoryItem): string {
  return item.custom?.name ?? content.value?.name(item.itemId) ?? item.itemId;
}

/** What an item is, in a few words: its numbers, how rare it is and whether it asks for attunement. */
function detailOf(item: InventoryItem, withTag = false): string {
  const c = content.value;
  const entry = c?.index.get(item.itemId);
  if (!c || !entry) return item.custom?.note ?? "";
  const parts: string[] = [];
  const tag = withTag ? itemTag(item.itemId) : undefined;
  if (tag) parts.push(tag);
  const facts = itemFacts(item.itemId);
  if (facts) parts.push(facts);
  try {
    const data = itemData(entry);
    if (data.rarity) parts.push(ui(`equip.rarity.${data.rarity}` as UiKey));
    if (entry.data.attunement === true) parts.push(ui("equip.attune"));
  } catch {
    // An item the engine cannot read has no more to say.
  }
  return parts.join(" · ");
}

/** One place of the board: what is in it, or that it is free, and a tap to choose. */
function Tile({
  slot,
  item,
  blockedBy,
  fits,
}: {
  slot: BoardSlot;
  item: InventoryItem | undefined;
  blockedBy: InventoryItem | undefined;
  fits: number;
}) {
  const state = item ? "on" : blockedBy ? "blocked" : "empty";
  const name = item ? nameOf(item) : undefined;
  return (
    <li>
      <button
        type="button"
        class="equip-tile"
        data-slot={slot}
        data-state={state}
        data-fits={fits > 0 && !item ? "" : undefined}
        aria-label={`${slotName(slot)}: ${name ?? (blockedBy ? ui("equip.twoHands", { name: nameOf(blockedBy) }) : ui("equip.free"))}`}
        onClick={() => {
          picking.value = slot;
        }}
      >
        <span class="equip-icon" aria-hidden="true">
          <SlotIcon slot={slot} />
        </span>
        <span class="equip-text">
          <span class="equip-slot">{slotName(slot)}</span>
          <b class="equip-name">
            {name ??
              (blockedBy ? ui("equip.twoHands", { name: nameOf(blockedBy) }) : ui("equip.free"))}
          </b>
          {item && <span class="equip-detail">{detailOf(item)}</span>}
        </span>
        {!item && fits > 0 && <span class="equip-hint">+{fits}</span>}
      </button>
    </li>
  );
}

/** The question of what goes in a place: what the character carries that fits, and a way to take it off. */
function SlotPicker() {
  const dialog = useRef<HTMLDialogElement>(null);
  const slot = picking.value;
  const ch = character.value;
  const c = content.value;
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (slot && !el.open) el.showModal();
    if (!slot && el.open) el.close();
  }, [slot]);
  const close = () => {
    picking.value = undefined;
  };
  const placement = c ? placeEquipment(ch.inventory, c.index) : undefined;
  const held = slot ? placement?.slots[slot] : undefined;
  const candidates = slot && c ? candidatesFor(slot, ch.inventory, c.index) : [];

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; Escape and the buttons are the keyboard ways out
    <dialog
      ref={dialog}
      class="spell-dialog equip-dialog"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {slot && (
        <div class="spell-dialog-body">
          <div class="equip-dialog-head">
            <span class="equip-icon" aria-hidden="true">
              <SlotIcon slot={slot} />
            </span>
            <h3>{slotName(slot)}</h3>
          </div>
          {held && (
            <div class="equip-choice" data-state="on">
              <div>
                <b>{nameOf(held)}</b>
                <span class="equip-detail">{detailOf(held)}</span>
              </div>
              <button
                type="button"
                class="card-btn"
                onClick={() => {
                  takeOff(held.itemId);
                  close();
                }}
              >
                {ui("equip.takeOff")}
              </button>
            </div>
          )}
          {candidates.length === 0 && !held && <p class="muted">{ui("equip.nothing")}</p>}
          <ul class="plain equip-choices">
            {candidates.map((item) => (
              <li key={item.itemId} class="equip-choice">
                <div>
                  <b>{nameOf(item)}</b>
                  <span class="equip-detail">{detailOf(item)}</span>
                </div>
                <button
                  type="button"
                  class="card-btn card-primary"
                  onClick={() => {
                    putOn(item.itemId, slot);
                    close();
                  }}
                >
                  {ui("equip.put")}
                </button>
              </li>
            ))}
          </ul>
          <div class="card-actions">
            <button type="button" class="card-btn" onClick={close}>
              {ui("equip.close")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** One thing in the backpack: its name opens its details; a button puts it on or uses it up. */
function PackRow({ item, mode }: { item: InventoryItem; mode: Mode }) {
  const hold = useHoldRepeat();
  const c = content.value;
  if (!c) return null;
  const entry = c.index.get(item.itemId);
  const kind = item.custom || !entry ? "custom" : itemKind(entry);
  const name = nameOf(item);
  const detail = detailOf(item, true);
  const wearable =
    !item.custom &&
    Boolean(entry) &&
    // A thing with a place on the body, or a magic item that gives something while it is worn.
    (itemSlot(entry) !== undefined ||
      (kind === "magic" && !healingOf(entry) && (entry?.effects.length ?? 0) > 0));
  const change = (apply: (found: InventoryItem) => void) =>
    updateCharacter((d) => {
      const found = d.inventory.find((i) => i.itemId === item.itemId);
      if (found) apply(found);
    });

  return (
    <li class="equip-pack-row">
      {entry ? (
        <button
          type="button"
          class="link equip-pack-name"
          aria-label={`${ui("inv.info")}: ${name}`}
          onClick={() => {
            ruleDetail.value = item.itemId;
          }}
        >
          {name}
        </button>
      ) : (
        <span class="equip-pack-name">{name}</span>
      )}
      <span class="equip-pack-buttons">
        {wearable && (
          <button type="button" class="card-btn" onClick={() => putOn(item.itemId)}>
            {ui("equip.put")}
          </button>
        )}
        {mode === "play" && isUsable(kind) && itemSlot(entry) === undefined && (
          <button
            type="button"
            class="card-btn card-primary"
            aria-label={ui("play.useItem", { name })}
            onClick={() => useItem(item.itemId)}
          >
            {ui("play.use")}
          </button>
        )}
      </span>
      <span class="equip-detail equip-pack-detail">{detail}</span>
      {mode === "sheet" ? (
        <span class="qty">
          <button
            type="button"
            class="hold"
            aria-label={ui("inv.fewer", { name })}
            disabled={item.quantity <= 1}
            {...hold(() =>
              change((found) => {
                found.quantity = Math.max(1, found.quantity - 1);
              }),
            )}
          >
            −
          </button>
          <output aria-label={ui("inv.quantity", { name })}>{item.quantity}</output>
          <button
            type="button"
            class="hold"
            aria-label={ui("inv.more", { name })}
            {...hold(() =>
              change((found) => {
                found.quantity += 1;
              }),
            )}
          >
            +
          </button>
        </span>
      ) : (
        item.quantity > 1 && <b class="play-item-qty">×{item.quantity}</b>
      )}
    </li>
  );
}

/**
 * What the character wears, holds and carries: a tile for each place of the body (what is in it,
 * or that it is free), a tap to choose what goes there, and the backpack below. The places that
 * nothing could fill stay hidden until they are wanted.
 */
export function EquipmentBoard({ mode }: { mode: Mode }) {
  const [showAll, setShowAll] = useState(false);
  const c = content.value;
  const s = sheet.value;
  const ch = character.value;
  if (!c) return null;
  const placement = placeEquipment(ch.inventory, c.index);
  const fitsCount = (slot: BoardSlot) => candidatesFor(slot, ch.inventory, c.index).length;
  const shown = visibleSlots(ch.inventory, c.index, showAll);
  const hidden = BOARD_SLOTS.length - shown.length;
  const pack = ch.inventory.filter((i) => !i.equipped);
  const attunement = s?.attunement;
  // The weapons and armor can be changed on the Sheet: a button opens the window of the item.
  const customizable = mode === "sheet" ? ch.inventory.filter((i) => canCustomize(i.itemId)) : [];

  return (
    <div class="equipment" data-mode={mode}>
      <div class="equip-head">
        {s && (
          <span class="equip-load">
            {ui("sheet.load", {
              carried: weight(s.load.carried),
              capacity: weight(s.load.capacity),
            })}
          </span>
        )}
        {attunement && attunement.used > 0 && (
          <span class="equip-attune" data-over={attunement.used > attunement.max ? "" : undefined}>
            {ui("equip.attunement", { used: attunement.used, max: attunement.max })}
          </span>
        )}
      </div>

      <ul class="plain equip-board">
        {shown.map((slot) => (
          <Tile
            key={slot}
            slot={slot}
            item={placement.slots[slot]}
            blockedBy={
              slot === "offHand" && placement.offHandTaken ? placement.slots.mainHand : undefined
            }
            fits={fitsCount(slot)}
          />
        ))}
      </ul>
      {(hidden > 0 || showAll) && (
        <button type="button" class="link equip-toggle" onClick={() => setShowAll(!showAll)}>
          {ui(showAll ? "equip.usedSlots" : "equip.allSlots")}
        </button>
      )}

      {placement.elsewhere.length > 0 && (
        <section class="equip-extra">
          <h5>{ui("equip.elsewhere")}</h5>
          <ul class="plain">
            {placement.elsewhere.map((item) => (
              <li key={item.itemId} class="equip-pack-row">
                <div class="equip-pack-main">
                  <span class="equip-pack-name">{nameOf(item)}</span>
                  <span class="equip-detail">{detailOf(item)}</span>
                </div>
                <button type="button" class="card-btn" onClick={() => takeOff(item.itemId)}>
                  {ui("equip.takeOff")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {placement.crowded.length > 0 && (
        <section class="equip-extra" data-warn="">
          <h5>{ui("equip.crowded")}</h5>
          <ul class="plain">
            {placement.crowded.map((item) => (
              <li key={item.itemId} class="equip-pack-row">
                <div class="equip-pack-main">
                  <span class="equip-pack-name">{nameOf(item)}</span>
                </div>
                <button type="button" class="card-btn" onClick={() => takeOff(item.itemId)}>
                  {ui("equip.takeOff")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="equip-extra">
        <div class="equip-backpack-head">
          <h5>{ui("equip.backpack")}</h5>
          <AddItemButton primary />
        </div>
        {pack.length === 0 ? (
          <p class="muted">{ui("equip.empty")}</p>
        ) : (
          <ul class="plain equip-pack">
            {pack.map((item) => (
              <PackRow key={item.itemId} item={item} mode={mode} />
            ))}
          </ul>
        )}
      </section>

      {customizable.length > 0 && (
        <section class="equip-extra">
          <h5>{ui("item.customize.list")}</h5>
          <ul class="plain">
            {customizable.map((item) => (
              <li key={item.itemId} class="equip-pack-row">
                <div class="equip-pack-main">
                  <span class="equip-pack-name">{nameOf(item)}</span>
                </div>
                <CustomizeButton item={item} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <SlotPicker />
    </div>
  );
}
