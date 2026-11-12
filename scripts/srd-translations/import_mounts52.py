"""Names of the mounts, vehicles, saddles and feed of the SRD 5.2.1 from the tables of the official books.

The tables are laid out as rows of cells, so the sans lines of a page are grouped by their height. A row has a
name first and a price last; the cell between gives the carrying capacity (mounts), the weight (drawn vehicles,
saddles, feed) or the speed (ships), in metric units. An English entry is found by that pair of numbers: the price,
and the capacity or weight in kilograms (a pound is half a kilogram) or the speed in km/h (1 mph is 1.5 km/h).
A saddle is a name with its kinds under it ("Saddle" / "Riding"), written here "Saddle (Riding)" as in the data.

Usage: python import_mounts52.py [it fr de es]
"""

from __future__ import annotations

import json
import re
import sys

import book52

ROOT = book52.ROOT
PRICE = re.compile(r"^(\d[\d.,  ]*)\s*[^\W\d_]{1,3}\.?$")
UNIT = re.compile(r"^(\d[\d.,  ]*)\s*(kg|km/h|km/u)\b", re.I)


def number(text: str) -> float:
    t = text.replace(" ", "").replace(" ", "")
    if re.fullmatch(r"\d{1,3}(\.\d{3})+", t):
        t = t.replace(".", "")
    return float(t.replace(",", "."))


def rows(lang: str) -> list[dict]:
    import pymupdf

    out = []
    for pno, page in enumerate(pymupdf.open(book52.pdf_path(lang)), 1):
        by_y: dict[int, list[tuple[float, str]]] = {}
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                spans = [s for s in l["spans"] if s["text"].strip()]
                if spans and "Gill" in spans[0]["font"] and spans[0]["size"] < 10.5:
                    by_y.setdefault(round(l["bbox"][1] / 3), []).append((l["bbox"][0], "".join(s["text"] for s in l["spans"]).strip()))
        last_parent, parent_x = None, 0.0
        for y in sorted(by_y):
            cells = [t for _, t in sorted(by_y[y])]
            if len(cells) == 1 and not PRICE.match(cells[0]) and not UNIT.match(cells[0]):
                last_parent, parent_x = cells[0], min(x for x, _ in by_y[y])  # a name with its kinds under it (the saddles)
                continue
            if len(cells) >= 2 and PRICE.match(cells[-1]):
                name = cells[0]
                if not re.match(r"^\d", name) and not PRICE.match(name):
                    x = min(x for x, _ in by_y[y])
                    sub = bool(last_parent) and 4 < x - parent_x < 25  # indented under the name: a kind of it
                    if not sub:
                        last_parent = None
                    out.append({"page": pno, "name": name, "cells": cells[1:], "parent": last_parent if sub else None, "x": x})
    return out


def run(lang: str) -> None:
    items = json.loads((ROOT / "scripts/srd52/supplement/mounts-and-vehicles.json").read_text(encoding="utf-8"))
    found = rows(lang)
    out, left = {}, []
    unit = {"gp": 1, "sp": 0.1, "cp": 0.01}
    for e in items:
        price = e["cost"]["quantity"] * unit[e["cost"]["unit"]]
        # the key of the row besides the price: kg or km/h as the book prints it
        if "capacity" in e:
            want = float(re.sub(r"[^\d.]", "", e["capacity"].split()[0].replace(",", ""))) / 2
            kind = "kg"
        elif "weight" in e and "speed" not in e:
            want, kind = e["weight"] / 2, "kg"
        elif "speed" in e:
            want, kind = e["speed"]["quantity"] * 1.5, "km/h"
        else:
            continue
        hits = []
        for r in found:
            cells = r["cells"]
            m = next((UNIT.match(c) for c in cells if UNIT.match(c)), None)
            if not m or m.group(2).lower().replace("km/u", "km/h") != kind:
                continue
            value = number(m.group(1))
            # the books round a speed in their own way: 4 mph is 6, 6.4 or 4 km/h; a weight is exact
            if (kind == "km/h" and not 0.9 * want <= value <= 1.75 * want) or (kind == "kg" and abs(value - want) > 1e-6):
                continue
            p = PRICE.match(cells[-1])
            if p and abs(number(p.group(1)) - e["cost"]["quantity"]) < 1e-6:
                hits.append((abs(value - want), r))
        # ships with the same price (the sailing ship and the longship): the speed nearest to the conversion wins
        if hits and kind == "km/h":
            best = min(d for d, _ in hits)
            hits = [(d, r) for d, r in hits if d - best < 1e-6]
        hits = [r for _, r in hits]
        # a kind of saddle: "Saddle (Riding)", unless the kind already says it ("Reitsattel")
        names = {
            (h["parent"] + " (" + h["name"] + ")") if h["parent"] and h["parent"].lower()[:4] not in h["name"].lower() else h["name"]
            for h in hits
        }
        if len(names) > 1 and sum("(" in n for n in names) == 1:
            names = {n for n in names if "(" in n}  # the feed ("per day") against the chain with the same price and weight
        if len(names) == 1:
            out[f"{e['index']}.name"] = names.pop()
        else:
            left.append((e["index"], sorted(names)))
    target = ROOT / f"locales/{lang}/srd52/items.json"
    tr = json.loads(target.read_text(encoding="utf-8"))
    tr.update(out)
    target.write_text(json.dumps(tr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(out), "of", len(items), "names;", "not found or ambiguous:", left)
    print("  ", ", ".join(f"{k[:-5]}={v}" for k, v in out.items()))


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
