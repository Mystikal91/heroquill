import { describe, expect, it } from "vitest";
import { askEdition, editionRequest, editionsIn } from "./edition";

describe("the edition question", () => {
  it("offers only the editions whose rules are loaded, 2014 first", () => {
    expect(editionsIn(["srd51"])).toEqual(["srd51"]);
    expect(editionsIn(["srd52", "custom", "srd51"])).toEqual(["srd51", "srd52"]);
    expect(editionsIn([])).toEqual([]);
  });

  it("resolves to the edition the person picks and closes the question", async () => {
    const answer = askEdition();
    expect(editionRequest.value).toBeDefined();
    editionRequest.value?.answer("srd52");
    await expect(answer).resolves.toBe("srd52");
    expect(editionRequest.value).toBeUndefined();
  });

  it("resolves to nothing when the dialog is closed", async () => {
    const answer = askEdition();
    editionRequest.value?.answer(undefined);
    await expect(answer).resolves.toBeUndefined();
  });

  it("answers the first question with nothing when a second one comes", async () => {
    const first = askEdition();
    const second = askEdition();
    await expect(first).resolves.toBeUndefined();
    editionRequest.value?.answer("srd51");
    await expect(second).resolves.toBe("srd51");
  });
});
