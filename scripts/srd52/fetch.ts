/** Downloads the pinned 2024 5e-database source files into `.cache/srd52/` (gitignored). */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import source from "./source.json" with { type: "json" };

export const CACHE_DIR = join(".cache", "srd52");

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false,
  );
}

export async function fetchSource(force = false): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  for (const name of source.files) {
    const target = join(CACHE_DIR, `${name}.json`);
    if (!force && (await exists(target))) continue;
    const url = `https://raw.githubusercontent.com/${source.repo}/${source.commit}/${source.path}/${name}.json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    await writeFile(target, await response.text());
    console.log(`downloaded ${name}`);
  }
}

if (process.argv[1]?.endsWith("fetch.ts")) {
  await fetchSource(process.argv.includes("--force"));
}
