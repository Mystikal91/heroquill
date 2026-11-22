import { describe, expect, it } from "vitest";
import { DEFAULT_ONLINE, readOnline } from "./dmSettings";

describe("readOnline", () => {
  it("falls back to the defaults for nothing or for junk", () => {
    expect(readOnline(null)).toEqual(DEFAULT_ONLINE);
    expect(readOnline("not json")).toEqual(DEFAULT_ONLINE);
    expect(readOnline('{"hideOrder":"yes"}')).toEqual(DEFAULT_ONLINE);
  });

  it("keeps what is saved and fills the rest", () => {
    expect(readOnline('{"hideBands":true,"askInitiative":false}')).toEqual({
      hideOrder: false,
      hideBands: true,
      hideNames: false,
      askInitiative: false,
    });
  });
});
