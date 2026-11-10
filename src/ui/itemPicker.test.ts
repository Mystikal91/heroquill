// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character, content } from "../app/store";
import { loadContent } from "../content/browser";
import { CLASSES, build, complete } from "../test/characters";
import { ItemPickerDialog, itemPickerOpen } from "./ItemPicker";
import { ruleDetail } from "./rules/EntryDetail";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function opened() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(h(ItemPickerDialog as never, {}), host);
  await tick();
  itemPickerOpen.value = true;
  await tick();
  return {
    host,
    done: () => {
      itemPickerOpen.value = false;
      render(null, host);
      host.remove();
    },
  };
}

async function type(host: HTMLElement, text: string) {
  const input = host.querySelector<HTMLInputElement>("input[type=search]");
  if (!input) throw new Error("no search field");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

describe("the window to add items", () => {
  it("adds two potions with a search and a tap on the plus, without closing", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    const before = character.value.inventory.length;
    const { host, done } = await opened();
    await type(host, "potion of healing");
    const add = host.querySelector<HTMLButtonElement>("button.picker-add");
    expect(add).not.toBeNull();
    add?.click();
    await tick();
    add?.click();
    await tick();
    const added = character.value.inventory.filter((i) => i.itemId.includes("potion-of-healing"));
    expect(added.reduce((n, i) => n + i.quantity, 0)).toBe(2);
    expect(character.value.inventory.length).toBe(before + added.length);
    // The window is still open, and the minus takes one back.
    expect(itemPickerOpen.value).toBe(true);
    host.querySelector<HTMLButtonElement>("button.picker-step")?.click();
    await tick();
    expect(
      character.value.inventory
        .filter((i) => i.itemId.includes("potion-of-healing"))
        .reduce((n, i) => n + i.quantity, 0),
    ).toBe(1);
    done();
  });

  it("adds the count that was typed, with Enter", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    const { host, done } = await opened();
    await type(host, "3 torch");
    const input = host.querySelector<HTMLInputElement>("input[type=search]");
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await tick();
    const torches = character.value.inventory.filter((i) => i.itemId.endsWith("/torch"));
    expect(torches).toHaveLength(1);
    expect(torches[0]?.quantity).toBeGreaterThanOrEqual(3);
    done();
  });

  it("shows the price and buys only with enough coins, giving change", async () => {
    content.value = await loadContent(["en"]);
    const base = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    character.value = { ...base, coins: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 } };
    const { host, done } = await opened();
    await type(host, "longsword");
    const buy = host.querySelector<HTMLButtonElement>("button.picker-buy");
    expect(buy).not.toBeNull();
    expect(host.querySelector(".picker-price")?.textContent).toContain("15");
    // Ten gold do not pay 15.
    expect(buy?.disabled).toBe(true);
    character.value = { ...base, coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 2 } };
    await tick();
    const ready = host.querySelector<HTMLButtonElement>("button.picker-buy");
    expect(ready?.disabled).toBe(false);
    ready?.click();
    await tick();
    expect(character.value.coins).toEqual({ cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 });
    expect(character.value.inventory.some((i) => i.itemId.endsWith("/longsword"))).toBe(true);
    // The undo of the window gives the coins and the item back.
    host.querySelector<HTMLButtonElement>(".picker-said button.link")?.click();
    await tick();
    expect(character.value.coins?.pp).toBe(2);
    expect(character.value.inventory.length).toBe(base.inventory.length);
    done();
  });

  it("has no price and no Buy for what the book does not price", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    const { host, done } = await opened();
    await type(host, "potion of healing");
    const rows = [...host.querySelectorAll<HTMLElement>(".picker-row")];
    const row = (name: string) =>
      rows.find((r) => r.querySelector(".picker-link")?.textContent === name);
    // The SRD prices the potion of healing (50 gp, page 69) and no other magic item.
    expect(row("Potion of Healing")?.querySelector(".picker-price")?.textContent).toContain("50");
    expect(row("Potion of Healing")?.querySelector("button.picker-buy")).not.toBeNull();
    const greater = row("Potion of Greater Healing");
    expect(greater).toBeDefined();
    expect(greater?.querySelector("button.picker-add")).not.toBeNull();
    expect(greater?.querySelector("button.picker-buy")).toBeNull();
    expect(greater?.querySelector(".picker-price")).toBeNull();
    done();
  });

  it("says what a potion heals, and the name and the i open the details", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    const { host, done } = await opened();
    await type(host, "potion of superior healing");
    const row = host.querySelector<HTMLElement>(".picker-row");
    expect(row?.querySelector(".picker-heal")?.textContent).toBe("Heals 8d4 + 8");
    // The name opens the rules of the item...
    row?.querySelector<HTMLButtonElement>("button.picker-link")?.click();
    expect(ruleDetail.value).toBe("srd51:item/potion-of-healing-superior");
    ruleDetail.value = undefined;
    // ...and so does the small i, without adding anything.
    const before = character.value.inventory.length;
    row?.querySelector<HTMLButtonElement>("button.info-btn")?.click();
    expect(ruleDetail.value).toBe("srd51:item/potion-of-healing-superior");
    expect(character.value.inventory.length).toBe(before);
    ruleDetail.value = undefined;
    // A thing that does not heal says nothing about it.
    await type(host, "torch");
    expect(host.querySelector(".picker-heal")).toBeNull();
    done();
  });

  it("offers what the rules do not list as an item of your own", async () => {
    content.value = await loadContent(["en"]);
    character.value = complete(build(CLASSES[0] ?? "fighter", 3, "human"));
    const { host, done } = await opened();
    await type(host, "2 zzqx charm");
    expect(host.querySelector("button.picker-add")).toBeNull();
    host.querySelector<HTMLButtonElement>("button.picker-free")?.click();
    await tick();
    const mine = character.value.inventory.find((i) => i.custom?.name === "Zzqx charm");
    expect(mine?.quantity).toBe(2);
    done();
  });
});
