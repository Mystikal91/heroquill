"""Translations of classes, subclasses and their features from the official SRD 5.2.1 books (it, fr, de, es).

A class chapter is a heading of size 18 with the class name, then sections of size 12 titled "Level N: Name" (the
class features), then a heading of size 14 for the subclass ("Barbarian Subclass: Path of the Berserker") whose
sections of size 12 are the subclass features. The English data knows a feature by its class (or subclass) and
its level, so a feature of the book is paired with the English ones of the same class and level by the shape
of the text, the numbers (feet become metres) and the named terms; the name of the book becomes the name.

- Classes are paired with the 5.1 glossary (`import_classes.CLASSES`), the subclass of a class is the only one it has.
- What cannot be paired with certainty stays English.

Usage: python import_classes52.py [it fr de es]
"""

from __future__ import annotations

import collections
import json
import math
import re
import sys

import book52
from import_classes import CLASSES
from import_reference import key
from import_species52 import assign

ROOT = book52.ROOT
LEVEL_TITLE = re.compile(r"^\D*?(\d+)\D*?\s?:\s*(.+)$", re.S)


def parse(lang: str) -> dict[str, dict]:
    """class slug -> {name, subclass: name, features: [{context, level, name, lines}]}"""
    secs = book52.sections(book52.book_lines(book52.pdf_path(lang)))
    classes: dict[str, dict] = {}
    current = None
    context = "class"
    for s in secs:
        if s["head"] == 18:
            slug = CLASSES[lang].get(key(s["title"]))
            if slug:
                current = classes.setdefault(slug, {"name": s["title"], "subclass": None, "features": []})
                context = "class"
            else:
                current = None  # another chapter
            continue
        if current is None:
            continue
        if s["head"] == 14:
            if ":" in s["title"] and not LEVEL_TITLE.match(s["title"]):
                context = "subclass"
                if current["subclass"] is None:
                    current["subclass"] = s["title"].split(":", 1)[1].strip()
            continue
        if s["head"] == 12:
            m = LEVEL_TITLE.match(s["title"])
            if m:
                current["features"].append(
                    {"context": context, "level": int(m.group(1)), "name": m.group(2).strip(), "lines": s["lines"]}
                )
            elif context == "class" and current["features"]:
                # The options of a feature (Metamagic, Eldritch Invocations) have a section of their own.
                current.setdefault("options", []).append({"name": s["title"], "lines": s["lines"]})
    return classes


def english() -> tuple[dict, dict]:
    """buckets of English features by ('class'|'sub', slug, level), and the subclass of each class."""
    feats = json.loads((ROOT / "data/srd52/features.json").read_text(encoding="utf-8"))["entries"]
    subs = json.loads((ROOT / "data/srd52/subclasses.json").read_text(encoding="utf-8"))["entries"]
    sub_of = {e["parent"].split("/")[1]: e["id"].split("/")[1] for e in subs}
    buckets: dict[tuple, list[str]] = collections.defaultdict(list)
    for e in feats:
        d, slug = e["data"], e["id"].split("/")[1]
        if e.get("parent"):
            continue  # an option of a feature: see `options`
        if "class" in d:
            buckets[("class", d["class"].split("/")[1], d["level"])].append(slug)
        elif "subclass" in d:
            buckets[("sub", d["subclass"].split("/")[1], d["level"])].append(slug)
    return buckets, sub_of


def is_table(english_text: str) -> bool:
    """An English text with a table: rows written "a / b", or "3 Aid, Bless" (a level and its spells)."""
    lines = english_text.split("\n")
    return sum(1 for l in lines if " / " in l) >= 2 or sum(1 for l in lines if re.match(r"^\d+ [A-Z]", l)) >= 2


OPTION_PARENTS = {"sorcerer": "sorcerer-metamagic", "warlock": "warlock-eldritch-invocations"}


def spellcasting(lang: str, slug: str, parsed: dict | None, out: dict, score) -> None:
    """`<class>.spellcasting.N`: the run-in paragraphs of the Spellcasting feature of level 1, in the book's words."""
    en = json.loads((ROOT / "locales/en/srd52/classes.json").read_text(encoding="utf-8"))
    wanted = sorted({int(k.split(".")[2]) for k in en if k.startswith(f"{slug}.spellcasting.") and k.endswith(".name")})
    if not wanted or parsed is None:
        return
    groups: list[dict] = []
    for p in book52.text_of(parsed["lines"], bold=True).split("\n"):
        m = re.match(r"^\*\*(.+?)\*\*\s*(.*)$", p)
        if m:
            groups.append({"name": m.group(1).strip().rstrip(".:").strip(), "parts": [m.group(2)]})
        elif groups:
            groups[-1]["parts"].append(p)
    for g in groups:
        g["desc"] = "\n".join(x for x in g["parts"] if x).replace("**", "")
    if len(groups) < len(wanted):
        print(f"  {lang} {slug}: {len(groups)} spellcasting paragraphs in the book, {len(wanted)} in the data: left English")
        return
    # (The wizard's book has a Spellbook paragraph the data does not split off: the best paragraphs are taken.)
    cols = assign([[score(g["desc"], en[f"{slug}.spellcasting.{n}.desc"]) for g in groups] for n in wanted])
    for n, j in zip(wanted, cols):
        if j is not None:
            out[f"{slug}.spellcasting.{n}.name"] = groups[j]["name"]
            out[f"{slug}.spellcasting.{n}.desc"] = groups[j]["desc"]


def options(lang: str, slug: str, parsed: list[dict], out: dict, unpaired: list, score) -> None:
    """Metamagic options and Eldritch Invocations. The data has a variant for each spell or feat an invocation
    can name ("Agonizing Blast (Chill Touch)"): the variants take the book's name of the invocation with the
    translated name of the spell or feat in brackets, and its text."""
    en = json.loads((ROOT / "locales/en/srd52/features.json").read_text(encoding="utf-8"))
    parent = OPTION_PARENTS[slug]
    feats = json.loads((ROOT / "data/srd52/features.json").read_text(encoding="utf-8"))["entries"]
    mine = [e["id"].split("/")[1] for e in feats if e.get("parent", "").endswith("/" + parent)]
    bases: dict[str, list[str]] = collections.defaultdict(list)
    for s in mine:
        bases[re.sub(r" \(.*\)$", "", en[f"{s}.name"])].append(s)
    texts = book52.terms(lang)  # (English, translated) of spells, skills...
    spells = {a: b for a, b in texts}
    feat_names = json.loads((ROOT / f"locales/{lang}/srd52/feats.json").read_text(encoding="utf-8"))
    feat_en = json.loads((ROOT / "locales/en/srd52/feats.json").read_text(encoding="utf-8"))
    feat_tr = {book52._plain(feat_en[k]): feat_names[k] for k in feat_en if k.endswith(".name") and k in feat_names}
    for o in parsed:
        o["desc"] = book52.text_of(o["lines"], bold=False)
    names = list(bases)
    if len(parsed) != len(names):
        print(f"  {lang} {slug}: {len(parsed)} options in the book, {len(names)} in the data: left English")
        return
    cols = assign([[score(o["desc"], en[f"{bases[n][0]}.desc"]) for o in parsed] for n in names])
    for base, j in zip(names, cols):
        if j is None:
            continue
        o = parsed[j]
        for s in bases[base]:
            variant = re.search(r" \((.*)\)$", en[f"{s}.name"])
            label = o["name"]
            if variant:
                v = variant.group(1)
                tr = spells.get(book52._plain(v)) or feat_tr.get(book52._plain(v)) or v
                # the translated names are kept as the books write them (the lookup lowercases them)
                label = f"{o['name']} ({tr})"
            out[f"{s}.name"] = label
            out[f"{s}.desc"] = o["desc"]


def run(lang: str) -> None:
    en_feat = json.loads((ROOT / "locales/en/srd52/features.json").read_text(encoding="utf-8"))
    buckets, sub_of = english()
    classes = parse(lang)
    out_feat: dict[str, str] = {}
    out_class: dict[str, str] = {}
    out_sub: dict[str, str] = {}
    unpaired: list = []
    reordered: list = []
    tables: list = []

    def score(text: str, english_text: str) -> float:
        return (
            abs(text.count("**") - english_text.count("**")) * 3
            + book52.number_gap(english_text, text) * 3
            + abs(math.log((len(text) + 40) / (len(english_text) + 40))) * 5
            - book52.term_hits(english_text, text, lang) * 5
        )

    matched: dict[str, dict] = {}
    for slug, c in sorted(classes.items()):
        out_class[f"{slug}.name"] = c["name"]
        if c["subclass"] and slug in sub_of:
            out_sub[f"{sub_of[slug]}.name"] = c["subclass"]
        for context, ctx_name in (("class", "class"), ("sub", "subclass")):
            owner = slug if context == "class" else sub_of.get(slug)
            mine = [f for f in c["features"] if f["context"] == ctx_name]
            for f in mine:
                f["desc"] = book52.text_of(f["lines"], bold=False)
            for level in sorted({f["level"] for f in mine}):
                parsed = [f for f in mine if f["level"] == level]
                wanted = buckets.get((context, owner, level), [])
                if not wanted:
                    continue
                if len(parsed) == len(wanted) == 1:
                    pairs = [(wanted[0], parsed[0], 0.0)]
                else:
                    cols = assign([[score(f["desc"], en_feat[f"{w}.desc"]) for f in parsed] for w in wanted])
                    pairs = [
                        (w, parsed[j], score(parsed[j]["desc"], en_feat[f"{w}.desc"]))
                        for w, j in zip(wanted, cols)
                        if j is not None
                    ]
                # With as many sections in the book as features in the data the pairing is forced, so it is kept
                # even when the text differs; the order of the book is the check (it should be the English one).
                equal = len(parsed) == len(wanted)
                if equal and len(wanted) > 1:
                    in_order = all(parsed[wanted.index(w)] is f for w, f, _ in pairs)
                    if not in_order:
                        reordered.append((owner, level, [w for w, _, _ in pairs]))
                for w, f, value in pairs:
                    if value > (70 if equal else 14):
                        unpaired.append((w, round(value, 1)))
                        continue
                    out_feat[f"{w}.name"] = f["name"]
                    matched[w] = f
                    if is_table(en_feat[f"{w}.desc"]):
                        # The English text carries a table (rows written "a / b"): the book's table is not read yet,
                        # so the translated text would lack it. Name only; the text stays English.
                        tables.append(w)
                        continue
                    out_feat[f"{w}.desc"] = f["desc"]
                unpaired += [(w, None) for w in wanted if f"{w}.name" not in out_feat and w not in [u[0] for u in unpaired]]
        spellcasting(lang, slug, matched.get(f"{slug}-spellcasting"), out_class, score)
        if slug in OPTION_PARENTS:
            options(lang, slug, c.get("options", []), out_feat, unpaired, score)

    for name, values in (("features", out_feat), ("classes", out_class), ("subclasses", out_sub)):
        target = ROOT / f"locales/{lang}/srd52/{name}.json"
        target.write_text(json.dumps(values, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(classes), "classes,", len(out_sub), "subclasses,", len(out_feat) // 2, "features; unpaired:", len(unpaired), unpaired[:30])
    print("  name only (the text has a table):", tables)


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
