import { describe, expect, it } from "vitest";
import { newCode, newSecret } from "./address";
import { CODE_ALPHABET, CODE_LENGTH, normaliseCode } from "./protocol";

describe("join codes and secrets", () => {
  it("makes a code of the alphabet that the room accepts", () => {
    for (let i = 0; i < 50; i++) {
      const code = newCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true);
      expect(normaliseCode(code)).toBe(code);
    }
  });

  it("does not use bytes that would favour a symbol", () => {
    const limit = 256 - (256 % CODE_ALPHABET.length);
    // Only bytes at or above the limit are offered first: they are skipped, the rest are used.
    let call = 0;
    const code = newCode((n) => {
      call += 1;
      return call === 1 ? new Uint8Array(n).fill(limit) : new Uint8Array(n).fill(0);
    });
    expect(code).toBe(CODE_ALPHABET[0]?.repeat(CODE_LENGTH));
  });

  it("makes a secret of 32 hex characters", () => {
    expect(newSecret()).toMatch(/^[0-9a-f]{32}$/);
  });
});
