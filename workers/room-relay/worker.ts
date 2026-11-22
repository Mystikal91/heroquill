import { DurableObject } from "cloudflare:workers";
import {
  type ByeReason,
  CLOSE_CODES,
  LIMITS,
  normaliseCode,
  parseClientMessage,
} from "../../src/relay/protocol";
import {
  type Out,
  type Env as RoomEnv,
  type RoomState,
  type Target,
  type Who,
  isExpired,
  leave,
  step,
} from "../../src/relay/room";

/**
 * The relay of the DM mode: a Durable Object for each room, one WebSocket for each person at the table.
 * It logs nothing and keeps almost nothing: the seats, the last card of each player and the last tracker
 * the DM published, deleted after twelve hours without a message. The rules are in `src/relay/room.ts`,
 * which has no sockets and is tested on its own; this file only connects them to the network and storage.
 *
 * Sockets use the hibernation API, so an idle room costs nothing: who a socket is lives in its
 * attachment, the room in storage. No timers, no pending fetch: they would keep the object awake.
 */

interface Env {
  ROOM: DurableObjectNamespace<Room>;
  /** Sites allowed to open a socket, comma separated. */
  ALLOWED_ORIGINS?: string;
}

const DEFAULT_ORIGINS = [
  "https://heroquill.app",
  "https://develop.heroquill.app",
  "http://localhost:5173",
  "http://localhost:5176",
];

interface Attachment {
  who?: Who;
  /** A newer socket took this one's place: its closing is not news to anybody. */
  replaced?: boolean;
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

async function sha256Hex(text: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}

const newToken = () => hex(crypto.getRandomValues(new Uint8Array(16)));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origins = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
      : DEFAULT_ORIGINS;
    const origin = request.headers.get("Origin");
    // A browser says where the page is from; a script that says nothing is not a browser, and is let through only locally.
    if (origin !== null && !origins.includes(origin))
      return new Response("Forbidden", { status: 403 });
    const match = /^\/room\/([^/]+)$/.exec(new URL(request.url).pathname);
    const code = match?.[1] ? normaliseCode(match[1]) : undefined;
    if (!code) return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket")
      return new Response("Expected a WebSocket", { status: 426 });
    return env.ROOM.get(env.ROOM.idFromName(code)).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  private room: RoomState | undefined;
  private loaded = false;
  /** When the saved room says it was last active: a message only rewrites it when this is old. */
  private savedActive = 0;
  private recent = new WeakMap<WebSocket, number[]>();

  private async load(): Promise<RoomState | undefined> {
    if (!this.loaded) {
      this.room = await this.ctx.storage.get<RoomState>("room");
      this.savedActive = this.room?.lastActive ?? 0;
      this.loaded = true;
    }
    return this.room;
  }

  private async save(room: RoomState | undefined) {
    this.room = room;
    if (!room) {
      await this.ctx.storage.deleteAll();
      await this.ctx.storage.deleteAlarm();
      return;
    }
    this.savedActive = room.lastActive;
    await this.ctx.storage.put("room", room);
    await this.ctx.storage.setAlarm(room.lastActive + LIMITS.roomHours * 3_600_000);
  }

  async fetch(_request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({} satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** Who is connected now, apart from one socket (the one that is speaking). */
  private online(except?: WebSocket): RoomEnv["online"] {
    let dm = false;
    const seats = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment() as Attachment | null;
      if (!a?.who || a.replaced) continue;
      if (a.who.role === "dm") dm = true;
      else seats.add(a.who.seat);
    }
    return { dm, seats };
  }

  private sockets(target: Target, self: WebSocket): WebSocket[] {
    const all = this.ctx.getWebSockets();
    if (target === "self") return [self];
    return all.filter((ws) => {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (!a?.who || a.replaced) return false;
      if (target === "dm") return a.who.role === "dm";
      if (target === "players") return a.who.role === "player";
      return a.who.role === "player" && a.who.seat === target.seat;
    });
  }

  private deliver(out: readonly Out[], self: WebSocket) {
    for (const { to, msg } of out) {
      const text = JSON.stringify(msg);
      for (const ws of this.sockets(to, self)) {
        try {
          ws.send(text);
        } catch {
          // A socket that cannot be written to is closing: its own close event says so.
        }
      }
    }
  }

  private close(ws: WebSocket, reason: ByeReason, replaced = false) {
    if (replaced)
      ws.serializeAttachment({
        ...(ws.deserializeAttachment() as Attachment | null),
        replaced: true,
      });
    try {
      ws.close(CLOSE_CODES[reason], reason);
    } catch {
      // Already closed.
    }
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    const now = Date.now();
    // At most so many messages a second; a socket that goes faster is closed.
    const times = (this.recent.get(ws) ?? []).filter((t) => now - t < 1000);
    times.push(now);
    this.recent.set(ws, times);
    if (times.length > LIMITS.perSecond) return this.close(ws, "too-fast");
    const msg = typeof data === "string" ? parseClientMessage(data) : undefined;
    if (!msg) return this.close(ws, "bad-message");

    const attachment = (ws.deserializeAttachment() as Attachment | null) ?? {};
    const state = await this.load();
    const secretHash =
      msg.t === "hello" && msg.role === "dm" ? await sha256Hex(msg.secret) : undefined;
    const result = step(state, attachment.who, msg, {
      now,
      ...(secretHash && { secretHash }),
      newToken,
      online: this.online(ws),
    });

    if (result.drop) {
      const { reason, targets } = result.drop;
      for (const other of this.ctx.getWebSockets()) {
        if (other === ws) continue;
        const a = other.deserializeAttachment() as Attachment | null;
        const hit = targets.some(
          (t) =>
            "all" in t ||
            ("dm" in t && a?.who?.role === "dm") ||
            ("seat" in t && a?.who?.role === "player" && a.who.seat === t.seat),
        );
        if (hit) this.close(other, reason, true);
      }
    }
    if (result.who) ws.serializeAttachment({ ...attachment, who: result.who } satisfies Attachment);
    this.deliver(result.out, ws);

    // Write what is worth keeping; and the time of the last message now and then, so the expiry stays right.
    const stale =
      result.state !== undefined && result.state.lastActive - this.savedActive > 1_800_000;
    if (result.dirty || stale) await this.save(result.state);
    else this.room = result.state;

    if (result.bye) this.close(ws, result.bye);
    if (result.drop?.targets.some((t) => "all" in t)) this.close(ws, result.drop.reason);
  }

  async webSocketClose(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a?.replaced) return;
    const state = await this.load();
    this.deliver(leave(state, a?.who), ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  /** The expiry: a room nobody has written to for twelve hours goes, and its sockets with it. */
  async alarm() {
    const state = await this.load();
    if (!state) return;
    if (!isExpired(state, Date.now())) {
      await this.ctx.storage.setAlarm(state.lastActive + LIMITS.roomHours * 3_600_000);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) this.close(ws, "expired", true);
    await this.save(undefined);
  }
}
