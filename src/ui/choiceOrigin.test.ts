import { describe, expect, it } from "vitest";
import { choiceOrigin } from "./choiceOrigin";

const index = new Map<string, { kind: string; parent?: string }>([
  ["p:species/elf", { kind: "species" }],
  ["p:trait/keen-senses", { kind: "trait", parent: "p:species/elf" }],
  ["p:background/sage", { kind: "background" }],
  ["p:class/fighter", { kind: "class" }],
  ["p:subclass/champion", { kind: "subclass", parent: "p:class/fighter" }],
  ["p:feature/style", { kind: "feature", parent: "p:class/fighter" }],
  ["p:feature/champion-style", { kind: "feature", parent: "p:subclass/champion" }],
  ["p:feat/alert", { kind: "feat" }],
  ["p:trait/a", { kind: "trait", parent: "p:trait/b" }],
  ["p:trait/b", { kind: "trait", parent: "p:trait/a" }],
]);

describe("choiceOrigin", () => {
  it("names the step that gave the choice", () => {
    expect(choiceOrigin(index, "p:species/elf")).toBe("species");
    expect(choiceOrigin(index, "p:trait/keen-senses")).toBe("species");
    expect(choiceOrigin(index, "p:background/sage")).toBe("background");
    expect(choiceOrigin(index, "p:feature/style")).toBe("class");
    expect(choiceOrigin(index, "p:feature/champion-style")).toBe("class");
  });

  it("leaves the rest to the Choices step", () => {
    expect(choiceOrigin(index, "p:feat/alert")).toBe("other");
    expect(choiceOrigin(index, "p:nothing/here")).toBe("other");
    expect(choiceOrigin(index, "p:trait/a")).toBe("other");
  });
});
