// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { DATA_FIELDS } from "../../homebrew/catalog";
import { WIZARD_KINDS } from "./Wizard";
import { NEW_KINDS } from "./newKinds";

describe("the step-by-step guide", () => {
  it("is offered only for kinds the new menu can start", () => {
    for (const id of WIZARD_KINDS) expect(NEW_KINDS.some((k) => k.id === id)).toBe(true);
  });

  it("asks about fields that exist in the catalog", () => {
    const asked: [string, string[]][] = [
      ["species", ["size", "speed"]],
      ["item", ["weapon", "armor", "cost", "weight", "rarity", "attunement", "slot"]],
      ["feat", ["category", "prerequisites"]],
    ];
    for (const [kind, keys] of asked) {
      const known = DATA_FIELDS[kind as keyof typeof DATA_FIELDS].map((s) => s.key);
      for (const key of keys) expect(known, `${kind}.${key}`).toContain(key);
    }
  });
});
