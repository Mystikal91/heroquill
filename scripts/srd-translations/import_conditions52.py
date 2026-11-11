"""Translations of the 15 conditions of the SRD 5.2.1 from the official books (it, fr, de, es).

A condition is an entry of the rules glossary: a heading with a descriptor ("Accecato [condizione]",
"Blind (Zustand)"), an opening sentence and run-in headings in bold. The English text of the app writes
`**Heading.** text` one per line after the opening sentence; this does the same. The 15 are paired with the
English ones by the number of bold headings, the numbers in the text and the length.

Usage: python import_conditions52.py it   (or fr, de, es; all of them without an argument)
"""

from __future__ import annotations

import json
import math
import re
import sys

import book52
from import_reference import CONDITIONS, key  # the glossaries and helpers of the 5.1 importers
from import_misc import ITALIAN_CONDITIONS
from import_spells import hungarian

ROOT = book52.ROOT

DESCRIPTOR = {
    "it": r"\[condizione\]$",
    "fr": r"\[[ÉE]tat\]$",
    "de": r"\(Zustand\)$",
    "es": r"\[estado\]$",
}


def parse(lang: str) -> list[dict]:
    paras = book52.paragraphs(book52.book_lines(book52.pdf_path(lang)))
    out = []
    i = 0
    while i < len(paras):
        p = paras[i]
        if p["head"] and re.search(DESCRIPTOR[lang], p["text"], re.I) and p["head"] <= 12:
            name = re.sub(r"\s*[\[(][^\])]*[\])]$", "", p["text"]).strip()
            body = []
            i += 1
            while i < len(paras) and not paras[i]["head"]:
                body.append(paras[i]["text"])
                i += 1
            # Stop at the "See also" line and keep the opening sentence and the bold run-ins.
            body = [b for b in body if not re.match(r"^(\*\*)?(Vedi anche|Voir aussi|Siehe auch|V[eé]ase también)", b, re.I)]
            out.append({"name": name, "desc": "\n".join(body)})
        else:
            i += 1
    return out


def tidy(text: str) -> str:
    text = text.replace(" ", " ").replace("‑", "-")
    text = re.sub(r"\*\*\s*\*\*", lambda m: " " if " " in m.group(0) else "", text)  # a heading that wrapped
    return text.strip()


def shape(text: str) -> tuple:
    return (text.count("**") // 2, tuple(sorted(re.findall(r"\d+", text))), len(text))


def match(parsed: list[dict]) -> dict[str, dict]:
    en = json.loads((ROOT / "locales/en/srd52/conditions.json").read_text(encoding="utf-8"))
    slugs = sorted({k.split(".")[0] for k in en})
    sh = {s: shape(en[f"{s}.desc"]) for s in slugs}

    def cost(p: dict, s: str) -> float:
        a, b = shape(p["desc"]), sh[s]
        return abs(a[0] - b[0]) * 6 + len(set(a[1]) ^ set(b[1])) * 2 + abs(math.log((a[2] + 20) / (b[2] + 20))) * 4

    if len(parsed) != len(slugs):
        raise SystemExit(f"parsed {len(parsed)} conditions, expected {len(slugs)}: {[p['name'] for p in parsed]}")
    # The names the 5.1 importers already pair come first; the shape only settles the rest.
    out: dict[str, dict] = {}
    glossary = {**{key(v): k for k, v in ITALIAN_CONDITIONS.items()}, **CONDITIONS[lang]} if lang == "it" else CONDITIONS[lang]
    rest = []
    for p in parsed:
        slug = glossary.get(key(p["name"]))
        if slug in slugs and slug not in out:
            out[slug] = p
        else:
            rest.append(p)
    left = [s for s in slugs if s not in out]
    if rest:
        for p, j in zip(rest, hungarian([[cost(p, s) for s in left] for p in rest])):
            out[left[j]] = p
            print(f"  by shape: {p['name']!r} -> {left[j]}")
    return out


def run(lang: str) -> None:
    parsed = parse(lang)
    matched = match(parsed)
    # Cross-check with the glossary the 5.1 importer already has (names written from the 5.1 books).
    known = CONDITIONS[lang]
    for slug, p in matched.items():
        other = known.get(key(p["name"]))
        if other and other != slug:
            print(f"  CHECK {lang}: {p['name']!r} paired with {slug} but the 5.1 glossary says {other}")
        if not other:
            print(f"  note {lang}: {p['name']!r} -> {slug} (not in the 5.1 glossary)")
    target = ROOT / f"locales/{lang}/srd52/conditions.json"
    out = {}
    for slug, p in sorted(matched.items()):
        out[f"{slug}.name"] = p["name"]
        out[f"{slug}.desc"] = tidy(p["desc"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, len(matched), "conditions:", ", ".join(f"{s}={p['name']}" for s, p in sorted(matched.items())))


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
