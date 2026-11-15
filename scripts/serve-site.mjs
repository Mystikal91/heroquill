// Local preview of the website (the welcome page, guides, news, contribute page).
// Rebuilds the pages with scripts/build-site.mjs, then serves dist/ on a port (default 5175).
// The app under /app/ is served only if dist/app exists (npm run build makes it).
// Usage: node scripts/serve-site.mjs [port]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
process.chdir(root);
const dist = join(root, "dist");
const port = Number(process.argv[2] || 5175);

const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
execFileSync(process.execPath, [tsx, "scripts/build-site.mjs"], { stdio: "inherit" });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

createServer((request, response) => {
  const path = normalize(decodeURIComponent(new URL(request.url, "http://localhost").pathname));
  let file = join(dist, path);
  if (!file.startsWith(dist)) {
    response.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain" }).end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  response.end(readFileSync(file));
}).listen(port, () => console.log(`Site on http://localhost:${port}/`));
