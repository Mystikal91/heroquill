/**
 * Runs lint, typecheck, test and build and prints one line for each: exit code, seconds, log file.
 * The output goes to log files; the first lines that look like an error are printed for what fails.
 * A failing lint or typecheck stops the run. Files that change during the run make it fail too:
 * the result would be about a tree that is not there any more.
 *
 *   npm run check
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STEPS = ["lint", "typecheck", "test", "build"];
const STOPS = new Set(["lint", "typecheck"]);
const ERROR_LINES = 30;
const LOOKS_WRONG = /error|fail|✗|×|\bat .+:\d+:\d+|AssertionError|━━/i;

const git = (...args) =>
  spawnSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 }).stdout ?? "";

/** A fingerprint of the working tree: what differs from the last commit and the new files. */
function tree() {
  const hash = createHash("sha1").update(git("rev-parse", "HEAD")).update(git("diff", "HEAD"));
  for (const file of git("ls-files", "--others", "--exclude-standard", "-z").split("\0"))
    if (file && existsSync(file)) hash.update(file).update(readFileSync(file));
  return hash.digest("hex");
}

const before = tree();
let failed = false;
for (const [i, step] of STEPS.entries()) {
  const log = join(tmpdir(), `hq-${step}.log`);
  const out = openSync(log, "w");
  const start = Date.now();
  const { status } = spawnSync(`npm run ${step}`, { shell: true, stdio: ["ignore", out, out] });
  closeSync(out);
  const seconds = Math.round((Date.now() - start) / 1000);
  console.log(`${step.padEnd(10)} exit ${status ?? "none"}  ${seconds}s  ${log}`);
  if (status === 0) continue;
  failed = true;
  const lines = readFileSync(log, "utf8").split(/\r?\n/);
  const wrong = lines.filter((line) => LOOKS_WRONG.test(line));
  for (const line of (wrong.length > 0 ? wrong : lines.slice(-ERROR_LINES)).slice(0, ERROR_LINES))
    console.log(`  ${line}`);
  if (STOPS.has(step)) {
    console.log(`skipped: ${STEPS.slice(i + 1).join(", ")}`);
    break;
  }
}
if (tree() !== before) {
  failed = true;
  console.log("CHANGED: files changed during the run; run it again when the edits are done.");
}
console.log(failed ? "FAILED" : "PASSED");
process.exit(failed ? 1 : 0);
