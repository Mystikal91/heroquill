"""Reads the official SRD 5.2.1 PDFs (it, fr, de, es) as lines with their typography.

The books are laid out like the English one: two columns, headings in a sans face (GillSans, SemiBold) and
body text in Cambria, where a run-in heading is bold ("Can't See.") and a paragraph opens with an indented
line. `book_lines` returns one record per line, in reading order:

  {"text": "**Cannot See.** ...", "tab": True|False, "head": size or 0, "page": n}

`head` is the size of a heading line (the sans face), 0 for body text. A bold run inside body text is
wrapped in `**`, the way the English texts of the app write it. Words broken at a line end are joined (soft
hyphen, or a hyphen before a lowercase letter, as `import_spells52` does).

Usage: python book52.py it .cache/srd52/pdf/IT_SRD_CC_v5.2.1.pdf   (writes the .cache/srd52/pdf/IT.book.txt dump)
"""

from __future__ import annotations

import collections
import functools
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PDFS = {"it": "IT", "fr": "FR", "de": "DE", "es": "SP"}
NOISE = re.compile(
    r"^(\d{1,3}$|System Reference Document|Syst.me de r.f.rence|Document de R.f.rence|Systemreferenzdokument"
    r"|Documento de referencia del sistema)"
)


def pdf_path(lang: str) -> Path:
    return ROOT / ".cache" / "srd52" / "pdf" / f"{PDFS[lang]}_SRD_CC_v5.2.1.pdf"


def _line_text(spans: list[dict]) -> tuple[str, int]:
    """The text of a line with bold runs marked, and the heading size (0 for body text)."""
    first = next((s for s in spans if s["text"].strip()), spans[0])
    sans = "GillSans" in first["font"] or "Gill" in first["font"]
    if sans:
        return "".join(s["text"] for s in spans), round(first["size"])
    out = ""
    bold = False
    for s in spans:
        text = s["text"]
        is_bold = "Bold" in s["font"]
        if is_bold and not bold:
            lead = len(text) - len(text.lstrip())
            out += text[:lead] + "**" + text[lead:]
            bold = True
        elif not is_bold and bold:
            lead = len(out) - len(out.rstrip())
            out = out[: len(out) - lead] + "**" + out[len(out) - lead :] + text
            bold = False
        else:
            out += text
    if bold:
        trail = len(out) - len(out.rstrip())
        out = out[: len(out) - trail] + "**" + out[len(out) - trail :]
    return out, 0


def book_lines(pdf: Path) -> list[dict]:
    import pymupdf

    raw: list[dict] = []
    for number, page in enumerate(pymupdf.open(pdf), 1):
        rows = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text, head = _line_text(line["spans"])
                if text.strip() and not NOISE.match(text.strip()):
                    ink = [s for s in line["spans"] if s["text"].strip()]
                    italic = bool(ink) and all("Italic" in s["font"] and "Bold" not in s["font"] for s in ink)
                    rows.append(
                        (line["bbox"][0] > page.rect.width / 2 - 5, line["bbox"][0], line["bbox"][1], text, head, italic)
                    )
        # The left edge of the text of a column is where most of its body lines start (a paragraph opens
        # with an indented line); the lowest x of the column can be a table or a rule.
        edge = {}
        for col in (False, True):
            xs = [round(x) for c, x, _y, _t, h, _i in rows if c == col and not h]
            xs = xs or [round(x) for c, x, *_ in rows if c == col]
            if xs:
                edge[col] = collections.Counter(xs).most_common(1)[0][0]
        for col, x, _y, text, head, italic in rows:
            raw.append({"text": text.rstrip(), "tab": x - edge[col] > 4, "head": head, "page": number, "italic": italic})
    merged: list[dict] = []
    for line in raw:
        prev = merged[-1] if merged else None
        if (
            prev
            and not prev["head"]
            and not line["head"]
            and (prev["text"].endswith("­") or re.search(r"[^\W\d_]-$", prev["text"]))
            and re.match(r"^[a-zà-ÿ]", line["text"])
        ):
            merged.pop()
            fragment = re.search(r"[^\W\d_]*-?$", prev["text"][:-1])
            keep = prev["text"].endswith("-") and len(fragment.group(0).replace("-", "")) <= 2 and "-" in prev["text"][:-1]
            joined = (prev["text"] if keep else prev["text"][:-1]) + line["text"]
            merged.append({**prev, "text": joined})
        else:
            merged.append(line)
    for line in merged:
        line["text"] = line["text"].replace("­", "")
    return merged


def paragraphs(lines: list[dict]) -> list[dict]:
    """Lines joined into paragraphs: a heading line is its own paragraph, an indented line opens one."""
    out: list[dict] = []
    for line in lines:
        text = line["text"].strip()
        if line["head"]:
            if out and out[-1]["head"] == line["head"] and out[-1]["page"] == line["page"] and not out[-1].get("closed"):
                out[-1]["text"] += " " + text
            else:
                out.append({"text": text, "head": line["head"], "page": line["page"]})
            continue
        if out and not out[-1]["head"]:
            out[-1].pop("closed", None)
        if line["tab"] or not out or out[-1]["head"]:
            out.append({"text": text, "head": 0, "page": line["page"]})
        else:
            out[-1]["text"] += " " + text
    return out


def sections(lines: list[dict]) -> list[dict]:
    """The book as sections: {head: size, title, page, lines: [body lines]}.

    A heading of size 12 or more opens a section (two headings of the same size in a row, with no body
    between, are one title that wrapped). The small sans lines (table cells, field lines, 11 and under) stay
    in the body with `head` set so a reader can tell them from the text.
    """
    out: list[dict] = [{"head": 99, "title": "", "page": 0, "lines": []}]
    for line in lines:
        if line["head"] >= 12:
            prev = out[-1]
            if not prev["lines"] and prev["head"] == line["head"] and prev["page"] == line["page"]:
                prev["title"] += " " + line["text"].strip()
            else:
                out.append({"head": line["head"], "title": line["text"].strip(), "page": line["page"], "lines": []})
        else:
            out[-1]["lines"].append(line)
    return out


def text_of(lines: list[dict], bold: bool = True) -> str:
    """Body lines as the app writes them: a paragraph for each indented line, joined with a newline.

    The sans lines (tables, field lines) are left out; use `book_lines` directly for those. A bullet starts a
    paragraph "• item" (the English texts write lists that way) and the indented lines under it continue it.
    `bold=False` drops the markers of the bold run-ins, as the English texts of features and traits have none.
    """
    paras: list[str] = []
    in_list = False
    after_italic = False  # a line in italics (a prerequisite, a cost) is a paragraph of its own
    for line in lines:
        if line["head"]:
            continue
        text = line["text"].strip()
        if after_italic and not line.get("italic"):
            paras.append(text)
            in_list = False
            after_italic = False
            continue
        after_italic = bool(line.get("italic"))
        if text.startswith("**") and paras and re.search(r"\*\*[^*]*[^.:\s*]\*\*$", paras[-1]):
            # a bold name that wraps: this line has the end of the name, it does not open a new run-in
            paras[-1] += " " + text
            in_list = False
        elif text.startswith("•"):
            paras.append("• " + text[1:].strip())
            in_list = True
        elif in_list and line["tab"] and not text.startswith("**"):
            paras[-1] += " " + text
        elif line["tab"] or not paras or in_list or text.startswith("**"):  # a bold run-in always opens a paragraph
            paras.append(text)
            in_list = False
        else:
            paras[-1] += " " + text
    out = "\n".join(paras)
    out = out.replace(" ", " ").replace("‑", "-")
    out = re.sub(r"\*\*\s*\*\*", lambda m: " " if " " in m.group(0) else "", out)  # a run-in heading that wrapped
    if not bold:
        out = out.replace("**", "")
    return out.strip()


@functools.lru_cache(maxsize=None)
def _plain(text: str) -> str:
    import unicodedata

    t = unicodedata.normalize("NFKD", text.lower().replace("’", "'"))
    return "".join(c for c in t if not unicodedata.combining(c))


_TERMS: dict[str, list[tuple[str, str]]] = {}


def terms(lang: str) -> list[tuple[str, str]]:
    """(English name, translated name) of what the books name the same way: spells, conditions, skills, abilities.

    Used to pair a translated text with its English one: a text that mentions Misty Step must be
    the one that mentions the translated name of Misty Step.
    """
    import json

    if lang not in _TERMS:
        pairs: list[tuple[str, str]] = []
        for kind in ("spells", "conditions", "skills", "abilities", "schools"):
            try:
                en = json.loads((ROOT / f"locales/en/srd52/{kind}.json").read_text(encoding="utf-8"))
                tr = json.loads((ROOT / f"locales/{lang}/srd52/{kind}.json").read_text(encoding="utf-8"))
            except FileNotFoundError:
                continue
            pairs += [(_plain(en[k]), _plain(tr[k])) for k in en if k.endswith(".name") and tr.get(k)]
        _TERMS[lang] = [(a, b) for a, b in pairs if len(a) > 3]
    return _TERMS[lang]


def term_hits(english: str, translated: str, lang: str) -> int:
    """How many named terms of the English text are found, translated, in the other text."""
    e, t = _plain(english), _plain(translated)
    return sum(1 for a, b in terms(lang) if a in e and b in t)


def term_misses(english: str, translated: str, lang: str) -> int:
    """How many named terms of the English text are NOT found, translated, in the other text."""
    e, t = _plain(english), _plain(translated)
    return sum(1 for a, b in terms(lang) if a in e and b not in t)


@functools.lru_cache(maxsize=None)
def numbers(text: str, english: bool = False):
    """The numbers of a text as a Counter, so English and translated texts compare.

    The translated books are metric: 30 feet is 9 m, 5 feet is 1.5 m (written with a comma in some
    languages). An English number followed by feet is converted the same way, a decimal comma becomes
    a point and a trailing .0 goes.
    """
    from collections import Counter

    def norm(value: float) -> str:
        s = f"{value:.2f}".rstrip("0").rstrip(".")
        return s

    out: Counter = Counter()
    if english:
        for m in re.finditer(r"(\d[\d,]*(?:\.\d+)?)(?=[- ]?(?:feet|foot|ft))", text):
            out[norm(float(m.group(1).replace(",", "")) * 0.3)] += 1
        text = re.sub(r"(\d[\d,]*(?:\.\d+)?)(?=[- ]?(?:feet|foot|ft))", "", text)
        for m in re.finditer(r"\d+(?:\.\d+)?", text):
            out[norm(float(m.group(0)))] += 1
    else:
        for m in re.finditer(r"\d+(?:[.,]\d+)?", text):
            out[norm(float(m.group(0).replace(",", ".")))] += 1
    return out


def number_gap(english: str, translated: str) -> int:
    """How many numbers differ between an English text and a translated one (a bag of numbers each)."""
    a, b = numbers(english, True), numbers(translated)
    return sum((a - b).values()) + sum((b - a).values())


if __name__ == "__main__":
    lang = sys.argv[1]
    lines = book_lines(Path(sys.argv[2]) if len(sys.argv) > 2 else pdf_path(lang))
    target = ROOT / ".cache" / "srd52" / "pdf" / f"{PDFS[lang]}.book.txt"
    with open(target, "w", encoding="utf-8") as f:
        for l in lines:
            f.write(f"{l['page']}|{'#' + str(l['head']) + ' ' if l['head'] else ''}{chr(9) if l['tab'] else ''}{l['text']}\n")
    print(len(lines), "lines ->", target)
