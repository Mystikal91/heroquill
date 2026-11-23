import { describe, expect, it } from "vitest";
import {
  compareVersions,
  loadNewerEntries,
  newerEntries,
  shortNote,
  versionNumbers,
} from "./whatsNew.logic";

const entry = (version: string, date = "2026-10-29") => ({
  version,
  date,
  notes: [{ en: `Notes of ${version}. More text.` }],
});

describe("versions", () => {
  it("reads the numbers of a version and compares them as numbers", () => {
    expect(versionNumbers("1.12.3 beta")).toEqual([1, 12, 3]);
    expect(versionNumbers("1.9 beta")).toEqual([1, 9, 0]);
    expect(versionNumbers("not a version")).toEqual([0]);
    expect(compareVersions("1.12.0", "1.9.1")).toBeGreaterThan(0);
    expect(compareVersions("1.10.0 beta", "1.9.1 beta")).toBeGreaterThan(0);
    expect(compareVersions("1.12.3", "1.12.3 beta")).toBe(0);
  });
});

describe("what changes in an update", () => {
  const list = [
    entry("1.12.3 beta"),
    entry("1.12.2 beta"),
    entry("1.12.1 beta"),
    entry("1.11.0 beta"),
  ];

  it("lists the versions newer than the one in use, newest first", () => {
    expect(newerEntries(list, "1.12.1").map((e) => e.version)).toEqual([
      "1.12.3 beta",
      "1.12.2 beta",
    ]);
    expect(newerEntries(list, "1.12.3")).toEqual([]);
  });

  it("accepts notes that carry a kind", () => {
    const typed = [
      {
        version: "1.35.0",
        date: "2026-11-24",
        notes: [{ en: "A new thing. It is nice.", kind: "feature" }],
      },
    ];
    expect(newerEntries(typed, "1.34.0").map((e) => e.version)).toEqual(["1.35.0"]);
  });

  it("shows at most a few of them", () => {
    expect(newerEntries(list, "1.0.0", 2).map((e) => e.version)).toEqual([
      "1.12.3 beta",
      "1.12.2 beta",
    ]);
  });

  it("leaves out what is not a well-formed entry, and takes anything for an empty list", () => {
    expect(
      newerEntries(
        [entry("1.13.0"), { version: 3 }, null, "x", { version: "2.0", date: "d", notes: [] }],
        "1.0.0",
      ).map((e) => e.version),
    ).toEqual(["1.13.0"]);
    expect(newerEntries(undefined, "1.0.0")).toEqual([]);
    expect(newerEntries({ entries: [] }, "1.0.0")).toEqual([]);
  });

  it("cuts a note to its first sentence, or to a word with an ellipsis", () => {
    expect(shortNote("One sentence. And another.")).toBe("One sentence.");
    expect(shortNote("word ".repeat(80), 30).endsWith("…")).toBe(true);
    expect(shortNote("word ".repeat(80), 30).length).toBeLessThanOrEqual(31);
  });

  it("reads the list from the website, and gives nothing when that fails", async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ entries: list }), { status: 200 })) as unknown as typeof fetch;
    expect((await loadNewerEntries("1.12.2", ok)).map((e) => e.version)).toEqual(["1.12.3 beta"]);
    const missing = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
    expect(await loadNewerEntries("1.0.0", missing)).toEqual([]);
    const broken = (async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    expect(await loadNewerEntries("1.0.0", broken)).toEqual([]);
    const offline = (async () => {
      throw new TypeError("offline");
    }) as unknown as typeof fetch;
    expect(await loadNewerEntries("1.0.0", offline)).toEqual([]);
  });
});
