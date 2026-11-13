import { describe, expect, it } from "vitest";
import { DENSITY_LEVELS, SPILL_STEPS, fitFront } from "./fitFront";

/**
 * A front whose columns spill over until there is room enough: each density level is one step of
 * room and each panel that has gone is `DENSITY_LEVELS + 1` more, so `need` is the room it takes.
 */
function fakePage(need: number) {
  const page = { dataset: {} as Record<string, string>, style: { height: "" } };
  const column = {
    get scrollHeight() {
      const room = Number(page.dataset.density) + Number(page.dataset.spill) * (DENSITY_LEVELS + 1);
      return room >= need ? 100 : 130;
    },
    clientHeight: 100,
  };
  return Object.assign(page, { querySelectorAll: () => [column] }) as unknown as HTMLElement;
}

describe("fitting the front page on one page", () => {
  it("stays at the usual size when everything fits", () => {
    const page = fakePage(0);
    expect(fitFront(page)).toEqual({ density: 0, spill: 0 });
    expect(page.dataset.density).toBe("0");
  });

  it("gets denser, one level at a time, until the columns fit", () => {
    expect(fitFront(fakePage(1))).toEqual({ density: 1, spill: 0 });
    expect(fitFront(fakePage(2))).toEqual({ density: 2, spill: 0 });
  });

  it("sends a panel to the next page when the densest is not enough", () => {
    expect(fitFront(fakePage(DENSITY_LEVELS + 1))).toEqual({ density: 0, spill: 1 });
    expect(fitFront(fakePage(2 * (DENSITY_LEVELS + 1) + 2))).toEqual({ density: 2, spill: 2 });
  });

  it("gives up at the densest and the last panel when nothing is enough", () => {
    const page = fakePage(999);
    expect(fitFront(page)).toEqual({ density: DENSITY_LEVELS, spill: SPILL_STEPS });
    expect(page.dataset.density).toBe(String(DENSITY_LEVELS));
  });
});
