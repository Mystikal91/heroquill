// Writes the test characters of the print check as a transfer file, to open them in the app:
// menu of the character bar (the three dots) > Import / Export > pick the file.
//
//   npm run export:print-characters          # .cache/print-check-characters.dndtransfer.json
//   OUT=somewhere.json npm run export:print-characters
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Section, buildBundle, serializeBundle } from "../../src/storage/bundle";
import { cases } from "./testCharacters";

const here = fileURLToPath(new URL(".", import.meta.url));
const out =
  process.env.OUT ?? join(here, "..", "..", ".cache", "print-check-characters.dndtransfer.json");

// Each character is named for what it is ("2014 wizard 20 elf"), so the list of the app tells them apart.
// The ones made with every option ticked are the same character again, so they are left out.
const characters = cases()
  .filter((c) => c.config === "default")
  .map((c) => c.character);

const bundle = buildBundle(
  {
    characters,
    packs: [],
    settings: {} as never,
    deeplKey: "",
    translations: [],
  },
  new Set<Section>(["characters"]),
);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, await serializeBundle(bundle));
console.log(`${characters.length} characters written to ${out}`);
