import { useState } from "preact/hooks";
import { selection } from "../../../app/arrange";
import { language, localeChain } from "../../../app/language";
import { showView } from "../../../app/navigation";
import { type Paper, printSettings, updatePrintSettings } from "../../../app/printSettings";
import { selectedEntry, workingPack } from "../../../app/studio";
import { ui } from "../../../i18n/ui";
import { type UserPackRecord, packTexts } from "../../../storage/packs";
import { FitText } from "../../print/FitText";
import { type Block, type EntryDoc, docOf } from "./blocks";
import { toHomebrewery } from "./homebrewery";
import { type Scope, firstScope, inPrintOrder, printable, scopeIds } from "./scope";
import { liveWords } from "./words";
import "./paper.css";

const PAGE_SIZE: Record<Paper, string> = { a4: "A4", letter: "letter" };
type Format = "booklet" | "cards" | "markdown";

/** Text with **bold** marks, drawn with real bold. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one line have no identity of their own
          <b key={i}>{part.slice(2, -2)}</b>
        ) : (
          part
        ),
      )}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.t) {
    case "subtitle":
      return <p class="hq-sub">{block.text}</p>;
    case "facts":
      return (
        <dl class="hq-facts">
          {block.rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      );
    case "heading":
      return <h4>{block.text}</h4>;
    case "list":
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <table class="hq-table">
          <thead>
            <tr>
              {block.head.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.join("|")}>
                {row.map((c, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cells of a row are told apart by their place
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    default:
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
  }
}

function Booklet({ docs, sections }: { docs: EntryDoc[]; sections: boolean }) {
  let last = "";
  return (
    <div class="p-page hq-booklet">
      {docs.map((doc) => {
        const heading = sections && doc.group !== last;
        last = doc.group;
        return (
          <article class="hq-entry" key={doc.id}>
            {heading && <h2 class="hq-section">{doc.group}</h2>}
            <h3>{doc.title}</h3>
            {doc.blocks.map((block, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks have no identity of their own
              <BlockView key={i} block={block} />
            ))}
          </article>
        );
      })}
    </div>
  );
}

const CARDS_PER_PAGE = 9;

/** A card is the entry in a frame the size of a playing card, its text shrunk to fit. */
function CardSheet({ docs }: { docs: EntryDoc[] }) {
  const pages: EntryDoc[][] = [];
  for (let i = 0; i < docs.length; i += CARDS_PER_PAGE)
    pages.push(docs.slice(i, i + CARDS_PER_PAGE));
  const plain = (b: Block) =>
    b.t === "para" ? b.text.replace(/\*\*/g, "") : b.t === "list" ? b.items.join("\n") : "";
  return (
    <>
      {pages.map((page) => (
        <div class="p-page hq-cards" key={page.map((d) => d.id).join(",")}>
          {page.map((doc) => (
            <article class="p-frame p-card hq-card" key={doc.id}>
              <div class="p-card-head">
                <h3>
                  {doc.title}
                  <small>
                    {doc.blocks.find((b) => b.t === "subtitle")?.t === "subtitle"
                      ? (doc.blocks[0] as { text: string }).text
                      : ""}
                  </small>
                </h3>
              </div>
              {doc.blocks
                .filter((b): b is Extract<Block, { t: "facts" }> => b.t === "facts")
                .map((b) => (
                  <dl class="hq-facts hq-facts-small" key={b.rows.map((r) => r[0]).join()}>
                    {b.rows.slice(0, 5).map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                ))}
              <FitText text={doc.blocks.map(plain).filter(Boolean).join("\n\n")} />
            </article>
          ))}
        </div>
      ))}
    </>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

const fileName = (record: UserPackRecord) =>
  `${
    record.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || record.id
  }.md`;

/** Paper: what is in a pack, an entry or a selection, printed in the app or as a file for Homebrewery. */
export function PaperView() {
  const record = workingPack();
  const settings = printSettings.value;
  const [scope, setScope] = useState<Scope>(() =>
    firstScope({ open: selectedEntry.peek(), selected: selection.peek() }),
  );
  const [format, setFormat] = useState<Format>("booklet");
  const [group, setGroup] = useState("");
  const [titlePage, setTitlePage] = useState(true);
  const [sections, setSections] = useState(true);
  const [copied, setCopied] = useState(false);
  const words = liveWords();

  const docs: EntryDoc[] = (() => {
    if (!record) return [];
    const texts = packTexts(record, localeChain(language.value));
    const text = (id: string, field: string) => texts[`${id}.${field}`] ?? "";
    const groupOf = (e: (typeof record.pack.entries)[number]) => words.kind(e);
    const ids = scopeIds(record, scope, {
      open: selectedEntry.value,
      selected: selection.value,
      group,
      groupOf,
    });
    return inPrintOrder(
      record.pack.entries.filter((e) => ids.includes(e.id)),
      (e) => text(e.id, "name"),
    ).map((e) => docOf(record, e, text, words));
  })();

  if (!record)
    return (
      <article class="card">
        <button type="button" class="secondary" onClick={() => showView("homebrew")}>
          {ui("credits.back")}
        </button>
        <p class="muted">{ui("studio.noPackOpen")}</p>
      </article>
    );

  const groups = [...new Set(printable(record).map((e) => words.kind(e)))].sort();
  const markdown = toHomebrewery(
    docs,
    {
      name: record.name,
      author: record.meta?.author,
      description: record.meta?.description,
      version: record.pack.manifest.version,
    },
    { titlePage: titlePage && scope === "pack", sections },
  );
  const nothing = docs.length === 0;

  return (
    <div class={`print-root paper-${settings.paper}${settings.lowInk ? " low-ink" : ""}`}>
      <style>{`@page { size: ${PAGE_SIZE[settings.paper]}; margin: 12mm; }`}</style>
      <div class="card print-toolbar no-print hq-toolbar">
        <div class="print-top">
          <button type="button" class="secondary" onClick={() => showView("homebrew")}>
            {ui("credits.back")}
          </button>
          <h2>{ui("paper.title")}</h2>
        </div>
        <p class="print-hint">{ui("paper.hint")}</p>

        <div class="print-groups">
          <fieldset class="print-group">
            <legend>{ui("paper.scope")}</legend>
            <label class="field">
              <select value={scope} onChange={(e) => setScope(e.currentTarget.value as Scope)}>
                <option value="entry" disabled={!selectedEntry.value}>
                  {ui("paper.scope.entry")}
                </option>
                <option value="selection" disabled={selection.value.length === 0}>
                  {ui("paper.scope.selection", { n: selection.value.length })}
                </option>
                <option value="kind">{ui("paper.scope.kind")}</option>
                <option value="pack">{ui("paper.scope.pack")}</option>
              </select>
            </label>
            {scope === "kind" && (
              <label class="field">
                <select value={group} onChange={(e) => setGroup(e.currentTarget.value)}>
                  <option value="">{ui("form.none")}</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {scope === "pack" && (
              <label class="check">
                <input
                  type="checkbox"
                  checked={titlePage}
                  onChange={(e) => setTitlePage(e.currentTarget.checked)}
                />
                <span>{ui("paper.titlePage")}</span>
              </label>
            )}
            <label class="check">
              <input
                type="checkbox"
                checked={sections}
                onChange={(e) => setSections(e.currentTarget.checked)}
              />
              <span>{ui("paper.sections")}</span>
            </label>
          </fieldset>

          <fieldset class="print-group">
            <legend>{ui("paper.format")}</legend>
            <label class="field">
              <select value={format} onChange={(e) => setFormat(e.currentTarget.value as Format)}>
                <option value="booklet">{ui("paper.format.booklet")}</option>
                <option value="cards">{ui("paper.format.cards")}</option>
                <option value="markdown">{ui("paper.format.markdown")}</option>
              </select>
            </label>
            {format !== "markdown" && (
              <>
                <label class="field">
                  <span>{ui("print.paper")}</span>
                  <select
                    value={settings.paper}
                    onChange={(e) => updatePrintSettings({ paper: e.currentTarget.value as Paper })}
                  >
                    <option value="a4">{ui("print.paperA4")}</option>
                    <option value="letter">{ui("print.paperLetter")}</option>
                  </select>
                </label>
                <label class="check">
                  <input
                    type="checkbox"
                    checked={settings.lowInk}
                    onChange={(e) => updatePrintSettings({ lowInk: e.currentTarget.checked })}
                  />
                  <span>{ui("print.lowInk")}</span>
                </label>
              </>
            )}
          </fieldset>

          <fieldset class="print-group">
            <legend>{ui("paper.output")}</legend>
            {format === "markdown" ? (
              <div class="hq-outputs">
                <button
                  type="button"
                  class="primary"
                  disabled={nothing}
                  onClick={() => download(fileName(record), markdown)}
                >
                  {ui("paper.download")}
                </button>
                <button
                  type="button"
                  disabled={nothing}
                  onClick={() => {
                    void navigator.clipboard?.writeText(markdown).then(() => setCopied(true));
                    setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? ui("paper.copied") : ui("paper.copy")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                class="primary"
                disabled={nothing}
                onClick={() => window.print()}
              >
                {ui("print.print")}
              </button>
            )}
          </fieldset>
        </div>
      </div>

      {nothing ? (
        <p class="muted no-print">{ui("paper.nothing")}</p>
      ) : format === "markdown" ? (
        <textarea
          class="hq-markdown no-print"
          readOnly
          value={markdown}
          aria-label={ui("paper.format.markdown")}
        />
      ) : (
        <div class="paper-scroll">
          <div class="paper">
            {format === "booklet" ? (
              <Booklet docs={docs} sections={sections && scope !== "entry"} />
            ) : (
              <CardSheet docs={docs} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
