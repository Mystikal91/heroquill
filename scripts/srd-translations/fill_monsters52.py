"""Fills the monster entries the book pairing left out with the translation of the identical English entry elsewhere.

A trait or action that the SRD repeats word for word in several monsters (Spider Climb, Legendary Resistance,
Pounce, Forbiddance...) is translated once in the books; when the pairing of one monster could not tell it from
another entry, the same English name and text in a monster that was paired gives its translation. Only an
exact match of the English name and text is used, and when the translations of that entry disagree between
monsters the most common one wins.

Usage: python fill_monsters52.py [it fr de es]
"""

from __future__ import annotations

import collections
import json
import re
import sys

import book52

ROOT = book52.ROOT
ENTRY = re.compile(r"^(.+)\.(special|actions|bonusActions|reactions|legendary)\.(\d+)\.name$")


def run(lang: str) -> None:
    en = json.loads((ROOT / "locales/en/srd52/monsters.json").read_text(encoding="utf-8"))
    path = ROOT / f"locales/{lang}/srd52/monsters.json"
    tr = json.loads(path.read_text(encoding="utf-8"))
    seen: dict[tuple[str, str], collections.Counter] = collections.defaultdict(collections.Counter)
    for k, name in en.items():
        m = ENTRY.match(k)
        if not m:
            continue
        base = k[: -len(".name")]
        if k in tr and f"{base}.desc" in tr:
            seen[(name, en.get(f"{base}.desc", ""))][(tr[k], tr[f"{base}.desc"])] += 1
    filled = []
    for k, name in en.items():
        m = ENTRY.match(k)
        if not m or k in tr:
            continue
        base = k[: -len(".name")]
        votes = seen.get((name, en.get(f"{base}.desc", "")))
        if votes:
            (n, d), _ = votes.most_common(1)[0]
            tr[k], tr[f"{base}.desc"] = n, d
            filled.append(base)
    path.write_text(json.dumps(tr, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    left = [k[: -len(".name")] for k in en if ENTRY.match(k) and k not in tr]
    print(f"{lang}: {len(filled)} entries filled from an identical English entry; {len(left)} entries still English")


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
