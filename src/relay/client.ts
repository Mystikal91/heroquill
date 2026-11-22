import { type ByeReason, type ClientMessage, type ServerMessage, byeFromCode } from "./protocol";

/**
 * The app's end of a room: one WebSocket that opens itself again when it drops (a phone locking its screen,
 * a tunnel, the network changing) and says in what state it is. It knows nothing about the DM or the players:
 * the caller gives it the hello to say each time it connects, and gets every message the room sends.
 *
 * `connecting` first time, `online` after the room's welcome, `retrying` while it waits to try again,
 * `ended` when the room turned us away for good (a wrong secret, the room closed, a kick...): no retry then.
 */
export type LinkState = "connecting" | "online" | "retrying" | "ended";

/** The part of a WebSocket the client uses, so a test can stand in for the network. */
export interface SocketLike {
  send(data: string): void;
  close(code?: number): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number }) => void) | null;
  onerror: (() => void) | null;
}

export interface LinkOptions {
  url: string;
  /** The first message of every connection (the DM's secret or the player's seat and token). */
  hello: () => ClientMessage;
  onMessage: (msg: ServerMessage) => void;
  onState: (state: LinkState, bye?: ByeReason) => void;
  /** Send a ping this often while open (the DM during a fight); the answer shows the line is alive. */
  heartbeatMs?: number;
  socket?: (url: string) => SocketLike;
}

export interface RelayLink {
  /** False when the line is not open: the caller sends its state again after the next welcome. */
  send: (msg: ClientMessage) => boolean;
  /** Closes the line and does not retry. */
  close: () => void;
  state: () => LinkState;
}

/** Seconds to wait before each new try; the last one repeats. */
export const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000];
/** How long a ping may go unanswered before the line is taken as dead. */
export const PING_TIMEOUT_MS = 6000;

export function connectRelay(options: LinkOptions): RelayLink {
  const open = options.socket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
  let ws: SocketLike | undefined;
  let state: LinkState = "connecting";
  let tries = 0;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let beat: ReturnType<typeof setInterval> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const set = (next: LinkState, bye?: ByeReason) => {
    state = next;
    options.onState(next, bye);
  };

  const clearTimers = () => {
    clearTimeout(retry);
    clearInterval(beat);
    clearTimeout(deadline);
    retry = beat = deadline = undefined;
  };

  const send = (msg: ClientMessage) => {
    if (state !== "online" || !ws) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  };

  /** A ping that must be answered soon: the way to find out that a socket died while the phone slept. */
  const probe = () => {
    if (state !== "online" || deadline) return;
    if (!send({ t: "ping" })) return;
    deadline = setTimeout(() => {
      deadline = undefined;
      ws?.close();
    }, PING_TIMEOUT_MS);
  };

  const later = () => {
    clearTimers();
    set("retrying");
    const wait = RETRY_DELAYS_MS[Math.min(tries, RETRY_DELAYS_MS.length - 1)] ?? 15000;
    tries += 1;
    retry = setTimeout(connect, wait);
  };

  function connect() {
    if (stopped) return;
    clearTimeout(retry);
    retry = undefined;
    if (state !== "retrying") set("connecting");
    let socket: SocketLike;
    try {
      socket = open(options.url);
    } catch {
      later();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      if (ws !== socket) return;
      socket.send(JSON.stringify(options.hello()));
    };
    socket.onmessage = (e) => {
      if (ws !== socket || typeof e.data !== "string") return;
      clearTimeout(deadline);
      deadline = undefined;
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data) as ServerMessage;
      } catch {
        return;
      }
      if (msg.t === "welcome") {
        tries = 0;
        if (state !== "online") {
          state = "online";
          clearInterval(beat);
          if (options.heartbeatMs) beat = setInterval(probe, options.heartbeatMs);
          options.onState("online");
        }
      }
      options.onMessage(msg);
    };
    socket.onclose = (e) => {
      if (ws !== socket) return;
      ws = undefined;
      clearTimers();
      const bye = byeFromCode(e.code);
      if (bye) {
        stopped = true;
        set("ended", bye);
      } else if (!stopped) later();
    };
    socket.onerror = () => {
      // The close event that follows says what happened.
    };
  }

  /** The phone came back, or the network did: try now instead of waiting, and check an open line is alive. */
  const nudge = () => {
    if (stopped) return;
    if (state === "retrying") connect();
    else if (state === "online") probe();
  };
  const onVisible = () => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") nudge();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("online", nudge);
    document.addEventListener("visibilitychange", onVisible);
  }

  connect();

  return {
    send,
    state: () => state,
    close: () => {
      stopped = true;
      clearTimers();
      if (typeof window !== "undefined") {
        window.removeEventListener("online", nudge);
        document.removeEventListener("visibilitychange", onVisible);
      }
      const socket = ws;
      ws = undefined;
      try {
        socket?.close();
      } catch {
        // Already closed.
      }
    },
  };
}
