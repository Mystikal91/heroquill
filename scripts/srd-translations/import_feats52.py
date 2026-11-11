"""Translations of the feats of the SRD 5.2.1 from the official books (it, fr, de, es).

The feats chapter is a run of sections of size 12 (one per feat) under headings of size 14 (Origin, General,
Fighting Style, Epic Boon). Each feat opens with a category line, which may carry a prerequisite in
brackets and wrap; the English text of the app has none, so it is dropped. The books sort the feats
alphabetically in their language, so they are paired with the English ones by the shape of the text
(bold run-ins, numbers, length). The pairing is made in every language and compared: a feat the languages
do not agree on is reported.

Usage: python import_feats52.py [it fr de es]
"""

from __future__ import annotations

import collections
import json
import math
import re
import sys

import book52
from import_spells import hungarian

ROOT = book52.ROOT


def parse(lang: str) -> list[dict]:
    secs = book52.sections(book52.book_lines(book52.pdf_path(lang)))

    def category(i: int) -> str:
        s = secs[i]
        return s["lines"][0]["text"].strip() if s["head"] == 12 and s["lines"] else ""

    # The Origin feats open the chapter: three or more in a row with the same category line.
    # (Other runs of sections have the same shape in the class chapters: the one with 17 feats is the chapter.)
    for first in (i for i in range(len(secs) - 2) if category(i) and category(i) == category(i + 1) == category(i + 2)):
        out = []
        group = 0
        for s in secs[first:]:
            if s["head"] >= 18:
                break
            if s["head"] == 14:
                group += 1  # Origin, General, Fighting Style, Epic Boon
            if s["head"] != 12:
                continue
            lines = list(s["lines"])
            # The category line, and the rest of its brackets when it wraps.
            depth = 0
            while lines:
                t = lines.pop(0)["text"]
                depth += t.count("(") - t.count(")")
                if depth <= 0:
                    break
            out.append({"name": s["title"], "desc": book52.text_of(lines), "group": max(group, 0)})
        if len(out) == 17:
            return out
    raise SystemExit(f"{lang}: the feats chapter was not found")


def shape(text: str) -> tuple:
    return (text.count("**") // 2, tuple(sorted(re.findall(r"\d+", text))), len(text))


CATEGORIES = ["origin", "general", "fighting-style", "epic-boon"]


def pair(lang: str, parsed: list[dict], english: dict[str, str]) -> dict[str, dict]:
    """Pair inside each category (the books keep the four groups), by shape and by the terms they name."""
    cats = {
        e["id"].split("/")[1]: e["data"]["category"]
        for e in json.loads((ROOT / "data/srd52/feats.json").read_text(encoding="utf-8"))["entries"]
    }
    out: dict[str, dict] = {}
    for g, cat in enumerate(CATEGORIES):
        slugs = [s for s in cats if cats[s] == cat]
        group = [p for p in parsed if p["group"] == g]
        if len(group) != len(slugs):
            raise SystemExit(f"{lang}: {len(group)} feats in group {cat}, expected {len(slugs)}: {[p['name'] for p in group]}")

        def cost(p: dict, s: str) -> float:
            a, b = shape(p["desc"]), shape(english[f"{s}.desc"])
            return (
                abs(a[0] - b[0]) * 6
                + book52.number_gap(english[f"{s}.desc"], p["desc"]) * 3
                + abs(math.log((a[2] + 20) / (b[2] + 20))) * 5
                - book52.term_hits(english[f"{s}.desc"], p["desc"], lang) * 8
                + book52.term_misses(english[f"{s}.desc"], p["desc"], lang) * 4
            )

        for p, j in zip(group, hungarian([[cost(p, s) for s in slugs] for p in group])):
            out[slugs[j]] = p
    return out


def run(langs: list[str]) -> None:
    english = json.loads((ROOT / "locales/en/srd52/feats.json").read_text(encoding="utf-8"))
    results = {}
    for lang in langs:
        parsed = parse(lang)
        slugs = [k for k in english if k.endswith(".desc")]
        if len(parsed) != len(slugs):
            raise SystemExit(f"{lang}: {len(parsed)} feats parsed, {len(slugs)} expected: {[p['name'] for p in parsed]}")
        results[lang] = pair(lang, parsed, english)
    for lang, matched in results.items():
        out = {}
        for slug, p in sorted(matched.items()):
            out[f"{slug}.name"] = p["name"]
            out[f"{slug}.desc"] = p["desc"]
        target = ROOT / f"locales/{lang}/srd52/feats.json"
        target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(lang, len(matched), ", ".join(f"{s}={p['name']}" for s, p in sorted(matched.items())))


if __name__ == "__main__":
    run(sys.argv[1:] or ["it", "fr", "de", "es"])
