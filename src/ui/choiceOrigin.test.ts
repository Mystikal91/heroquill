import { describe, expect, it } from "vitest";
import { choiceOrigin, originsOf } from "./choiceOrigin";

describe("originsOf", () => {
  const owned = new Map<string, { kind: string; effects?: unknown[]; data?: { class?: string } }>([
    ["p:species/elf", { kind: "species", effects: [{ type: "trait", id: "p:trait/keen" }] }],
    ["p:trait/keen", { kind: "trait" }],
    ["p:class/fighter", { kind: "class", effects: [{ type: "trait", id: "p:feature/style" }] }],
    [
      "p:feature/style",
      {
        kind: "feature",
        effects: [{ type: "choice", grants: "trait", from: ["p:feature/dueling"] }],
      },
    ],
    ["p:feature/dueling", { kind: "feature" }],
    ["p:feature/mastery", { kind: "feature", data: { class: "p:class/fighter" } }],
  ]);
  const origins = originsOf(owned, {
    species: ["p:species/elf"],
    background: [],
    class: ["p:class/fighter"],
  });

  it("follows what a species or a class grants", () => {
    expect(choiceOrigin(owned, "p:trait/keen", origins)).toBe("species");
    expect(choiceOrigin(owned, "p:feature/style", origins)).toBe("class");
    expect(choiceOrigin(owned, "p:feature/dueling", origins)).toBe("class");
    expect(choiceOrigin(owned, "p:feature/mastery", origins)).toBe("class");
  });
});

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
