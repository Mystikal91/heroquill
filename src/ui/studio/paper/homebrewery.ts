import type { Block, EntryDoc } from "./blocks";

/**
 * The text of a document for Homebrewery (homebrewery.naturalcrit.com): its Markdown, with `\page`
 * between pages and the habits of the site for spells, tables and stat blocks, so that pasting it in
 * gives a document ready to print. Nothing is sent anywhere: the person pastes or opens the file.
 */

const clean = (text: string) => text.replace(/\r/g, "").trim();

/** A table cell cannot hold a line break or a bar. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

function blockText(block: Block, level: number): string {
  switch (block.t) {
    case "subtitle":
      return `*${block.text}*`;
    case "facts":
      return block.rows.map(([label, value]) => `**${label}:** ${value}  `).join("\n");
    case "para":
      return block.text;
    case "heading":
      return `${"#".repeat(Math.min(6, level + 1))} ${block.text}`;
    case "list":
      return block.items.map((item) => `- ${item}`).join("\n");
    case "table":
      return [
        `| ${block.head.map(cell).join(" | ")} |`,
        `|${block.head.map(() => ":--").join("|")}|`,
        ...block.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
      ].join("\n");
  }
}

/** One entry, with its title at the heading level it is given. */
export function entryMarkdown(doc: EntryDoc, level = 3): string {
  const lines = [`${"#".repeat(level)} ${doc.title}`];
  for (const block of doc.blocks) lines.push(blockText(block, level));
  return `${lines.map(clean).filter(Boolean).join("\n\n")}\n`;
}

/** A creature in the stat block frame Homebrewery draws, instead of plain paragraphs. */
export function monsterMarkdown(doc: EntryDoc): string {
  const body = doc.blocks
    .map((block) => {
      if (block.t === "subtitle") return `>*${block.text}*\n>___`;
      if (block.t === "facts")
        return `${block.rows.map(([l, v]) => `>- **${l}** ${v}`).join("\n")}\n>___`;
      if (block.t === "table") {
        return [
          `>|${block.head.join("|")}|`,
          `>|${block.head.map(() => ":-:").join("|")}|`,
          ...block.rows.map((row) => `>|${row.join("|")}|`),
          ">___",
        ].join("\n");
      }
      if (block.t === "heading") return `>### ${block.text}`;
      if (block.t === "list") return block.items.map((i) => `>- ${i}`).join("\n");
      return `>${block.text}`;
    })
    .join("\n");
  return `___\n___\n> ## ${doc.title}\n${body}\n`;
}

export interface Pack {
  name: string;
  author?: string | undefined;
  description?: string | undefined;
  version?: string | undefined;
}

export interface MarkdownOptions {
  /** A title page with the name, author and description of the pack. */
  titlePage: boolean;
  /** A page for each section (spells, items...) instead of one running text. */
  sections: boolean;
}

/** The whole document: an optional title page, then the entries grouped by section. */
export function toHomebrewery(docs: EntryDoc[], pack: Pack, options: MarkdownOptions): string {
  const parts: string[] = [];
  if (options.titlePage) {
    const lines = [`# ${pack.name}`];
    if (pack.author) lines.push(`*${pack.author}*`);
    if (pack.version) lines.push(`Version ${pack.version}`);
    if (pack.description) lines.push(pack.description);
    parts.push(lines.join("\n\n"));
  }
  const groups = new Map<string, EntryDoc[]>();
  for (const doc of docs) groups.set(doc.group, [...(groups.get(doc.group) ?? []), doc]);
  for (const [group, list] of groups) {
    const body = list
      .map((d) => (d.kind === "monster" ? monsterMarkdown(d) : entryMarkdown(d, 3)))
      .join("\n");
    parts.push(options.sections ? `## ${group}\n\n${body}` : body);
  }
  return `${parts.join("\n\\page\n\n")}\n`;
}
