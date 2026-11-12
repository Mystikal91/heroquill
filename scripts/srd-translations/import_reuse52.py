"""Names of languages and proficiencies of the SRD 5.2.1, from the 5.1 translation of the same slug.

The 5.1 importers wrote names for languages and proficiencies (`import_tables.py`, `import_proficiencies.py`). A
2024 entry with the same slug takes that name when the 5.2.1 book of the language still writes it (compared
without case and accents); what the new book does not write stays English until it is read.

Usage: python import_reuse52.py [it fr de es]
"""

from __future__ import annotations

import json
import sys

import book52
from import_reference import plain

ROOT = book52.ROOT
KINDS = ("languages", "proficiencies", "alignments")


def run(lang: str) -> None:
    text = plain(" ".join(l["text"].replace("**", "") for l in book52.book_lines(book52.pdf_path(lang))).lower())
    for kind in KINDS:
        en = json.loads((ROOT / f"locales/en/srd52/{kind}.json").read_text(encoding="utf-8"))
        old_path = ROOT / f"locales/{lang}/srd51/{kind}.json"
        old = json.loads(old_path.read_text(encoding="utf-8")) if old_path.exists() else {}
        out, missing, absent = {}, [], []
        for k in en:
            if not k.endswith(".name"):
                continue
            abbreviation = k[: -len(".name")] + ".abbreviation"
            name = old.get(k)
            if not name:
                missing.append(k[:-5])
            elif plain(name.lower()) in text or all(
                # a composed or plural name ("Skill: Acrobatics", "Rapiers"): every word, cut to five letters, is there
                plain(w.lower())[:5] in text
                for w in name.replace(":", " ").split()
                if len(w) >= 4
            ):
                out[k] = name
                if old.get(abbreviation) and abbreviation in en:
                    out[abbreviation] = old[abbreviation]  # the abbreviation of an alignment (LG...)
            else:
                absent.append((k[:-5], name))
        if kind == "alignments" and "unaligned" in missing:
            # "Unaligned" has no 5.1 name: the books write it in the alignment of the monsters that have none.
            mo_en = json.loads((ROOT / "locales/en/srd52/monsters.json").read_text(encoding="utf-8"))
            mo_tr = json.loads((ROOT / f"locales/{lang}/srd52/monsters.json").read_text(encoding="utf-8"))
            words = [mo_tr[k] for k, v in mo_en.items() if k.endswith(".alignment") and v == "unaligned" and k in mo_tr]
            if words:
                best = max(set(words), key=words.count)
                out["unaligned.name"] = best[0].upper() + best[1:]
                missing.remove("unaligned")
        (ROOT / f"locales/{lang}/srd52/{kind}.json").write_text(
            json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{lang} {kind}: {len(out)} of {sum(1 for k in en if k.endswith('.name'))}; no 5.1 name: {missing}; not in the new book: {absent}")


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
