"""Names and descriptions of the equipment of the SRD 5.2.1 (weapons, armor, tools, gear) from the official books.

It builds on the 5.1 work: the 5.1 translations of the same item (same slug) are the starting names, and a name is
kept only when the 5.2.1 book writes it (so a name the 2024 edition changed stays English until it is read).
The descriptions are the sections "Name (price)" of the equipment chapter, which have the price of the item
in brackets; they are paired with the English items that have a description by the price, the numbers, the
named terms and the likeness of the name to the 5.1 one (the method of `import_equipment_texts.py`, which
paired by the translated name; here the names are what is being found).

Usage: python import_equipment52.py [it fr de es]
"""

from __future__ import annotations

import json
import math
import re
import sys

import book52
from import_magic_items import dice, grams
from import_reference import plain
from import_species52 import assign

ROOT = book52.ROOT
TITLE = re.compile(r"^(.*?)\s*\((\d[\d.,]*)\s*([^\d)]+?)\)\s*$")


def book_text(lang: str) -> str:
    return plain(" ".join(l["text"].replace("**", "") for l in book52.book_lines(book52.pdf_path(lang))).lower())


def sections(lang: str) -> list[dict]:
    out = []
    for s in book52.sections(book52.book_lines(book52.pdf_path(lang))):
        m = TITLE.match(s["title"])
        if s["head"] == 12 and m and s["lines"]:
            out.append(
                {
                    "name": m.group(1).strip(),
                    "price": m.group(2).replace(",", ".").rstrip("."),
                    "desc": book52.text_of(s["lines"], bold=False),
                }
            )
    return out


def run(lang: str) -> None:
    data = json.loads((ROOT / "data/srd52/items.json").read_text(encoding="utf-8"))["entries"]
    en = json.loads((ROOT / "locales/en/srd52/items.json").read_text(encoding="utf-8"))
    old = json.loads((ROOT / f"locales/{lang}/srd51/items.json").read_text(encoding="utf-8"))
    items = [e for e in data if e["data"].get("category") != "magic-items"]
    secs = sections(lang)
    text = book_text(lang)
    out: dict[str, str] = {}

    # 1. descriptions: the sections with a price against the English items that have a description
    with_desc = [e["id"].split("/")[1] for e in items if f"{e['id'].split('/')[1]}.desc" in en]
    cost = {e["id"].split("/")[1]: e["data"].get("cost", {}).get("amount") for e in items}

    def score(sec: dict, slug: str) -> float:
        body = en[f"{slug}.desc"]
        hint = old.get(f"{slug}.name", "")
        price_ok = cost[slug] is not None and abs(float(sec["price"]) - cost[slug]) < 1e-6
        return (
            (0 if price_ok else 25)
            + book52.number_gap(body, sec["desc"]) * 3
            + abs(math.log((len(sec["desc"]) + 30) / (len(body) + 30))) * 4
            - book52.term_hits(body, sec["desc"], lang) * 6
            - (dice(grams(hint), grams(sec["name"])) * 40 if hint else 0)
        )

    cols = assign([[score(s, slug) for s in secs] for slug in with_desc])
    written_names = set()
    doubtful = []
    for slug, j in zip(with_desc, cols):
        if j is None:
            continue
        value = score(secs[j], slug)
        if value > 20:
            doubtful.append((slug, secs[j]["name"], round(value, 1)))
            continue
        out[f"{slug}.name"] = secs[j]["name"]
        out[f"{slug}.desc"] = secs[j]["desc"]
        written_names.add(slug)

    # 2. names of the rest: the 5.1 name, when the 5.2.1 book still writes it
    kept, dropped = 0, []
    for e in items:
        slug = e["id"].split("/")[1]
        if slug in written_names:
            continue
        name = old.get(f"{slug}.name")
        if name and plain(name.lower()) in text:
            out[f"{slug}.name"] = name
            kept += 1
        else:
            dropped.append(slug)

    target = ROOT / f"locales/{lang}/srd52/items.json"
    existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    existing.update(out)
    target.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{lang}: {len(secs)} sections, {len(written_names)} with a description, {kept} names from 5.1, {len(dropped)} left English")
    print("  left English:", dropped)
    print("  doubtful (left English):", doubtful)


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
