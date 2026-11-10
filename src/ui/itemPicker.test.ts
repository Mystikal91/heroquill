// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character, content } from "../app/store";
import { loadContent } from "../content/browser";
import { CLASSES, build, complete } from "../test/characters";
import { ItemPickerDialog, itemPickerOpen } from "./ItemPicker";

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
