import { useState } from "preact/hooks";
import { fold } from "../../app/search";
import { content } from "../../app/store";
import { workingPack } from "../../app/studio";
import type { Effect } from "../../data/schema";
import {
  type Clause,
  type Literal,
  clausesFromText,
  textFromClauses,
} from "../../homebrew/requirement";
import { ui } from "../../i18n/ui";
import { entriesOfKind } from "../build/fields";
import { optionLabel } from "./labels";
import { humanize } from "./labels";
import { kindName } from "./names";

/** The kinds of entry a character can hold, and so a requirement can ask for. */
const HELD_KINDS = [
  "species",
  "subspecies",
  "class",
  "subclass",
  "background",
  "feat",
  "feature",
  "trait",
  "option",
] as const;

interface Word {
  id: string;
  label: string;
  /** What it is, shown beside the name: a kind of entry, or a flag. */
  hint: string;
}

/** The ids of the flags that effects set, wherever they are written. */
function flagsOf(effects: Effect[] | undefined, into: Set<string>) {
  for (const e of effects ?? []) {
    if (e.type === "flag") into.add(e.id);
    else if (e.type === "when") flagsOf(e.effects, into);
  }
}

/** Every word a requirement can use: the entries a character can hold, and the flags of the content and of the open pack. */
function knownWords(): Word[] {
  const c = content.value;
  const words: Word[] = [];
  const seen = new Set<string>();
  const add = (word: Word) => {
    if (seen.has(word.id)) return;
    seen.add(word.id);
    words.push(word);
  };
  const flags = new Set<string>();
  if (c) {
    for (const kind of HELD_KINDS)
      for (const e of entriesOfKind(kind))
        add({ id: e.id, label: e.label, hint: kindName({ kind, data: {} }) });
    for (const entry of c.index.values()) flagsOf(entry.effects, flags);
  }
  const open = workingPack();
  if (open) {
    for (const entry of open.pack.entries) {
      flagsOf(entry.effects, flags);
      if ((HELD_KINDS as readonly string[]).includes(entry.kind))
        add({
          id: entry.id,
          label: open.strings[`${entry.id}.name`] || entry.id,
          hint: kindName(entry),
        });
    }
  }
  for (const id of flags) add({ id, label: humanize(id), hint: ui("studio.req.flag") });
  return words.sort((a, b) => a.label.localeCompare(b.label));
}

/** A word of a requirement in words a person reads: an entry by its name, a flag made readable, a condition on the sheet in a phrase. */
export function wordLabel(word: string): string {
  const c = content.value;
  if (c?.index.has(word)) return c.name(word);
  const open = workingPack();
  const written = open?.strings[`${word}.name`];
  if (written) return written;
  const sheet = /^\[([a-z]+):(\d+)\]$/.exec(word);
  if (sheet)
    return ui("studio.req.sheet", { ability: optionLabel(sheet[1] ?? ""), n: sheet[2] ?? "" });
  if (/^ID_[A-Z0-9_]+$/.test(word))
    return `${ui("studio.req.internal")}: ${humanize(word.replace(/^ID_/, ""))}`;
  return humanize(word);
}

/** A requirement in a sentence: "has A and has not B, or has C". */
export function describeRequirement(text: string): string {
  const clauses = clausesFromText(text);
  if (clauses === undefined) return text;
  if (clauses.length === 0) return ui("studio.req.always");
  const part = (l: Literal) =>
    `${ui(l.not ? "studio.req.hasNot" : "studio.req.has")} ${wordLabel(l.word)}`;
  return clauses
    .map((clause) => clause.map(part).join(` ${ui("studio.req.and")} `))
    .join(`; ${ui("studio.req.or")} `);
}

/** Picks a word: shows the one chosen, and a search over the known ones when it is opened. */
function WordPicker({ word, onPick }: { word: string; onPick: (word: string) => void }) {
  const [open, setOpen] = useState(word === "");
  const [query, setQuery] = useState("");
  if (!open)
    return (
      <button
        type="button"
        class="studio-word"
        title={word}
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        {word ? wordLabel(word) : ui("studio.req.pick")}
      </button>
    );
  const terms = fold(query).split(/\s+/).filter(Boolean);
  const found = knownWords()
    .filter((w) => terms.every((t) => fold(w.label).includes(t)))
    .slice(0, 30);
  return (
    <div class="studio-word-search">
      <input
        type="search"
        value={query}
        // biome-ignore lint/a11y/noAutofocus: the search opens because the person asked to pick
        autoFocus
        placeholder={ui("studio.req.search")}
        aria-label={ui("studio.req.search")}
        onInput={(e) => setQuery(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && found[0]) {
            e.preventDefault();
            onPick(found[0].id);
            setOpen(false);
          }
        }}
      />
      <ul class="plain studio-word-list">
        {found.map((w) => (
          <li key={w.id}>
            <button
              type="button"
              onClick={() => {
                onPick(w.id);
                setOpen(false);
              }}
            >
              <span>{w.label}</span>
              <span class="muted">{w.hint}</span>
            </button>
          </li>
        ))}
        {found.length === 0 && <li class="muted">{ui("studio.noMatch")}</li>}
      </ul>
      <button type="button" class="link" onClick={() => setOpen(false)}>
        {ui("hb.cancel")}
      </button>
    </div>
  );
}

/**
 * A requirement of the effects of an entry, written as sentences: "has X and has not Y", "or has Z".
 * What it makes is the text the engine reads; a requirement too tangled to list stays as text.
 */
export function RequirementBuilder({
  value,
  onChange,
  raw,
}: {
  value: string;
  onChange: (text: string) => void;
  /** The plain text box under the sentences, for the advanced mode. */
  raw: boolean;
}) {
  // Lines still waiting for a word are kept here: the text has nothing to say about them yet.
  const [draft, setDraft] = useState<Clause[] | undefined>();
  const clauses = draft ?? clausesFromText(value);
  const write = (next: Clause[]) => {
    setDraft(next.some((c) => c.some((l) => l.word === "")) ? next : undefined);
    onChange(textFromClauses(next));
  };
  const text = (
    <label class="field studio-field">
      <span>{ui("studio.req.raw")}</span>
      <input type="text" value={value} onInput={(e) => onChange(e.currentTarget.value)} />
    </label>
  );
  if (clauses === undefined)
    return (
      <div class="studio-req">
        <p class="muted">{ui("studio.req.tangled")}</p>
        {text}
      </div>
    );
  const setLiteral = (i: number, j: number, next: Literal) =>
    write(clauses.map((c, a) => (a === i ? c.map((l, b) => (b === j ? next : l)) : c)));
  const dropLiteral = (i: number, j: number) =>
    write(clauses.map((c, a) => (a === i ? c.filter((_, b) => b !== j) : c)));
  const blank: Literal = { word: "", not: false };
  return (
    <div class="studio-req">
      {clauses.length === 0 && <p class="muted">{ui("studio.req.always")}</p>}
      {clauses.map((clause, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: possibilities have no identity of their own
        <div class="studio-req-clause" key={i}>
          <b class="studio-req-lead">{ui(i === 0 ? "studio.req.when" : "studio.req.orWhen")}</b>
          {clause.map((l, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines have no identity of their own
            <div class="studio-req-line" key={j}>
              <select
                aria-label={ui("studio.req.has")}
                value={l.not ? "not" : "has"}
                onChange={(e) => setLiteral(i, j, { ...l, not: e.currentTarget.value === "not" })}
              >
                <option value="has">{ui("studio.req.has")}</option>
                <option value="not">{ui("studio.req.hasNot")}</option>
              </select>
              <WordPicker word={l.word} onPick={(word) => setLiteral(i, j, { ...l, word })} />
              <button
                type="button"
                class="link"
                aria-label={ui("form.remove")}
                onClick={() => dropLiteral(i, j)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            class="link"
            onClick={() => write(clauses.map((c, a) => (a === i ? [...c, blank] : c)))}
          >
            {ui("studio.req.addAnd")}
          </button>
        </div>
      ))}
      <button type="button" onClick={() => write([...clauses, [blank]])}>
        {ui(clauses.length === 0 ? "studio.req.add" : "studio.req.addOr")}
      </button>
      {raw && text}
    </div>
  );
}
