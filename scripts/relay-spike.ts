/**
 * Plays a short game against a running relay (`npx wrangler dev --config workers/room-relay/wrangler.toml`):
 * a DM and two players, with the checks that matter (who sees what, reconnection, the wrong secret, closing).
 *
 *   npx tsx scripts/relay-spike.ts [ws://127.0.0.1:8787]
 *
 * Exit code 0 when every check passed.
 */
import { CODE_ALPHABET, CODE_LENGTH, type ServerMessage } from "../src/relay/protocol";

const base = process.argv[2] ?? "ws://127.0.0.1:8787";
const code = Array.from(
  { length: CODE_LENGTH },
  () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
).join("");
const secret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(
  "",
);

interface Client {
  ws: WebSocket;
  inbox: ServerMessage[];
  closed: { code: number; reason: string } | undefined;
  send: (msg: unknown) => void;
  next: (match: (m: ServerMessage) => boolean, ms?: number) => Promise<ServerMessage | undefined>;
  quiet: (match: (m: ServerMessage) => boolean, ms?: number) => Promise<boolean>;
}

function connect(roomCode = code): Promise<Client> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}/room/${roomCode}`);
    const inbox: ServerMessage[] = [];
    const client: Client = {
      ws,
      inbox,
      closed: undefined,
      send: (msg) => ws.send(JSON.stringify(msg)),
      next: async (match, ms = 2000) => {
        const start = Date.now();
        let seen = 0;
        while (Date.now() - start < ms) {
          for (; seen < inbox.length; seen++) {
            const m = inbox[seen];
            if (m && match(m)) return m;
          }
          await new Promise((r) => setTimeout(r, 20));
        }
        return undefined;
      },
      quiet: async (match, ms = 400) => {
        await new Promise((r) => setTimeout(r, ms));
        return !inbox.some(match);
      },
    };
    ws.onmessage = (e) => inbox.push(JSON.parse(String(e.data)) as ServerMessage);
    ws.onclose = (e) => {
      client.closed = { code: e.code, reason: e.reason };
    };
    ws.onopen = () => resolve(client);
    ws.onerror = () => reject(new Error("could not connect"));
  });
}

let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok || extra === undefined ? "" : `  ${JSON.stringify(extra)}`}`,
  );
};
const waitClosed = async (c: Client, ms = 2000) => {
  const start = Date.now();
  while (!c.closed && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 20));
  return c.closed;
};

const card = {
  name: "Aria",
  hp: 10,
  maxHp: 12,
  tempHp: 0,
  ac: 15,
  speed: 30,
  conditions: ["prone"],
};

async function main() {
  console.log(`room ${code} on ${base}`);

  const stranger = await connect(code);
  stranger.send({ t: "hello", v: 1, role: "player", name: "Early" });
  check(
    "a player cannot open a room",
    (await waitClosed(stranger))?.reason === "no-room",
    stranger.closed,
  );

  const dm = await connect();
  dm.send({ t: "hello", v: 1, role: "dm", secret });
  const dmWelcome = await dm.next((m) => m.t === "welcome");
  check("the DM opens the room", dmWelcome?.t === "welcome" && dmWelcome.role === "dm");

  const bad = await connect();
  bad.send({ t: "hello", v: 1, role: "dm", secret: "0".repeat(32) });
  check(
    "the wrong secret is turned away",
    (await waitClosed(bad))?.reason === "bad-secret",
    bad.closed,
  );

  const aria = await connect();
  aria.send({ t: "hello", v: 1, role: "player", name: "Aria" });
  const ariaWelcome = await aria.next((m) => m.t === "welcome");
  const seat = ariaWelcome?.t === "welcome" ? ariaWelcome.seat : undefined;
  const token = ariaWelcome?.t === "welcome" ? ariaWelcome.token : undefined;
  check(
    "a player joins and gets a seat and a token",
    Boolean(seat && token && ariaWelcome?.t === "welcome" && ariaWelcome.dmOnline),
  );
  check(
    "the DM sees the player arrive",
    Boolean(await dm.next((m) => m.t === "presence" && m.online && m.seat === seat)),
  );

  const bo = await connect();
  bo.send({ t: "hello", v: 1, role: "player", name: "Bo" });
  await bo.next((m) => m.t === "welcome");
  await dm.next((m) => m.t === "presence" && m.name === "Bo");

  aria.send({ t: "card", card });
  const gotCard = await dm.next((m) => m.t === "card");
  check("the DM gets the card", gotCard?.t === "card" && gotCard.card.hp === 10, gotCard);
  check("the other player does not", await bo.quiet((m) => m.t === "card"));

  aria.send({ t: "roll", roll: { label: "Stealth", detail: "d20 14 +5", total: 19 } });
  check("the DM gets the roll", (await dm.next((m) => m.t === "roll"))?.t === "roll");
  check("the other player does not", await bo.quiet((m) => m.t === "roll"));

  aria.send({ t: "initiative", value: 17 });
  const ini = await dm.next((m) => m.t === "initiative");
  check(
    "the DM gets the initiative",
    ini?.t === "initiative" && ini.value === 17 && ini.seat === seat,
    ini,
  );

  const view = { round: 1, turn: "g1", order: [{ id: "g1", name: "Goblin", band: "unhurt" }] };
  dm.send({ t: "tracker", view });
  check(
    "both players get the tracker",
    Boolean(await aria.next((m) => m.t === "tracker")) &&
      Boolean(await bo.next((m) => m.t === "tracker")),
  );

  dm.send({ t: "askInitiative" });
  check(
    "both players are asked for the initiative",
    Boolean(await aria.next((m) => m.t === "askInitiative")) &&
      Boolean(await bo.next((m) => m.t === "askInitiative")),
  );

  // A reconnection with the token: same seat, the old socket gone.
  aria.ws.close();
  check(
    "the DM sees the player leave",
    Boolean(await dm.next((m) => m.t === "presence" && !m.online && m.seat === seat)),
  );
  const back = await connect();
  back.send({ t: "hello", v: 1, role: "player", name: "Aria", seat, token });
  const backWelcome = await back.next((m) => m.t === "welcome");
  check(
    "the player comes back to the same seat, with the tracker",
    backWelcome?.t === "welcome" && backWelcome.seat === seat && backWelcome.tracker?.round === 1,
    backWelcome,
  );
  const guessed = await connect();
  guessed.send({ t: "hello", v: 1, role: "player", name: "Mallory", seat, token: "wrong" });
  const guessedWelcome = await guessed.next((m) => m.t === "welcome");
  check(
    "a wrong token does not give the seat",
    guessedWelcome?.t === "welcome" && guessedWelcome.seat !== seat,
    guessedWelcome,
  );

  // The DM on another tab replaces the first.
  const dm2 = await connect();
  dm2.send({ t: "hello", v: 1, role: "dm", secret });
  const dm2Welcome = await dm2.next((m) => m.t === "welcome");
  check(
    "the DM comes back and gets the cards",
    dm2Welcome?.t === "welcome" &&
      dm2Welcome.players.some((p) => p.seat === seat && p.card?.hp === 10),
    dm2Welcome,
  );
  check(
    "the first DM socket is replaced",
    (await waitClosed(dm))?.reason === "replaced",
    dm.closed,
  );
  check("the players are not told the DM left", await bo.quiet((m) => m.t === "dm" && !m.online));

  // A message that is not ours closes the socket.
  const junk = await connect();
  junk.ws.send("not json");
  check("junk closes the socket", (await waitClosed(junk))?.reason === "bad-message", junk.closed);

  dm2.send({ t: "close" });
  check(
    "closing the game closes every socket",
    (await waitClosed(bo))?.reason === "closed" && (await waitClosed(back))?.reason === "closed",
    [bo.closed, back.closed],
  );

  const late = await connect();
  late.send({ t: "hello", v: 1, role: "player", name: "Late" });
  check("the room is gone afterwards", (await waitClosed(late))?.reason === "no-room", late.closed);

  console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
