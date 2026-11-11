"""Translations of species, their traits and the four backgrounds of the SRD 5.2.1 (it, fr, de, es).

A species is a section of size 12 whose first lines are the small sans lines (creature type, size, speed) and
whose traits are paragraphs with a bold run-in name ("**Soffio.** ..."); a trait goes on in the indented
paragraphs without a bold name. A background is a section of size 12 with only the sans lines (ability scores,
feat, skills, tool, equipment).

- Species are paired with English ids through the glossary of the 5.1 importer (the species that are new, goliath
  and orc, by the shape of their traits).
- Traits are paired inside a species by shape, the numbers (feet become metres) and the named terms. Traits the
  English data has only as variants (Draconic Ancestor: Black, Elven Lineage: Drow...) and the tables of the
  books are not written here: they stay English until reviewed.
- Backgrounds are paired by the skills they name (the skills glossary of the 5.1 importer).

Usage: python import_species52.py [it fr de es]
"""

from __future__ import annotations

import json
import math
import re
import sys

import book52
from import_reference import SKILLS, key
from import_species import SPECIES
from import_spells import hungarian

ROOT = book52.ROOT


def assign(cost: list[list[float]]) -> list[int | None]:
    """Best pairing of rows to columns for a rectangular matrix (None for a row left with no column)."""
    n = max(len(cost), len(cost[0]) if cost else 0)
    big = 1e6
    padded = [[cost[i][j] if i < len(cost) and j < len(cost[0]) else big for j in range(n)] for i in range(n)]
    cols = hungarian(padded)
    return [cols[i] if cols[i] < len(cost[0]) else None for i in range(len(cost))]


def parse(lang: str) -> tuple[list[dict], list[dict]]:
    secs = book52.sections(book52.book_lines(book52.pdf_path(lang)))
    species, backgrounds = [], []
    for s in secs:
        if s["head"] != 12 or not s["lines"] or s["lines"][0]["head"] != 10:
            continue
        body = [l for l in s["lines"] if not l["head"]]
        if not body:
            backgrounds.append({"name": s["title"], "meta": " ".join(l["text"].strip() for l in s["lines"])})
            continue
        # The opening sentence is before the first indented paragraph; traits start with a bold run-in.
        traits: list[dict] = []
        paras: list[str] = []
        for line in body:
            t = line["text"].strip()
            if line["tab"] or not paras or t.startswith("**"):
                paras.append(t)
            else:
                paras[-1] += " " + t
        for p in paras:
            m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", p, re.S)
            if m:
                traits.append({"name": m.group(1).strip().rstrip(".:").strip(), "parts": [m.group(2).strip()]})
            elif traits:
                traits[-1]["parts"].append(p)
        for t in traits:
            t["desc"] = "\n".join(x for x in t["parts"] if x)
        species.append({"name": s["title"], "traits": traits, "page": s["page"]})
    return species, backgrounds


def english_species() -> dict[str, list[str]]:
    """species slug -> the base traits it gets (not the variants of a choice)."""
    out = {}
    for e in json.loads((ROOT / "data/srd52/species.json").read_text(encoding="utf-8"))["entries"]:
        slug = e["id"].split("/")[1]
        out[slug] = [x["id"].split("/")[1] for x in e["effects"] if x["type"] == "trait"]
    return out


def clean(text: str) -> str:
    return book52.text_of([{"text": text, "tab": False, "head": 0}])


def run(lang: str) -> None:
    en_traits = json.loads((ROOT / "locales/en/srd52/traits.json").read_text(encoding="utf-8"))
    en_species = english_species()
    species, backgrounds = parse(lang)
    glossary = SPECIES[lang]

    # Species: the glossary first, the shape for the rest.
    paired: dict[str, dict] = {}
    rest = []
    for sp in species:
        slug = glossary.get(key(sp["name"]))
        if slug in en_species and slug not in paired:
            paired[slug] = sp
        else:
            rest.append(sp)
    left = [s for s in en_species if s not in paired]
    if rest:
        if len(rest) != len(left):
            raise SystemExit(f"{lang}: {len(species)} species parsed, left over {[r['name'] for r in rest]} for {left}")

        def cost(sp: dict, slug: str) -> float:
            text = " ".join(t["desc"] for t in sp["traits"])
            english = " ".join(en_traits.get(f"{t}.desc", "") for t in en_species[slug])
            return book52.number_gap(english, text) * 3 + abs(math.log((len(text) + 50) / (len(english) + 50))) * 4

        for sp, j in zip(rest, assign([[cost(sp, s) for s in left] for sp in rest])):
            paired[left[j]] = sp
            print(f"  by shape: {sp['name']!r} -> {left[j]}")

    out: dict[str, str] = {}
    for slug, sp in sorted(paired.items()):
        out[f"{slug}.name"] = sp["name"]
    names = {}
    traits_out: dict[str, str] = {}
    skipped = []
    for slug, sp in sorted(paired.items()):
        wanted = [t for t in en_species[slug] if f"{t}.desc" in en_traits]
        if not wanted:
            continue

        def score(text: str, english: str) -> float:
            return (
                abs(text.count("**") - english.count("**")) * 4
                + book52.number_gap(english, text) * 3
                + abs(math.log((len(text) + 30) / (len(english) + 30))) * 4
                - book52.term_hits(english, text, lang) * 6
                + book52.term_misses(english, text, lang) * 1
            )

        def best(t: dict, slug_t: str) -> tuple[float, str]:
            # A table in the middle of a trait can push the next paragraphs of the book onto the next trait: try the
            # first paragraph alone too.
            english = en_traits[f"{slug_t}.desc"]
            options = [t["parts"][0]] if "\n" not in english else [t["desc"]]
            return min((score(o, english), o) for o in options)

        # The one-paragraph traits first (they match their own paragraph exactly), then the longer ones with
        # what is left: a table can leave the paragraphs after it in the next trait of the book.
        chosen: dict[str, int | None] = {}
        free = list(range(len(sp["traits"])))
        for group in ([w for w in wanted if "\n" not in en_traits[f"{w}.desc"]], [w for w in wanted if "\n" in en_traits[f"{w}.desc"]]):
            if not group:
                continue
            for w, j in zip(group, assign([[best(sp["traits"][c], w)[0] for c in free] for w in group])):
                chosen[w] = free[j] if j is not None else None
            free = [c for c in free if c not in chosen.values()]
        for slug_t, j in chosen.items():
            if j is None:
                skipped.append(slug_t)
                continue
            t = sp["traits"][j]
            english = en_traits[f"{slug_t}.desc"]
            value, text = best(t, slug_t)
            # A poor match stays English: far in length or numbers.
            if value > 12 or book52.number_gap(english, text) > 1:
                skipped.append(slug_t)
                continue
            # A trait shared by species (Darkvision) is written once, from the first species that has it.
            if f"{slug_t}.desc" in traits_out:
                continue
            traits_out[f"{slug_t}.name"] = t["name"]
            traits_out[f"{slug_t}.desc"] = clean(text)
            print(f"  {slug}: {slug_t} = {t['name']} ({value:.1f})")
        # One trait left on each side (the one that carries a table): the name is certain, the text stays English.
        used = {sp["traits"][j]["name"] for w, j in chosen.items() if j is not None and w not in skipped}
        left_en = [w for w in wanted if w in skipped and f"{w}.name" not in traits_out]
        left_tr = [t for t in sp["traits"] if t["name"] not in used]
        if len(left_en) == 1 and len(left_tr) == 1 and f"{left_en[0]}.name" not in traits_out:
            traits_out[f"{left_en[0]}.name"] = left_tr[0]["name"]
            print(f"  {slug}: {left_en[0]} = {left_tr[0]['name']} (name only)")

    # Backgrounds by the skills they name.
    skills = SKILLS[lang]
    data = json.loads((ROOT / "data/srd52/backgrounds.json").read_text(encoding="utf-8"))["entries"]
    wants = {
        e["id"].split("/")[1]: {x["target"] for x in e["effects"] if x["type"] == "proficiency" and x["category"] == "skill"}
        for e in data
    }
    bg_out = {}
    for b in backgrounds:
        meta = key(b["meta"].split("Skill")[0] if lang == "en" else b["meta"])
        found = {slug for name, slug in skills.items() if name in meta}
        best = max(wants, key=lambda w: len(found & wants[w]))
        if found & wants[best] == wants[best]:
            bg_out[f"{best}.name"] = b["name"]

    for name, values in (("species", out), ("traits", traits_out), ("backgrounds", bg_out)):
        target = ROOT / f"locales/{lang}/srd52/{name}.json"
        target.write_text(json.dumps(values, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(out), "species,", len(traits_out) // 2, "traits,", len(bg_out), "backgrounds; left English:", skipped)


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
