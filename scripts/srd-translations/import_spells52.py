"""Imports the spell texts of an official SRD 5.2.1 translation into `locales/<lang>/srd52/spells.json`.

The 5.2.1 translations are laid out like the English book (two columns, a title, a school line, four
labelled lines), and list the spells in the translated alphabetical order, so each spell is matched to
its English entry the way `import_spells.py` does for the 5.1 book: by level, school, ritual,
concentration, components, the numbers and dice in its text and its length, with a global best
assignment (Hungarian algorithm), never by name.

What is different from 5.1: the class list of the school line wraps onto a second line, a paragraph
begins with an indented line (read from the position of the line, there is no tab in the text), words
are broken at the end of a line with a soft hyphen, and the part about a higher-level slot has a
heading of its own ("Utilizzo di uno slot incantesimo di livello superiore.").

Usage (needs PyMuPDF: `pip install pymupdf`):

    python scripts/srd-translations/import_spells52.py it .cache/srd52/pdf/IT_SRD_CC_v5.2.1.pdf

Official PDFs (CC-BY-4.0): https://www.dndbeyond.com/srd
"""

import collections
import json
import re
import sys
from pathlib import Path

from import_spells import hungarian, plain, tokens

ROOT = Path(__file__).resolve().parents[2]

# Everything that differs between languages lives here. Schools are listed by a lowercase,
# accent-free stem and the English id they stand for (Italian and French name conjuration and
# evocation the other way round from English).
LANGUAGES = {
    "it": {
        "labels": ["Tempo di lancio", "Gittata", "Componente|Componenti", "Durata"],
        "schools": {
            "abiurazione": "abjuration", "evocazione": "conjuration", "divinazione": "divination",
            "ammaliamento": "enchantment", "invocazione": "evocation", "illusione": "illusion",
            "necromanzia": "necromancy", "trasmutazione": "transmutation",
        },
        "higher": r"Utilizzo di uno slot incantesimo di livello superiore\.",
        "concentration": "concentrazione",
        "end": r"^Glossario delle",
    },
    "fr": {
        "labels": ["Temps d.incantation", "Port.e", "Composantes?", "Dur.e"],
        "schools": {
            "abjuration": "abjuration", "invocation": "conjuration", "divination": "divination",
            "enchantement": "enchantment", "evocation": "evocation", "illusion": "illusion",
            "necromancie": "necromancy", "transmutation": "transmutation",
        },
        "higher": r"Emplacement de niveau sup.rieur\.",
        "concentration": "concentration",
        "end": r"^Glossaire de",
    },
    "de": {
        "labels": ["Zeitaufwand", "Reichweite", "Komponenten?", "Wirkungsdauer"],
        "schools": {
            "bann": "abjuration", "beschwor": "conjuration", "erkenntnis": "divination",
            "verzauberung": "enchantment", "hervorruf": "evocation", "illusion": "illusion",
            "nekromantie": "necromancy", "verwandlung": "transmutation",
        },
        "higher": r"Verwenden von Zauberpl.tzen h.heren Grades:",
        "concentration": "konzentration",
        "end": r"^Regelglossar",
        "component_letters": {"G": "S"},
    },
    "es": {
        "labels": ["Tiempo de lanzamiento", "Alcance", "Componentes?", "Duraci.n"],
        "schools": {
            "abjuracion": "abjuration", "conjuracion": "conjuration", "adivinacion": "divination",
            "encantamiento": "enchantment", "evocacion": "evocation", "ilusionismo": "illusion",
            "nigromancia": "necromancy", "transmutacion": "transmutation",
        },
        "higher": r"Con un espacio de conjuro de nivel superior\.",
        "concentration": "concentraci",
        "end": r"^Glosario de",
    },
}
NOISE = re.compile(
    r"^(\d{1,3}$|System Reference Document|Syst.me de r.f.rence|Document de R.f.rence|Systemreferenzdokument"
    r"|Documento de referencia del sistema)"
)


def pdf_lines(pdf: Path) -> list[str]:
    """The lines of the book in reading order; a line that opens a paragraph starts with a tab.

    A paragraph opens with an indented line, so the indent is read from the position of the line
    against the left edge of its column. Words broken at a line end are put back together: with a soft
    hyphen (the book's own) or with a hyphen followed by a lowercase letter.
    """
    import pymupdf

    out: list[str] = []
    for page in pymupdf.open(pdf):
        rows = []
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(s["text"] for s in line["spans"])
                if text.strip() and not NOISE.match(text.strip()):
                    rows.append((line["bbox"][0] > page.rect.width / 2 - 5, line["bbox"][0], text))
        edge = {}
        for col in (False, True):
            xs = [x for c, x, _ in rows if c == col]
            if xs:
                edge[col] = min(xs)
        for col, x, text in rows:
            out.append(("\t" if x - edge[col] > 4 else "") + text.rstrip())
    merged: list[str] = []
    for line in out:
        if merged and (merged[-1].endswith("­") or re.search(r"[^\W\d_]-$", merged[-1])) and re.match(
            r"^\t?[a-zà-ÿ]", line
        ):
            prev = merged.pop()
            fragment = re.search(r"[^\W\d_]*-?$", prev[:-1])
            # A hyphen after a short piece ("vis-à-" "vis") belongs to the word; the hyphen of a broken word
            # ("présen-" "tant") does not.
            keep = prev.endswith("-") and len(fragment.group(0).replace("-", "")) <= 2 and "-" in prev[:-1]
            merged.append((prev if keep else prev[:-1]) + line.lstrip("\t"))
        else:
            merged.append(line)
    return [l.replace("­", "") for l in merged]


def parse_spells(lang: str, lines: list[str]) -> list[dict]:
    cfg = LANGUAGES[lang]
    label_re = [re.compile(rf"^\t?({lab})\s*:") for lab in cfg["labels"]]

    def school_of(text: str):
        p = plain(text)
        return next((stem for stem in cfg["schools"] if p.startswith(stem) or f" {stem}" in p[:40] or stem in p[:30]), None)

    # A spell starts at its first label line (casting time). Above it are the school line (its class list can
    # wrap onto a second line) and the title. Rules text can mention the label too, so a school line must be there.
    starts = []
    for i in range(2, len(lines)):
        if not label_re[0].match(lines[i]):
            continue
        # the class list wraps onto up to three lines
        for back in (1, 2, 3, 4):
            meta = lines[i - back].lstrip("\t")
            joined = " ".join(lines[i - back : i])
            if len(meta) < 100 and school_of(meta) and "(" in joined and ")" in joined:
                starts.append((i - back - 1, back))
                break
    end_re = re.compile(cfg["end"])
    stop = next((i for i in range(starts[-1][0], len(lines)) if end_re.match(lines[i].lstrip("\t"))), len(lines))
    spells = []
    for n, (s, back) in enumerate(starts):
        nxt = starts[n + 1][0] if n + 1 < len(starts) else stop
        block = [l for l in lines[s:nxt]]
        name = block[0].strip()
        meta_lines = block[1 : 1 + back]
        school_line = meta_lines[0].strip()
        p = plain(school_line)
        stem = school_of(school_line)
        if stem is None:
            continue
        school = cfg["schools"][stem]
        digits = re.search(r"\d+", school_line.split("(")[0])
        level = int(digits.group()) if digits else 0
        body = block[1 + back :]
        fields: dict[int, str] = {}
        cur, idx = None, 0
        while idx < len(body):
            hit = next((k for k, rx in enumerate(label_re) if rx.match(body[idx])), None)
            if hit is not None and hit >= (cur if cur is not None else 0):
                cur = hit
                fields[cur] = re.sub(r"^\t?[^:]*:", "", body[idx]).strip()
            elif cur is not None and cur != 3:
                fields[cur] += " " + body[idx].strip()
            else:
                break
            idx += 1
        ritual = bool(re.search(r"ritu", plain(fields.get(0, ""))))

        paras, current = [], []
        for l in body[idx:]:
            if l.startswith("\t") and current:
                paras.append(" ".join(current))
                current = []
            current.append(l.strip())
        if current:
            paras.append(" ".join(current))
        paras = [re.sub(r"\s+", " ", x).strip() for x in paras if x.strip()]
        higher = None
        for k, para in enumerate(paras):
            m = re.match(cfg["higher"] + r"\s*", para)
            if m:
                higher = para[m.end() :].strip()
                paras.pop(k)
                break

        components = fields.get(2, "")
        letters = re.findall(r"\b([VSMG])\b", re.sub(r"\(.*", "", components))
        letters = [cfg.get("component_letters", {}).get(x, x) for x in letters]
        material = re.search(r"\((.*)\)", components)
        spells.append(
            {
                "name": name,
                "school": school,
                "schoolWord": school_line.split()[0],
                "level": level,
                "ritual": ritual,
                "components": sorted(set(letters)),
                "material": material.group(1).strip() if material else None,
                "castingTime": fields.get(0, ""),
                "range": fields.get(1, ""),
                "duration": fields.get(3, ""),
                "concentration": plain(fields.get(3, "")).startswith(cfg["concentration"]),
                "desc": "\n".join(paras),
                "higherLevel": higher,
            }
        )
    return spells


def match(spells: list[dict]) -> tuple[dict, list]:
    entries = json.loads((ROOT / "data/srd52/spells.json").read_text(encoding="utf-8"))["entries"]
    english = json.loads((ROOT / "locales/en/srd52/spells.json").read_text(encoding="utf-8"))
    meta = {e["id"].split("/")[1]: e["data"] for e in entries}
    slugs = list(meta)

    def text(slug: str, field: str) -> str:
        return english.get(f"{slug}.{field}", "")

    def signature_en(slug: str):
        d = meta[slug]
        return (d["school"], d["ritual"], d["concentration"], tuple(sorted(set(d["components"]))))

    def cost(spell: dict, slug: str) -> float:
        ti = tokens(f'{spell["desc"]} {spell["higherLevel"] or ""} {spell["material"] or ""}')
        te = tokens(f'{text(slug, "desc")} {text(slug, "higherLevel")} {text(slug, "material")}')
        overlap = sum((ti & te).values()) / (sum((ti | te).values()) or 1)
        length_it = len(spell["desc"]) + len(spell["higherLevel"] or "")
        length_en = (len(text(slug, "desc")) + len(text(slug, "higherLevel"))) or 1
        value = -overlap * 100 + abs(length_it / length_en - 1.15) * 40
        for a, b in ((spell["castingTime"], text(slug, "castingTime")), (spell["duration"], text(slug, "duration"))):
            if tokens(a) == tokens(b):
                value -= 15
        if spell["level"] != meta[slug]["level"]:
            value += 1000
        sig = (spell["school"], spell["ritual"], spell["concentration"], tuple(spell["components"]))
        if sig != signature_en(slug):
            value += 900
        return value

    size = max(len(spells), len(slugs))
    matrix = [
        [cost(spells[r], slugs[c]) if r < len(spells) and c < len(slugs) else 500 for c in range(size)]
        for r in range(size)
    ]
    result, doubtful = {}, []
    for r, c in enumerate(hungarian(matrix)):
        if r < len(spells) and c < len(slugs):
            result[slugs[c]] = spells[r]
            if matrix[r][c] > 0:
                doubtful.append((slugs[c], spells[r]["name"], round(matrix[r][c], 1)))
    return result, doubtful


def write_locale(lang: str, matched: dict) -> int:
    english = json.loads((ROOT / "locales/en/srd52/spells.json").read_text(encoding="utf-8"))
    out = {}
    for key in english:
        slug, _, field = key.partition(".")
        spell = matched.get(slug)
        if not spell:
            continue
        value = {
            "name": spell["name"], "desc": spell["desc"], "higherLevel": spell["higherLevel"],
            "material": spell["material"], "castingTime": spell["castingTime"],
            "range": spell["range"], "duration": spell["duration"],
        }.get(field)
        if value:
            out[key] = value
    target = ROOT / "locales" / lang / "srd52"
    target.mkdir(parents=True, exist_ok=True)
    (target / "spells.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return len(out)


def write_school_names(lang: str, spells: list[dict]) -> int:
    """School names are the first word of the school line of the spells ("Evocazione di 3º livello").

    German writes the school inside a compound ("Bannzauber"), so its names are left to Weblate.
    """
    if lang == "de":
        return 0
    words: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for spell in spells:
        if spell["level"] > 0:
            words[spell["school"]][spell["schoolWord"]] += 1
    english = json.loads((ROOT / "locales/en/srd52/schools.json").read_text(encoding="utf-8"))
    out = {
        f"{school}.name": counts.most_common(1)[0][0]
        for school, counts in words.items()
        if f"{school}.name" in english
    }
    (ROOT / "locales" / lang / "srd52" / "schools.json").write_text(
        json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return len(out)


if __name__ == "__main__":
    lang, pdf = sys.argv[1], Path(sys.argv[2])
    parsed = parse_spells(lang, pdf_lines(pdf))
    matched, doubtful = match(parsed)
    print(f"{lang}: parsed {len(parsed)} spells, matched {len(matched)}")
    for slug, name, value in sorted(doubtful, key=lambda x: -x[2])[:15]:
        print(f"  check: {slug} <- {name} ({value})")
    print("wrote", write_locale(lang, matched), "strings")
    print("school names:", write_school_names(lang, parsed))
