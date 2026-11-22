import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PING_TIMEOUT_MS, RETRY_DELAYS_MS, type SocketLike, connectRelay } from "./client";
import { CLOSE_CODES, type ClientMessage, type ServerMessage } from "./protocol";

class Fake implements SocketLike {
  sent: ClientMessage[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code = 1000) {
    this.closed = true;
    this.onclose?.({ code });
  }
  open() {
    this.onopen?.();
  }
  hear(msg: ServerMessage) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop() {
    this.onclose?.({ code: 1006 });
  }
}

const welcome: ServerMessage = { t: "welcome", v: 1, role: "dm", players: [], dmOnline: true };

describe("connectRelay", () => {
  let sockets: Fake[];
  let states: string[];
  let heard: ServerMessage[];
  const start = (heartbeatMs?: number) =>
    connectRelay({
      url: "ws://x",
      hello: () => ({ t: "hello", v: 1, role: "dm", secret: "s".repeat(32) }),
      onMessage: (m) => heard.push(m),
      onState: (s, bye) => states.push(bye ? `${s}:${bye}` : s),
      ...(heartbeatMs && { heartbeatMs }),
      socket: () => {
        const s = new Fake();
        sockets.push(s);
        return s;
      },
    });
  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    states = [];
    heard = [];
  });
  afterEach(() => vi.useRealTimers());

  it("says hello when it opens and is online after the welcome", () => {
    const link = start();
    sockets[0]?.open();
    expect(sockets[0]?.sent[0]).toMatchObject({ t: "hello", role: "dm" });
    expect(link.state()).toBe("connecting");
    sockets[0]?.hear(welcome);
    expect(link.state()).toBe("online");
    expect(states).toEqual(["connecting", "online"]);
    expect(heard).toHaveLength(1);
    expect(link.send({ t: "ping" })).toBe(true);
  });

  it("does not send while the line is not open", () => {
    const link = start();
    expect(link.send({ t: "ping" })).toBe(false);
  });

  it("tries again with growing waits, and starts over after a welcome", () => {
    const link = start();
    sockets[0]?.open();
    sockets[0]?.hear(welcome);
    sockets[0]?.drop();
    expect(link.state()).toBe("retrying");
    vi.advanceTimersByTime(RETRY_DELAYS_MS[0] ?? 0);
    expect(sockets).toHaveLength(2);
    sockets[1]?.drop();
    vi.advanceTimersByTime((RETRY_DELAYS_MS[1] ?? 0) - 1);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);
    sockets[2]?.open();
    sockets[2]?.hear(welcome);
    sockets[2]?.drop();
    vi.advanceTimersByTime(RETRY_DELAYS_MS[0] ?? 0);
    expect(sockets).toHaveLength(4);
  });

  it("does not retry when the room turned it away", () => {
    const link = start();
    sockets[0]?.open();
    sockets[0]?.close(CLOSE_CODES["bad-secret"]);
    expect(link.state()).toBe("ended");
    expect(states.at(-1)).toBe("ended:bad-secret");
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("does not retry after close()", () => {
    const link = start();
    sockets[0]?.open();
    link.close();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("pings on the heartbeat and takes a silent line as dead", () => {
    const link = start(45_000);
    sockets[0]?.open();
    sockets[0]?.hear(welcome);
    vi.advanceTimersByTime(45_000);
    expect(sockets[0]?.sent.at(-1)).toEqual({ t: "ping" });
    sockets[0]?.hear({ t: "pong" });
    vi.advanceTimersByTime(PING_TIMEOUT_MS + 1);
    expect(link.state()).toBe("online");
    vi.advanceTimersByTime(45_000);
    vi.advanceTimersByTime(PING_TIMEOUT_MS + 1);
    expect(link.state()).toBe("retrying");
  });

  it("ignores a message that is not JSON", () => {
    start();
    sockets[0]?.open();
    sockets[0]?.onmessage?.({ data: "nope" });
    expect(heard).toHaveLength(0);
  });
});
