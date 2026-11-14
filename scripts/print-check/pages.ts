// The pages of the printed sheet, for a set of characters, with a real Chrome.
//
// For each character it opens the app (a built `dist/`, served here, or PRINT_URL), goes to the
// Print tab, prints to PDF as the browser's own print does and checks two things:
//   1. the number of pages is the one in `pages.baseline.json` (a changed layout is a decision:
//      look at the PDF, then run with ACCEPT=1 to write the new numbers);
//   2. no block that the print CSS says must stay whole (`break-inside: avoid`: the front page, a
//      feature, a spell, a card...) has its first words on one page and its last on another.
// Chrome only: Firefox prints differently (see README.md). Run `npm run build` first.
//
//   npm run test:print              # all characters
//   ONLY=wizard npm run test:print  # the names that contain the word
//   ACCEPT=1 npm run test:print     # write the baseline
//   KEEP=out npm run test:print     # also keep each PDF in the folder `out`
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { encodeShare } from "../../src/storage/share";
import { type Config, SETTINGS, cases } from "./testCharacters";

const require = createRequire(import.meta.url);
const WebSocket = require("ws");
const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..", "..");
const BASELINE = join(here, "pages.baseline.json");

// ---- A small static server for dist/ ----

const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

function serve(dir: string): Promise<{ server: Server; port: number }> {
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

// ---- Chrome ----

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function launchChrome(port: number): Promise<{ proc: ChildProcess; socket: string }> {
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
      // Chrome is still starting.
    }
    await sleep(250);
  }
  throw new Error("Chrome did not start");
}

// ---- The check ----

/** What the page reports: the blocks that must stay whole, as their first and last words. */
const COLLECT = `(async () => {
  const EXTRA = ${JSON.stringify(process.env.EXTRA ?? "")};
  const norm = (s) => s.toLowerCase().replace(/[\\s\\u00ad\\-\\u2010-\\u2015]+/g, "");
  await document.fonts.ready;
  await new Promise((r) => setTimeout(r, 700));
  const paper = document.querySelector(".paper");
  const seen = new Set();
  const blocks = [];
  for (const el of paper.querySelectorAll("*")) {
    if (getComputedStyle(el).breakInside !== "avoid" && !(EXTRA && el.matches(EXTRA))) continue;
    // A badge before the words (the level or the C of a spell card) is drawn apart from them.
    const lines = (el.innerText || "").split("\\n").map((l) => l.trim()).filter(Boolean);
    while (lines.length > 1 && lines[0].length <= 2) lines.shift();
    const text = norm(lines.join(" "));
    if (text.length < 40) continue;
    const head = text.slice(0, 12);
    const tail = text.slice(-12);
    const key = head + "|" + tail;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push({ label: (el.className || el.tagName) + ": " + (el.innerText || "").trim().replace(/\\s+/g, " ").slice(0, 40), head, tail });
  }
  // The fixed pages (the front, the story) are one page each: every line of them has to be on one page.
  const whole = [...paper.querySelectorAll(".p-front, .p-story")].map((el) => ({
    label: el.className + " (density " + (el.dataset.density ?? "-") + ", spill " + (el.dataset.spill ?? "-") + ", " + Math.round(el.getBoundingClientRect().height / (96 / 25.4)) + " mm tall" + (el.matches(".p-front") ? ", columns over by " + [...el.querySelectorAll(".p-col")].map((c) => Math.round(((c.scrollHeight - c.clientHeight) / (96 / 25.4)) * 10) / 10).join("/") + " mm" : "") + ")",
    lines: [...new Set((el.innerText || "").split("\\n").map(norm).filter((l) => l.length >= 5))],
  }));
  return { sections: paper.querySelectorAll(".p-page").length, blocks, whole };
})()`;

interface Block {
  label: string;
  head: string;
  tail: string;
}

const normalize2 = (s: string) => s.toLowerCase().replace(/[\s\u00ad\-\u2010-\u2015]+/g, "");

async function pagesText(data: Uint8Array): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(normalize2(content.items.map((i) => ("str" in i ? i.str : "")).join("")));
  }
  return pages;
}

async function main() {
  const dist = join(root, "dist");
  const external = process.env.PRINT_URL;
  if (!external && !existsSync(join(dist, "app", "index.html")))
    throw new Error("No dist/app: run `npm run build` first (or set PRINT_URL)");
  const only = process.env.ONLY?.toLowerCase();
  const list = cases().filter((c) => !only || c.name.toLowerCase().includes(only));
  const saved: { pages?: Record<string, number>; known?: string[] } = existsSync(BASELINE)
    ? JSON.parse(readFileSync(BASELINE, "utf8"))
    : {};
  const baseline = saved.pages ?? {};
  const known = new Set(saved.known ?? []);
  const accept = process.env.ACCEPT === "1";
  const keep = process.env.KEEP;
  if (keep) mkdirSync(keep, { recursive: true });

  const web = external ? undefined : await serve(dist);
  const base = external ?? `http://127.0.0.1:${web?.port}/app/`;
  const { proc, socket } = await launchChrome(9444);
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

  // A problem is an id (stable: who and what) and a text (with the numbers).
  const problems: { id: string; text: string }[] = [];
  const problem = (id: string, text = id) => problems.push({ id, text });
  const counts: Record<string, number> = {};
  let unverified = 0;
  let checked = 0;
  let current: Config | undefined;
  for (const { name, config, character } of list.sort((a, b) => a.config.localeCompare(b.config))) {
    const key = config === "default" ? name : `${name} [${config}]`;
    if (config !== current) {
      // What the Print tab has ticked is saved in the page's storage, which it reads when it loads.
      // The page may not be ready to give its storage yet (the first load after Chrome starts is slow).
      for (let attempt = 0; ; attempt++) {
        await send("Page.navigate", { url: base });
        await sleep(1500);
        try {
          await evaluate(
            `localStorage.setItem("print-settings", ${JSON.stringify(JSON.stringify(SETTINGS[config]))})`,
          );
          break;
        } catch (error) {
          if (attempt >= 4) throw error;
          await sleep(1500);
        }
      }
      current = config;
    }
    // The page can fail to load now and then (a slow start): it gets three tries before it counts.
    const url = `${base}${await encodeShare(character)}`;
    let seen = "";
    let opened = false;
    for (let attempt = 0; attempt < 3 && !opened; attempt++) {
      await send("Page.navigate", { url: "about:blank" });
      await send("Page.navigate", { url });
      let ready = false;
      for (let i = 0; i < 80 && !ready; i++) {
        await sleep(250);
        ready = await evaluate<boolean>(`document.title.startsWith(${JSON.stringify(name)})`);
      }
      // The page may still be settling after it opened the character: click again until Print is up.
      for (let i = 0; ready && i < 30 && !opened; i++) {
        await evaluate(`document.querySelectorAll(".tab")[4]?.click()`);
        await sleep(400);
        opened = await evaluate<boolean>(`Boolean(document.querySelector(".paper .p-page"))`);
      }
      if (!opened)
        seen = `${await evaluate<string>(`document.title + " | " + document.body.innerText.slice(0, 160).split(String.fromCharCode(10)).join(" ")`)} ${errors.splice(0).join(" / ")}`;
    }
    if (!opened) {
      problem(`${key}: the Print tab did not open`, `${key}: the Print tab did not open (${seen})`);
      continue;
    }
    const found = await evaluate<{
      sections: number;
      blocks: Block[];
      whole: { label: string; lines: string[] }[];
    }>(COLLECT);
    const pdf = await send<{ data: string }>("Page.printToPDF", {
      printBackground: true,
      preferCSSPageSize: true,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
      marginRight: 0,
    });
    const data = Buffer.from(pdf.data, "base64");
    if (keep) writeFileSync(join(keep, `${key.replace(/[^\w.-]+/g, "_")}.pdf`), data);
    const pages = await pagesText(new Uint8Array(data));
    counts[key] = pages.length;

    const expected = baseline[key];
    if (!accept && expected !== undefined && expected !== pages.length)
      problem(`${key}: pages`, `${key}: ${pages.length} pages, the baseline says ${expected}`);
    if (!accept && expected === undefined)
      problem(
        `${key}: pages`,
        `${key}: ${pages.length} pages, not in the baseline (ACCEPT=1 adds it)`,
      );

    // Each edition has its own front page: the words that tell them apart are on page 1 of the right one.
    const first = pages[0] ?? "";
    const only2024 = ["heroicinspiration", "mastery", "armortraining"];
    if (name.startsWith("2024"))
      for (const word of only2024)
        if (!first.includes(word)) problem(`${key}: the 2024 front page lacks "${word}"`);
    // The 2024 background gives an Origin feat, and the story page says it.
    if (name.startsWith("2024") && !pages.some((page) => page.includes("originfeat")))
      problem(`${key}: no page says the Origin feat`);
    if (name.startsWith("2014"))
      for (const word of ["heroicinspiration", "armortraining"])
        if (first.includes(word)) problem(`${key}: the 2014 front page has "${word}"`);
    for (const w of found.whole) {
      if (process.env.VERBOSE) console.log(`  ${w.label}`);
      // The page that has most of its lines is where it was meant to be: the others are the spill.
      const have = pages.map((p) => w.lines.filter((l) => p.includes(l)).length);
      const best = have.indexOf(Math.max(...have));
      const missing = w.lines.filter((l) => !pages[best]?.includes(l));
      if (missing.length > 0)
        problem(
          `${key}: ${w.label.split(" (")[0]} does not fit its page`,
          `${key}: ${w.label} does not fit its page: ${missing.length} of ${w.lines.length} lines are elsewhere (${missing.slice(0, 3).join(", ")})`,
        );
    }
    for (const b of found.blocks) {
      const at = (text: string) => pages.flatMap((p, i) => (p.includes(text) ? [i + 1] : []));
      const from = at(b.head);
      const to = at(b.tail);
      if (from.length === 0 || to.length === 0) {
        unverified++;
        if (process.env.VERBOSE)
          console.log(
            `  not found: ${b.label} [head ${from.length > 0 ? "ok" : JSON.stringify(b.head)}] [tail ${to.length > 0 ? "ok" : JSON.stringify(b.tail)}]`,
          );
        continue;
      }
      checked++;
      if (process.env.VERBOSE === "all")
        console.log(`  ${from.join(",")} -> ${to.join(",")}  ${b.label}`);
      if (!from.some((p) => to.includes(p)))
        problem(
          `${key}: cut: ${b.label}`,
          `${key}: cut across pages ${from[0]} and ${to[to.length - 1]}: ${b.label}`,
        );
    }
    console.log(`${pages.length} pages, ${found.sections} sections  ${key}`);
  }

  ws.close();
  proc.kill();
  web?.server.close();
  console.log(`\n${checked} blocks checked, ${unverified} not found in the PDF text`);
  const failing = problems.filter((p) => !known.has(p.id));
  const stillKnown = problems.filter((p) => known.has(p.id));
  const gone = [...known].filter((id) => !problems.some((p) => p.id === id));
  if (accept) {
    // What is wrong now and is not a page count is kept as known: it stays visible and stops failing,
    // until somebody fixes it (then the line has to go: a known problem that no longer happens fails).
    // Only what is about the layout: a page that did not load is not a fact about the sheet.
    const kept = problems
      .filter((p) => p.id.includes("does not fit its page") || p.id.includes(": cut: "))
      .map((p) => p.id);
    writeFileSync(
      BASELINE,
      `${JSON.stringify({ pages: { ...baseline, ...counts }, known: [...new Set(kept)].sort() }, null, 2)}\n`,
    );
    console.log(`baseline written: ${BASELINE}`);
    process.exit(0);
  }
  for (const p of stillKnown) console.log(`known problem: ${p.text}`);
  if (!only)
    for (const id of gone)
      failing.push({
        id,
        text: `${id} no longer happens: remove it from the known problems (ACCEPT=1)`,
      });
  if (failing.length > 0) {
    console.error(
      `\n${failing.length} problem(s):\n${failing.map((p) => `  - ${p.text}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log("print check passed");
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
