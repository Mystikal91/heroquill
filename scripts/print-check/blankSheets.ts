// The blank fillable sheets of the website (site/sheets/), made by the app itself in a real Chrome:
// for each language, edition and paper of `SHEETS` (site/sheets.mjs) it opens the Print tab, chooses
// "A blank sheet" with every page and presses "Download a fillable PDF".
//
//   npm run build && npm run site:sheets          # serves dist/ itself
//   PRINT_URL=http://localhost:5173/app/ npm run site:sheets
//   ONLY=it npm run site:sheets                     # the files whose name has the words
//
// Run it again when the print pages change; the files are committed with the site.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { RULESET, SHEETS } from "../../site/sheets.mjs";
import { createCharacter } from "../../src/engine/character";
import { encodeShare } from "../../src/storage/share";
import { connect, launchChrome, serve, sleep } from "./cdp";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = join(root, "site", "sheets");

async function main() {
  const external = process.env.PRINT_URL;
  const web = external ? undefined : await serve(join(root, "dist"));
  const base = external ?? `http://127.0.0.1:${web?.port}/app/`;
  const only = process.env.ONLY?.toLowerCase().split(/\s+/) ?? [];
  const wanted = SHEETS.filter((s) => only.every((w) => s.file.includes(w)));
  mkdirSync(out, { recursive: true });
  const { proc, socket } = await launchChrome(9445);
  const { send, evaluate, errors, close } = await connect(socket);
  let failed = 0;

  for (const sheet of wanted) {
    // The language and the paper are read when the app loads; the blank sheet is chosen on the page.
    await send("Page.navigate", { url: base });
    await sleep(1500);
    await evaluate(`localStorage.setItem("dnd-maker.language", ${JSON.stringify(sheet.lang)});
      localStorage.setItem("print-settings", ${JSON.stringify(
        JSON.stringify({
          paper: sheet.paper,
          lowInk: false,
          includeSheet: true,
          includeStory: true,
          includeFeatureText: true,
          blankSpells: true,
        }),
      )})`);
    // A character of the edition: the blank sheet takes the edition of the open one.
    const character = createCharacter(RULESET[sheet.edition]);
    character.name = `Blank ${sheet.edition}`;
    await send("Page.navigate", { url: "about:blank" });
    await send("Page.navigate", { url: `${base}${await encodeShare(character)}` });
    let ready = false;
    for (let i = 0; i < 80 && !ready; i++) {
      await sleep(250);
      ready = await evaluate<boolean>(`document.title.startsWith("Blank ${sheet.edition}")`);
    }
    let opened = false;
    for (let i = 0; ready && i < 30 && !opened; i++) {
      await evaluate(`document.querySelectorAll(".tab")[4]?.click()`);
      await sleep(400);
      opened = await evaluate<boolean>(
        `(() => { const blank = document.querySelectorAll('input[name="print-what"]')[1]; if (!blank) return false; blank.click(); return Boolean(document.querySelector(".p-blank-spells")); })()`,
      );
    }
    if (!opened) {
      console.error(
        `${sheet.file}: the blank sheet did not open (${errors.splice(0).join(" / ")})`,
      );
      failed++;
      continue;
    }
    await evaluate("document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 700)))");
    const dir = mkdtempSync(join(tmpdir(), "hq-sheet-"));
    await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
    await evaluate(`document.querySelectorAll(".print-actions button")[1]?.click()`);
    let data: Buffer | undefined;
    for (let i = 0; i < 120 && !data; i++) {
      await sleep(250);
      const done = readdirSync(dir).find((f) => f.endsWith(".pdf"));
      if (done) data = readFileSync(join(dir, done));
    }
    if (!data || data.length === 0) {
      console.error(`${sheet.file}: no PDF (${errors.splice(0).join(" / ")})`);
      failed++;
      continue;
    }
    // The title a reader shows; the rest is as the button made it.
    const doc = await PDFDocument.load(data);
    const fields = doc.getForm().getFields().length;
    doc.setTitle(`Heroquill · D&D 5e ${sheet.edition} · ${sheet.lang.toUpperCase()}`);
    writeFileSync(join(out, sheet.file), await doc.save({ updateFieldAppearances: false }));
    console.log(`${sheet.file}: ${doc.getPageCount()} pages, ${fields} fields`);
  }

  close();
  proc.kill();
  web?.server.close();
  if (failed > 0) {
    console.error(`${failed} sheet(s) not made`);
    process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
