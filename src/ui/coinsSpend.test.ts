// @vitest-environment happy-dom
import { h, render } from "preact";
import { describe, expect, it } from "vitest";
import { character } from "../app/store";
import { CLASSES, build, complete } from "../test/characters";
import { Coins } from "./Coins";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

async function drawn() {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(h(Coins as never, {}), host);
  await tick();
  return {
    host,
    done: () => {
      render(null, host);
      host.remove();
    },
  };
}

async function typeAmount(host: HTMLElement, text: string) {
  const input = host.querySelector<HTMLInputElement>(".coin-spend-amount");
  if (!input) throw new Error("no amount field");
  input.value = text;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
}

const buttons = (host: HTMLElement) => {
  const all = [...host.querySelectorAll<HTMLButtonElement>(".coin-spend button")];
  return { spend: all[0], gain: all[1] };
};

describe("spending and gaining coins", () => {
  it("spends 15 gp from 2 pp and gives 5 gp back", async () => {
    character.value = {
      ...complete(build(CLASSES[0] ?? "fighter", 1, "human")),
      coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 2 },
    };
    const { host, done } = await drawn();
    await typeAmount(host, "15");
    const { spend } = buttons(host);
    expect(spend?.disabled).toBe(false);
    spend?.click();
    await tick();
    expect(character.value.coins).toEqual({ cp: 0, sp: 0, ep: 0, gp: 5, pp: 0 });
    done();
  });

  it("does not let you spend more than you have", async () => {
    character.value = {
      ...complete(build(CLASSES[0] ?? "fighter", 1, "human")),
      coins: { cp: 0, sp: 0, ep: 0, gp: 14, pp: 0 },
    };
    const { host, done } = await drawn();
    await typeAmount(host, "15");
    expect(buttons(host).spend?.disabled).toBe(true);
    await typeAmount(host, "14");
    expect(buttons(host).spend?.disabled).toBe(false);
    await typeAmount(host, "");
    expect(buttons(host).spend?.disabled).toBe(true);
    expect(buttons(host).gain?.disabled).toBe(true);
    done();
  });

  it("gains coins as they are", async () => {
    character.value = {
      ...complete(build(CLASSES[0] ?? "fighter", 1, "human")),
      coins: { cp: 0, sp: 3, ep: 0, gp: 1, pp: 0 },
    };
    const { host, done } = await drawn();
    await typeAmount(host, "150");
    const select = host.querySelector<HTMLSelectElement>(".coin-spend-unit");
    if (select) {
      select.value = "sp";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await tick();
    buttons(host).gain?.click();
    await tick();
    expect(character.value.coins).toEqual({ cp: 0, sp: 153, ep: 0, gp: 1, pp: 0 });
    done();
  });
});
