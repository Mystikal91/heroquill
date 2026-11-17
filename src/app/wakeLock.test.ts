import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** A screen lock like the browser's: it can be let go by the browser, which tells the page. */
function sentinel() {
  const listeners: (() => void)[] = [];
  return {
    release: vi.fn(async () => undefined),
    addEventListener: (_type: "release", listener: () => void) => listeners.push(listener),
    letGo: () => {
      for (const listener of listeners) listener();
    },
  };
}

describe("keeping the screen on", () => {
  let locks: ReturnType<typeof sentinel>[];
  let visible: (() => void) | undefined;
  let state: "visible" | "hidden";

  beforeEach(() => {
    vi.resetModules();
    locks = [];
    state = "visible";
    visible = undefined;
    vi.stubGlobal("navigator", {
      wakeLock: {
        request: vi.fn(async () => {
          const next = sentinel();
          locks.push(next);
          return next;
        }),
      },
    });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => undefined });
    vi.stubGlobal("document", {
      addEventListener: (_type: string, listener: () => void) => {
        visible = listener;
      },
      get visibilityState() {
        return state;
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks for the lock again after the browser let it go when the page was hidden", async () => {
    const { setKeepAwake, startKeepingAwake } = await import("./wakeLock");
    startKeepingAwake();
    await setKeepAwake(true);
    expect(locks).toHaveLength(1);

    // The page goes to the background: the browser lets the lock go. Then it comes back.
    state = "hidden";
    locks[0]?.letGo();
    state = "visible";
    visible?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(locks).toHaveLength(2);
  });

  it("does not ask twice while it holds one", async () => {
    const { setKeepAwake, startKeepingAwake } = await import("./wakeLock");
    startKeepingAwake();
    await setKeepAwake(true);
    visible?.();
    await Promise.resolve();
    expect(locks).toHaveLength(1);
  });

  it("lets it go when switched off", async () => {
    const { setKeepAwake } = await import("./wakeLock");
    await setKeepAwake(true);
    await setKeepAwake(false);
    expect(locks[0]?.release).toHaveBeenCalled();
  });
});
