// A real Chrome driven through the DevTools protocol, and a small web server for dist/: shared by the
// check of the printed pages (pages.ts) and the blank sheets of the website (blankSheets.ts).
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
};

/** Serves a folder on a free port of 127.0.0.1. */
export function serve(dir: string): Promise<{ server: Server; port: number }> {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split(/[?#]/)[0] ?? "/");
    let file = join(dir, normalize(path));
    if (!file.startsWith(dir)) file = dir;
    if (path.endsWith("/")) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, port: typeof address === "object" && address ? address.port : 0 });
    }),
  );
}

/** Chrome on this machine: `CHROME`, or the usual places. */
function chromePath(): string {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const found = candidates.find((p) => p && existsSync(p));
  if (!found) throw new Error("No Chrome found: set CHROME to its path");
  return found;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Starts a headless Chrome and returns the address of the protocol of its page. */
export async function launchChrome(port: number): Promise<{ proc: ChildProcess; socket: string }> {
  const proc = spawn(
    chromePath(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), "hq-print-"))}`,
      "--no-first-run",
      "--lang=en-US",
      "--disable-gpu",
      "--window-size=1100,1400",
      ...(process.env.CI ? ["--no-sandbox"] : []),
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  for (let i = 0; i < 60; i++) {
    try {
      const list = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()) as {
        type: string;
        webSocketDebuggerUrl: string;
      }[];
      const page = list.find((t) => t.type === "page");
      if (page) return { proc, socket: page.webSocketDebuggerUrl };
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

export interface Session {
  send: <T = Record<string, unknown>>(method: string, params?: object) => Promise<T>;
  evaluate: <T>(expression: string) => Promise<T>;
  /** The exceptions the page threw, first line of each. */
  errors: string[];
  close(): void;
}

/** Talks to the page at `socket`: Page and Runtime are enabled. */
export async function connect(socket: string): Promise<Session> {
  const ws = new WebSocket(socket);
  await new Promise((r) => ws.on("open", r));
  let id = 0;
  const waiting = new Map<number, (msg: { result?: unknown; error?: unknown }) => void>();
  const errors: string[] = [];
  ws.on("message", (m: Buffer) => {
    const msg = JSON.parse(String(m));
    waiting.get(msg.id)?.(msg);
    if (msg.method === "Runtime.exceptionThrown")
      errors.push(
        String(msg.params?.exceptionDetails?.exception?.description ?? "").split("\n")[0] ?? "",
      );
  });
  const send = <T = Record<string, unknown>>(method: string, params = {}) =>
    new Promise<T>((resolve, reject) => {
      const n = ++id;
      waiting.set(n, (msg) =>
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result as T),
      );
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const evaluate = async <T>(expression: string): Promise<T> => {
    const r = await send<{ result?: { value?: T }; exceptionDetails?: unknown }>(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
    );
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result?.value as T;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  return { send, evaluate, errors, close: () => ws.close() };
}
