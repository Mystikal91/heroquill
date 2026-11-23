import { CODE_ALPHABET, CODE_LENGTH } from "./protocol";

/**
 * Where the relay is: the local one while developing, the published one otherwise. The two never
 * share a room.
 */
export function relayBase(): string {
  if (import.meta.env.DEV) return "ws://127.0.0.1:8787";
  return "wss://rooms.heroquill.app";
}

export const roomUrl = (code: string) => `${relayBase()}/room/${code}`;

/** A join code: letters and numbers that cannot be mistaken for each other, from the browser's own randomness. */
export function newCode(random: (n: number) => Uint8Array = randomBytes): string {
  let out = "";
  // Bytes at or above the largest multiple of the alphabet are thrown away, so no symbol is likelier.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < CODE_LENGTH) {
    for (const b of random(CODE_LENGTH * 2)) {
      if (b < limit && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
    }
  }
  return out;
}

/** The DM's secret: 32 hex characters that prove they opened the room. It stays on their device. */
export function newSecret(random: (n: number) => Uint8Array = randomBytes): string {
  return [...random(16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}
