"""Translations of the monsters of the SRD 5.2.1 from the official books (it, fr, de, es).

An adaptation of `import_monsters.py`: what it does once a stat block is read is kept (the numeric signature
of a block, the pairing of twins, `pair_entries`, which pairs the traits and actions of a block with the English
ones by numbers and length because the translated books sort them alphabetically, the glossary of names learned
from the entries that agree). What changes is the reading of the block, which in 5.2.1 is
a heading of size 15 with the name, an italic line (size, type, alignment), the facts as bold labels (AC,
Initiative, HP, Speed, Skills, Senses, Languages, CR), a table of abilities, and sections "Traits",
"Actions", "Bonus Actions", "Reactions", "Legendary Actions" whose entries start with a bold run-in name. The
traits and actions of a block are paired together (the 5.2.1 data keeps them in four lists, the books in five
sections); a pair another could replace almost as well stays English.

Usage: python import_monsters52.py [it fr de es]
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter

import book52
import import_monsters as old
from import_monsters import Block, Entry, clean_name, pair_blocks, pair_entries, profile, USAGE_NAME

ROOT = book52.ROOT
SECTIONS = ["special", "actions", "bonusActions", "reactions", "legendary"]
FACT = re.compile(r"^\*\*(.+?)\*\*\s*(.*)$", re.S)
SCORE_ROW = re.compile(r"^\s*([^\W\d_]{2,5})\.?\s+(\d{1,2})(?:\s|$)")


def english_monsters() -> dict:
    data = json.loads((ROOT / "data/srd52/monsters.json").read_text(encoding="utf-8"))["entries"]
    strings = json.loads((ROOT / "locales/en/srd52/monsters.json").read_text(encoding="utf-8"))
    out = {}
    for e in data:
        slug = e["id"].split("/")[1]
        d = e["data"]
        a = d["abilities"]
        out[slug] = {
            "sig": (d["armorClass"][0]["value"], d["hitPoints"], d["xp"], (a["str"], a["dex"], a["con"], a["int"], a["wis"], a["cha"])),
            "data": d,
            "strings": {k: v for k, v in strings.items() if k.startswith(f"{slug}.")},
        }
    return out


def first_int(text: str):
    m = re.search(r"\d[\d.,]*", text)
    return int(re.sub(r"\D", "", m.group())) if m else None


def signature(b: Block):
    if len(b.scores) != 6 or len(b.facts) < 5:
        return None
    m = re.search(r"\(\s*[^\W\d_]{1,4}\.?\s*(\d[\d.,    ]*)", b.facts[-1])
    return (first_int(b.facts[0]), first_int(b.facts[2]), int(re.sub(r"\D", "", m.group(1))) if m else None, tuple(b.scores))


old.block_signature = signature  # `pair_blocks` reads the signature through the module


class Parsed(Block):
    pass


def read_blocks(lang: str) -> list[Block]:
    lines = book52.book_lines(book52.pdf_path(lang))
    start = next(i for i, l in enumerate(lines) if l["head"] == 26 and re.search(r"A\s*[–-]\s*Z|A bis Z|a la Z|à Z", l["text"]))
    blocks: list[Block] = []
    i = start + 1
    n = len(lines)
    while i < n:
        if lines[i]["head"] != 15:
            i += 1
            continue
        name = lines[i]["text"].strip()
        i += 1
        while i < n and lines[i]["head"] == 15:
            name += " " + lines[i]["text"].strip()
            i += 1
        j = i
        while j < n and lines[j]["head"] not in (15, 18, 26):
            j += 1
        body = lines[i:j]
        i = j
        facts_started = any(l["text"].startswith("**") and not l["head"] for l in body[:6])
        if not facts_started:
            continue
        type_line = ""
        for l in body:
            if not l["head"]:
                type_line = l["text"].strip()
                break
        block = Block(name, type_line)
        # facts, ability scores, then sections
        scores: list[int] = []
        facts: list[list[str]] = []
        sections: list[list[dict]] = [[]]
        in_sections = False
        for l in body:
            text = l["text"].strip()
            if l["head"] == 12:
                in_sections = True
                sections.append([])
                continue
            if l["head"]:
                m = SCORE_ROW.match(text)
                if not in_sections and m and len(scores) < 6:
                    scores.append(int(m.group(2)))
                continue
            if in_sections:
                sections[-1].append(l)
            elif FACT.match(text):
                facts.append([text])
            elif facts and text != type_line:
                facts[-1].append(text)
        block.scores = scores
        block.facts = [" ".join(f) for f in facts]
        # facts hold "**Label** value"; keep the value
        block.facts = [FACT.sub(lambda m: m.group(2), f).strip() if FACT.match(f) else f for f in block.facts]
        block.sections = []
        for sec in sections[1:]:
            entries: list[Entry] = []
            for para in book52.text_of(sec, bold=True).split("\n"):
                m = FACT.match(para)
                # A bold label inside an entry ("Hit:", "Failure:") is not the name of an entry: the names end with
                # a full stop (with a colon in German, whose labels are not bold).
                if m and entries and lang != "de" and not m.group(1).rstrip().endswith("."):
                    if entries[-1].extra:  # type: ignore[attr-defined]
                        entries[-1].extra[-1] += " " + para  # type: ignore[attr-defined]
                    else:
                        entries[-1].first += " " + para
                elif m:
                    entries.append(Entry(m.group(1).strip().rstrip(".:").strip(), [], m.group(2).strip()))
                    entries[-1].extra = []  # type: ignore[attr-defined]
                elif entries:
                    entries[-1].extra.append(para)  # type: ignore[attr-defined]
            block.sections.append(entries)
        block.text = " ".join(l["text"] for l in body)
        blocks.append(block)
    return blocks


def entry_paragraphs(e: Entry) -> list[str]:
    return [p.replace("**", "") for p in [e.first, *getattr(e, "extra", [])] if p]


def run(lang: str) -> None:
    old.load_terms(lang)
    blocks = read_blocks(lang)
    english = english_monsters()
    pairs = pair_blocks(blocks, english)
    glossary: dict[str, str] = {}
    out: dict[str, str] = {}
    report: Counter = Counter()
    problems: list[str] = []
    for _ in range(2):
        out, report, problems = {}, Counter(), []
        for slug, block, shared in pairs:
            fill(slug, block, english, out, glossary, shared, report, problems)
        seen: dict[str, Counter] = {}
        for k, v in out.items():
            if re.search(r"\.(special|actions|bonusActions|reactions|legendary)\.\d+\.name$", k):
                en_name = english[k.split(".")[0]]["strings"].get(k, "")
                seen.setdefault(clean_name(en_name), Counter())[clean_name(v)] += 1
        glossary = {en: c.most_common(1)[0][0] for en, c in seen.items() if c.most_common(1)[0][1] >= 2 or len(c) == 1}
    target = ROOT / f"locales/{lang}/srd52/monsters.json"
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    missing = sorted(set(english) - {s for s, _, _ in pairs})
    print(lang, "blocks read", len(blocks), "paired", len(pairs), "of", len(english), "English;", len(out), "texts;", dict(report))
    if problems:
        print(f"  structure differs ({len(problems)}):", "; ".join(problems))
    print("  without a block:", ", ".join(missing[:40]), "..." if len(missing) > 40 else "")


def fill(slug: str, block: Block, english: dict, out: dict, glossary: dict, shared: bool, report: Counter, problems: list) -> None:
    e = english[slug]
    strings, data = e["strings"], e["data"]
    if not shared:
        out[f"{slug}.name"] = block.name
    # alignment: the end of the type line, after the comma outside brackets
    al = old.alignment_of(block.type_line)
    if f"{slug}.alignment" in strings and al:
        out[f"{slug}.alignment"] = al
    facts = block.facts
    if len(facts) >= 7:  # AC, Initiative, HP, Speed, then optional facts, then Senses, Languages and CR
        languages = facts[-2]
        if languages and languages not in ("—", "-", "–") and strings.get(f"{slug}.languages"):
            out[f"{slug}.languages"] = languages
        middle = facts[4:-3]
        roles = []
        if data.get("skills"):
            roles.append("skills")
        roles += [f for f in ("vulnerabilities", "resistances", "immunities") if f"{slug}.{f}" in strings]
        if len(middle) >= len(roles):
            offset = 1 if roles and roles[0] == "skills" else 0
            for role, value in zip(roles[offset:], middle[offset:]):
                if value:
                    out[f"{slug}.{role}"] = value
    # traits and actions: every entry of the block against every English one
    entries = [en for sec in block.sections for en in sec]
    wanted_keys = [(k, n) for k in SECTIONS for n in range(len(data.get(k) or []))]
    if not entries or not wanted_keys:
        report["monsters"] += 1
        return
    texts = [entry_paragraphs(en) for en in entries]
    wanted = [old.entry_numbers(strings, data[k][n], f"{slug}.{k}.{n + 1}") for k, n in wanted_keys]
    found = [profile(f"{en.name} {' '.join(p)}", False) for en, p in zip(entries, texts)]
    en_len = [len(strings.get(f"{slug}.{k}.{n + 1}.desc", "")) for k, n in wanted_keys]
    sizes = [len(" ".join(p)) for p in texts]
    known = [glossary.get(clean_name(strings.get(f"{slug}.{k}.{n + 1}.name", ""))) for k, n in wanted_keys]
    bonus = [[-0.5 if known[r] and known[r] == clean_name(en.name) else 0.0 for en in entries] for r in range(len(wanted_keys))]
    first = "actions" in data and data["actions"] and "multiattack" in data["actions"][0]
    if len(entries) != len(wanted_keys):
        problems.append(f"{slug}: {len(entries)} in the book, {len(wanted_keys)} in the data")
    for r, c in pair_entries(wanted, found, en_len, sizes, bool(first), bonus):
        k, n = wanted_keys[r]
        prefix = f"{slug}.{k}.{n + 1}"
        english_name = strings.get(f"{prefix}.name", "")
        entry, paras = entries[c], texts[c]
        out[f"{prefix}.name"] = entry.name if "(" in english_name else USAGE_NAME.sub("", entry.name)
        template = re.findall(r"\n+", strings.get(f"{prefix}.desc", ""))
        if paras and len(template) == len(paras) - 1:
            out[f"{prefix}.desc"] = paras[0] + "".join(sep + p for sep, p in zip(template, paras[1:]))
        else:
            out[f"{prefix}.desc"] = "\n".join(paras)
        report["entries"] += 1
    report["monsters"] += 1


if __name__ == "__main__":
    for lang in sys.argv[1:] or ["it", "fr", "de", "es"]:
        run(lang)
