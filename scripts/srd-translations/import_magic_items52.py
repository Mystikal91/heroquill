"""Translations of the magic items of the SRD 5.2.1 from the official books (it, fr, de, es).

An adaptation of `import_magic_items.py` (the 5.1 importer): the chapter "Magic Items A-Z" has one section per
item in the alphabetical order of the language, each with a line "Wondrous item, rare (requires attunement)",
so a section is paired with an English item by what does not change between languages (rarity, attunement,
kind, numbers) and by the text (the Hungarian method, the dictionary learned from the texts already translated,
the names of the game terms). What the 5.1 script already knows is imported from it: the words for the
rarities and kinds, the dictionary, the glossary and the scores. What changes is the reader of the book
(`book52`) and the English side, which is the 2024 data.

The English text of the app has the kind of item as its first line ("Wondrous Item") and no rarity, so the
translated first line keeps the kind only. Items that are one section for several entries in the data
(Weapon +1, +2 and +3, the Horn of Valhalla: slugs that end with a number) have no section of their own
and stay English.

Usage: python import_magic_items52.py [it fr de es]
"""

from __future__ import annotations

import json
import re
import sys

import book52
from import_magic_items import CONFIG, dice, dictionary, glossary, grams, slugify, stems
from import_reference import plain
from import_spells import hungarian, tokens

ROOT = book52.ROOT
KIND_OF = {
    "weapon": "weapon",
    "armor": "armor",
    "ring": "ring",
    "wand": "wand",
    "staff": "staff",
    "rod": "rod",
    "potion": "potion",
    "scroll": "scroll",
    "wondrous item": "wondrous-items",
    "ammunition": "ammunition",
}


def parse(lang: str) -> list[dict]:
    cfg = CONFIG[lang]
    secs = book52.sections(book52.book_lines(book52.pdf_path(lang)))
    start = next(i for i, s in enumerate(secs) if s["head"] == 18 and re.search(r"\bA\s*[–-]\s*Z\b|\bA (bis|à|a la) Z\b|A bis Z|de la A a la Z", s["title"].replace(" ", " ")))
    end = next((i for i in range(start + 1, len(secs)) if secs[i]["head"] == 18), len(secs))
    words = "|".join(re.escape(w) for w in sorted(cfg["rarities"], key=len, reverse=True))
    head = re.compile(rf"^(?P<kind>.*?),\s+(?P<rarity>{words})\b(?P<extra>(?: \([^)]*\))?)\s*(?P<rest>.*)$", re.S | re.I)
    items = []
    for s in secs[start + 1 : end]:
        if s["head"] != 12 or not s["lines"]:
            continue
        paras = book52.text_of(s["lines"], bold=False).split("\n")
        m = head.match(paras[0])
        if not m:
            continue
        kind = plain(m["kind"].lower())
        category = next(
            (c for w, c in sorted(cfg["kinds"].items(), key=lambda kv: -len(kv[0])) if re.match(w + r"\b", kind)), None
        )
        items.append(
            {
                "name": s["title"],
                "kind": m["kind"].strip(),
                "rarity": cfg["rarities"][m["rarity"].lower()],
                "attunement": cfg["attunement"] in m["extra"].lower() or cfg["attunement"] in paras[0].lower(),
                "category": category,
                "text": [p for p in [m["rest"].strip(), *paras[1:]] if p],
            }
        )
    return items


def english() -> dict[str, dict]:
    data = json.loads((ROOT / "data/srd52/items.json").read_text(encoding="utf-8"))["entries"]
    en = json.loads((ROOT / "locales/en/srd52/items.json").read_text(encoding="utf-8"))
    out = {}
    for e in data:
        if e["data"].get("category") != "magic-items":
            continue
        slug = e["id"].split("/")[1]
        first, _, body = en[f"{slug}.desc"].partition("\n") if f"{slug}.desc" in en else ("", "", "")
        word = re.sub(r"\s*\(.*$", "", first).lower().strip()
        out[slug] = {
            "name": en[f"{slug}.name"],
            "kind": first,
            "body": body,
            "rarity": e["data"].get("rarity", "varies"),
            "attunement": bool(e["data"].get("attunement")),
            "category": KIND_OF.get(word),
        }
    return out


def match(items: list[dict], lang: str) -> tuple[dict, list]:
    pairs = glossary(lang)
    words = dictionary(lang)
    # The entries of a family (Weapon +1, +2, +3; the Horn of Valhalla) have no section of their own: left out.
    pool = {s: v for s, v in english().items() if not re.search(r"-\d+$", s)}
    slugs = list(pool)
    # What the 5.1 translation called the same item (same slug) is a strong hint for the title of the section.
    old_path = ROOT / f"locales/{lang}/srd51/items.json"
    old = json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {}
    shown: dict[str, str] = {}
    item_stems: dict[str, set[str]] = {}

    def mention(item: dict, slug: str) -> float:
        e = plain(f'{pool[slug]["name"]} {pool[slug]["body"]}'.lower())
        text = shown.setdefault(item["name"], plain(" ".join([item["name"], *item["text"]]).lower()))
        wanted = [t for en_re, t in pairs if en_re.search(e)]
        return sum(1 for t in wanted if t.search(text)) / len(wanted) if wanted else 0.0

    def share(item: dict, slug: str) -> float:
        theirs = item_stems.setdefault(item["name"], stems(" ".join([item["name"], *item["text"]])))
        known = [words[w] for w in stems(f'{pool[slug]["name"]} {pool[slug]["body"]}') if w in words]
        return sum(1 for options in known if theirs & options.keys()) / len(known) if known else 0.0

    def cost(item: dict, slug: str) -> float:
        m = pool[slug]
        ti, te = tokens(" ".join(item["text"])), tokens(m["body"])
        overlap = sum((ti & te).values()) / (sum((ti | te).values()) or 1)
        length_en = len(m["body"]) or 1
        value = -overlap * 100 + abs(sum(len(p) for p in item["text"]) / length_en - 1.15) * 40
        value -= dice(grams(item["name"]), grams(m["name"])) * 90
        hint = old.get(f"{slug}.name")
        if hint:
            value -= dice(grams(item["name"]), grams(hint)) * 200
        value -= mention(item, slug) * 60
        value -= share(item, slug) * 250
        value -= book52.term_hits(m["body"], " ".join(item["text"]), lang) * 8
        value += book52.number_gap(m["body"], " ".join(item["text"])) * 6
        if item["rarity"] != m["rarity"] and m["rarity"] != "varies" and item["rarity"] != "varies":
            value += 1000
        if item["attunement"] != m["attunement"]:
            value += 500
        if item["category"] and m["category"] and item["category"] != m["category"]:
            value += 300
        return value

    size = max(len(items), len(slugs))
    matrix = [
        [cost(items[r], slugs[c]) if r < len(items) and c < len(slugs) else 500 for c in range(size)] for r in range(size)
    ]
    result, doubtful = {}, []
    for r, c in enumerate(hungarian(matrix)):
        if r < len(items) and c < len(slugs):
            if matrix[r][c] >= 300:
                doubtful.append((slugs[c], items[r]["name"], round(matrix[r][c], 1), "left English"))
                continue
            result[slugs[c]] = items[r]
            if matrix[r][c] > -20:
                doubtful.append((slugs[c], items[r]["name"], round(matrix[r][c], 1), "check"))
    by_title = {item["name"]: item for item in items}
    for slug, title in MANUAL.get(lang, {}).items():
        for taken in [k for k, v in result.items() if v["name"] == title]:
            del result[taken]
        if title in by_title and slug in pool:
            result[slug] = by_title[title]
    return result, doubtful


# Pairs the cost cannot settle (the items whose text is a table or a list); the title is that of the section in the
# book, read from the list of titles: the SRD hardly changes, so it is written once.
MANUAL = {
    "it": {
        "belt-of-giant-strength": "Cintura della forza dei giganti",
        "wand-of-wonder": "Bacchetta delle meraviglie",
        "mysterious-deck": "Mazzo delle meraviglie",
        "deck-of-illusions": "Mazzo delle illusioni",
        "hat-of-many-spells": "Cappello dei molti incantesimi",
    },
    "fr": {
        "wand-of-wonder": "Baguette des merveilles",
        "mysterious-deck": "Tarot mystérieux",
        "deck-of-illusions": "Tarot fantasmagorique",
        "hat-of-many-spells": "Chapeau mille-sorts",
        "dragon-orb": "Orbe draconique",
    },
    "de": {
        "belt-of-giant-strength": "Gürtel der Riesenstärke",
        "wand-of-wonder": "Zauberstab des Wunders",
        "mysterious-deck": "Mysteriöse Karten",
        "deck-of-illusions": "Karten der Illusionen",
        "hat-of-many-spells": "Hut der Vielen Zauber",
        "dragon-orb": "Kugel der Drachen",
    },
    "es": {
        "belt-of-giant-strength": "Cinturón de fuerza de gigante",
        "wand-of-wonder": "Varita de las maravillas",
        "mysterious-deck": "Baraja misteriosa",
        "deck-of-illusions": "Baraja de ilusiones",
        "hat-of-many-spells": "Sombrero de múltiples conjuros",
        "dragon-orb": "Orbe Dragontino",
    },
}


def run(lang: str) -> None:
    items = parse(lang)
    matched, doubtful = match(items, lang)
    out = {}
    for slug, item in sorted(matched.items()):
        out[f"{slug}.name"] = item["name"]
        out[f"{slug}.desc"] = "\n".join([item["kind"], *item["text"]])
    target = ROOT / f"locales/{lang}/srd52/items.json"
    existing = json.loads(target.read_text(encoding="utf-8")) if target.exists() else {}
    # Start clean: what an earlier run wrote for a magic item must not stay when this run pairs it otherwise.
    stale = {f"{s}.{f}" for s in english() for f in ("name", "desc")}
    existing = {k: v for k, v in existing.items() if k not in stale}
    existing.update(out)
    target.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    left = [s for s in english() if s not in matched]
    print(f"{lang}: {len(items)} sections, {len(matched)} items written; no section for {len(left)}: {left[:25]}")
    for slug, name, score, what in sorted(doubtful, key=lambda d: -d[2])[:25]:
        print(f"  {what}: {slug} <- {name} ({score})")


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
