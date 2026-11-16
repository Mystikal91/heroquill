// A small Markdown reader for the technical pages (docs/PACK_FORMAT.md): the parts of Markdown those
// pages use, turned into HTML for the site. It knows headings, paragraphs, lists, tables, fenced code,
// inline code, bold, italics and links; anything else is shown as text. Headings get the same ids
// GitHub gives them (lower case, punctuation dropped, `-1` on repeats), so a link written for the page on
// GitHub works on the site too.

const escapeHtml = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text) => escapeHtml(text).replace(/"/g, "&quot;");

/** The id GitHub gives a heading. */
const slugOf = (text) =>
  text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

/** Inline Markdown: code first (so nothing inside it is read), then links, bold and italics. */
function inline(text) {
  const parts = text.split(/(`[^`]*`)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return `<code>${escapeHtml(part.slice(1, -1).replace(/\\\|/g, "|"))}</code>`;
      let out = escapeHtml(part.replace(/\\\|/g, "|"));
      out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
        const external = /^https?:/.test(href);
        return `<a href="${escapeAttr(href)}"${external ? ' rel="noopener"' : ""}>${label}</a>`;
      });
      out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      out = out.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?![*\w])/g, "$1<em>$2</em>");
      return out;
    })
    .join("");
}

/** The cells of a table row, splitting on pipes that are not escaped. */
const cellsOf = (line) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

/**
 * Turns Markdown into HTML and lists the headings.
 * @returns {{ html: string, headings: { level: number, id: string, text: string }[], title: string }}
 */
export function renderMarkdown(source) {
  const lines = source.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const html = [];
  const headings = [];
  const seen = new Map();
  let title = "";
  let i = 0;

  const unique = (base) => {
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}-${n}`;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    // fenced code
    const fence = /^```(\w*)/.exec(line);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      html.push(
        `<pre><code${fence[1] ? ` class="lang-${fence[1]}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`,
      );
      continue;
    }

    // headings
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const plain = text.replace(/`/g, "");
      if (level === 1 && !title) title = plain;
      const id = unique(slugOf(text));
      headings.push({ level, id, text: plain });
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // tables
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const head = cellsOf(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cellsOf(lines[i++]));
      html.push(
        `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((row) => `<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }

    // lists, with continuation lines indented under an item
    const list = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[2]);
      const items = [];
      while (i < lines.length) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        if (m && m[1].length === list[1].length) {
          items.push([m[3]]);
          i++;
        } else if (items.length > 0 && /^\s+\S/.test(lines[i]) && !m) {
          items[items.length - 1].push(lines[i].trim());
          i++;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(
        `<${tag}>${items.map((it) => `<li>${inline(it.join(" "))}</li>`).join("")}</${tag}>`,
      );
      continue;
    }

    // a paragraph: lines up to the next blank line or block
    const para = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6}\s|```|\s*\|)/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i])
    )
      para.push(lines[i++].trim());
    html.push(`<p>${inline(para.join(" "))}</p>`);
  }

  return { html: html.join("\n"), headings, title };
}
