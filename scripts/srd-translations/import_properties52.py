"""Weapon properties and mastery properties of the SRD 5.2.1 from the official books (it, fr, de, es).

The weapons chapter has a heading of size 14 for the properties (ten sections of size 12) and another for the
mastery properties (eight). The books sort them alphabetically in their language, so each group is paired with the
English one by the shape of the text (numbers, length, named terms), as `import_properties.py` did with a glossary
for 5.1.

Usage: python import_properties52.py [it fr de es]
"""

from __future__ import annotations

import json
import math
import sys

import book52
from import_properties import GLOSSARY
from import_reference import key
from import_species52 import assign

ROOT = book52.ROOT


def groups(lang: str) -> list[list[dict]]:
    secs = book52.sections(book52.book_lines(book52.pdf_path(lang)))
    found = []
    for i, s in enumerate(secs):
        if s["head"] != 14:
            continue
        kids = []
        for t in secs[i + 1 :]:
            if t["head"] != 12:
                break
            kids.append(t)
        found.append(kids)
    for a, b in zip(found, found[1:]):
        if len(a) == 10 and len(b) == 8:
            return [a, b]
    raise SystemExit(f"{lang}: the property sections were not found")


def weapon_blobs(lang: str) -> dict[str, str]:
    """name of a weapon in the table -> the text of its row (properties, mastery, weight, price), without accents."""
    import re

    from import_reference import plain

    lines = book52.book_lines(book52.pdf_path(lang))
    blobs = {}
    for i, l in enumerate(lines[:-1]):
        if l["head"] in (9, 10) and re.match(r"^\d+\s?[dDwW]\s?\d+", lines[i + 1]["text"].strip()):
            row = []
            for x in lines[i : i + 10]:
                row.append(x["text"].strip())
                if re.match(r"^\d[\d.,]*\s*(?!kg|lb)[^\d\s]{1,3}$", x["text"].strip()) and len(row) > 3:
                    break
            blobs[plain(l["text"].strip().lower())] = plain(" ".join(row).lower())
    return blobs


def by_votes(lang: str, titles: list[str], slugs: list[str], kind: str) -> dict[str, str]:
    """slug -> title, by the weapons of the table: a property or mastery is what its weapons' rows name."""
    from import_reference import plain

    items = json.loads((ROOT / "data/srd52/items.json").read_text(encoding="utf-8"))["entries"]
    names_path = ROOT / f"locales/{lang}/srd52/items.json"
    names = json.loads(names_path.read_text(encoding="utf-8")) if names_path.exists() else {}
    blobs = weapon_blobs(lang)
    having: dict[str, set[str]] = {s: set() for s in slugs}
    weapons = {}
    for e in items:
        w = e["data"].get("weapon")
        slug = e["id"].split("/")[1]
        if not w or f"{slug}.name" not in names:
            continue
        blob = blobs.get(plain(names[f"{slug}.name"].lower()))
        if blob is None:
            continue
        weapons[slug] = blob
        prop_slugs = [p.split("/")[1] for p in w.get("properties", [])] + ([w["mastery"].split("/")[1]] if w.get("mastery") else [])
        for p in prop_slugs:
            if p in having:
                having[p].add(slug)
    matrix = []
    for t in titles:
        pt = plain(t.lower())
        in_rows = {w for w, blob in weapons.items() if pt in blob}
        matrix.append([len(in_rows & having[s]) * 3 - len(in_rows - having[s]) * 3 - len(having[s] - in_rows) for s in slugs])
    size = max(len(titles), len(slugs))
    cost = [[-(matrix[r][c]) if r < len(titles) and c < len(slugs) else 0 for c in range(size)] for r in range(size)]
    from import_spells import hungarian

    out = {}
    for r, c in enumerate(hungarian(cost)):
        if r < len(titles) and c < len(slugs) and matrix[r][c] > 0 and having[slugs[c]]:
            out[slugs[c]] = titles[r]
    return out


def run(lang: str) -> None:
    en = json.loads((ROOT / "locales/en/srd52/properties.json").read_text(encoding="utf-8"))
    slugs = [k[:-5] for k in en if k.endswith(".name")]
    sets = [[s for s in slugs if not s.startswith("mastery-")], [s for s in slugs if s.startswith("mastery-")]]
    out = {}
    for kids, wanted in zip(groups(lang), sets):
        texts = [book52.text_of(k["lines"], bold=False) for k in kids]
        voted = by_votes(lang, [k["title"] for k in kids], wanted, "")
        # What the 5.1 importer already knows (a glossary written from the 5.1 books) wins over the vote, which
        # cannot tell a property no weapon lists (Range) from the one every ranged weapon names (Ammunition).
        for title_key, slug in GLOSSARY.get(lang, {}).items():
            match = [k["title"] for k in kids if key(k["title"]) == title_key]
            if slug in wanted and match:
                voted = {s: t for s, t in voted.items() if s != slug and t != match[0]}
                voted[slug] = match[0]
        for slug, title in voted.items():
            j = next(i for i, k in enumerate(kids) if k["title"] == title)
            out[f"{slug}.name"] = title
            out[f"{slug}.desc"] = texts[j]
        # what the rows of the table could not settle is paired by the shape of the text
        wanted = [s for s in wanted if s not in voted]
        taken = {t for t in voted.values()}
        keep = [i for i, k in enumerate(kids) if k["title"] not in taken]
        kids = [kids[i] for i in keep]
        texts = [texts[i] for i in keep]
        if not wanted:
            continue

        def cost(t: str, slug: str) -> float:
            e = en[f"{slug}.desc"]
            return (
                book52.number_gap(e, t) * 3
                + abs(math.log((len(t) + 30) / (len(e) + 30))) * 5
                - book52.term_hits(e, t, lang) * 6
            )

        for slug, j in zip(wanted, assign([[cost(t, s) for t in texts] for s in wanted])):
            if j is not None:
                out[f"{slug}.name"] = kids[j]["title"]
                out[f"{slug}.desc"] = texts[j]
    (ROOT / f"locales/{lang}/srd52/properties.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(out) // 2, "properties:", ", ".join(f"{s}={out[s + '.name']}" for s in slugs if f"{s}.name" in out))


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
