"""The variants of the traits of the SRD 5.2.1 that the data splits and the books do not: Divine Order, Primal Order and
the six benefits of Giant Ancestry, read from the official books (it, fr, de, es).

- `divine-order-*`, `primal-order-*`: the run-in paragraphs ("Protector.", "Thaumaturge.") of the level 1 feature of
  the Cleric and of the Druid; the English text is the paragraph alone.
- `giant-ancestry-*`: the six run-in paragraphs of the Goliath's Giant Ancestry trait; the English name and text
  start with "Giant Ancestry: ", so the book's trait name goes there.

Each is paired inside its group with the English one by the numbers, the length and the named terms. Writes only
keys that are still missing.

Usage: python fill_traits52.py [it fr de es]
"""

from __future__ import annotations

import json
import math
import re
import sys

import book52
import import_classes52 as classes
import import_species52 as species
from import_species52 import assign

ROOT = book52.ROOT


def pair(lang: str, found: list[dict], wanted: list[str], en: dict, strip_prefix: bool) -> dict[str, dict]:
    def body(slug: str) -> str:
        text = en[f"{slug}.desc"]
        return text.split("\n", 1)[1] if strip_prefix and "\n" in text else text

    def cost(f: dict, slug: str) -> float:
        e = body(slug)
        return (
            book52.number_gap(e, f["desc"]) * 3
            + abs(math.log((len(f["desc"]) + 30) / (len(e) + 30))) * 5
            - book52.term_hits(e, f["desc"], lang) * 6
        )

    cols = assign([[cost(f, s) for f in found] for s in wanted])
    return {s: found[j] for s, j in zip(wanted, cols) if j is not None and cost(found[j], s) < 14}


def orders(lang: str, en: dict) -> dict[str, tuple[str, str]]:
    parsed = classes.parse(lang)
    out = {}
    for cls, prefix, wanted in (("cleric", "divine-order", ["divine-order-protector", "divine-order-thaumaturge"]), ("druid", "primal-order", ["primal-order-warden", "primal-order-magician"])):
        for f in parsed[cls]["features"]:
            if f["level"] != 1:
                continue
            runs = []
            for p in book52.text_of(f["lines"], bold=True).split("\n"):
                m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", p)
                if m:
                    runs.append({"name": m.group(1).strip().rstrip(".:").strip(), "desc": m.group(2).replace("**", "").strip()})
                elif runs:
                    runs[-1]["desc"] += "\n" + p.replace("**", "")
            if len(runs) == 2:
                for slug, f2 in pair(lang, runs, wanted, en, False).items():
                    out[slug] = (f2["name"], f2["desc"])
    return out


def giants(lang: str, en: dict, base_name: str) -> dict[str, tuple[str, str]]:
    sp, _ = species.parse(lang)
    gl = max(sp, key=lambda s: sum("gigant" in t["name"].lower() or "riesen" in t["name"].lower() or "géant" in t["name"].lower() for t in s["traits"]) + (s["name"].lower().startswith(("goli",))))
    traits = [t for t in gl["traits"] if "\n" not in t["desc"] or True]
    wanted = [k[:-5] for k in en if k.startswith("giant-ancestry-") and k.endswith(".name")]
    found = [{"name": t["name"], "desc": t["desc"]} for t in traits]
    paired = pair(lang, found, wanted, en, True)
    return {s: (f"{base_name}: {f['name']}" if base_name else f["name"], f"{base_name}: {f['name']}\n{f['desc']}" if base_name else f["desc"]) for s, f in paired.items()}


def run(lang: str) -> None:
    en = json.loads((ROOT / "locales/en/srd52/traits.json").read_text(encoding="utf-8"))
    path = ROOT / f"locales/{lang}/srd52/traits.json"
    tr = json.loads(path.read_text(encoding="utf-8"))
    written = []
    for found in (orders(lang, en), giants(lang, en, tr.get("giant-ancestry.name", ""))):
        for slug, (name, desc) in found.items():
            if f"{slug}.name" not in tr:
                tr[f"{slug}.name"], tr[f"{slug}.desc"] = name, desc
                written.append(slug)
    path.write_text(json.dumps(tr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(written), "traits:", ", ".join(f"{s}={tr[s + '.name']}" for s in written))


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
