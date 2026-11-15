/**
 * The undo history of the pack being worked on. A change replaces the whole record, so undoing is
 * putting an earlier record back. Changes of one kind made in quick succession (typing in a field)
 * count as one step, so a person undoes a sentence, not a letter.
 */
export interface History<T> {
  present: T;
  past: T[];
  future: T[];
  /** What the last change was about (an entry and a field), to join the next one to it. */
  lastKey?: string | undefined;
  lastAt: number;
}

/** The most steps kept. */
export const HISTORY_LIMIT = 100;
/** Changes with the same key closer than this (ms) are one step. */
export const JOIN_MS = 1200;

export const startHistory = <T>(present: T): History<T> => ({
  present,
  past: [],
  future: [],
  lastAt: 0,
});

/** Records a change. With a `key`, it joins the previous step when that had the same key and was recent. */
export function change<T>(
  history: History<T>,
  next: T,
  key?: string,
  now = Date.now(),
): History<T> {
  if (next === history.present) return history;
  const joins = key !== undefined && key === history.lastKey && now - history.lastAt < JOIN_MS;
  const past = joins ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { present: next, past, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) return history;
  return {
    present: previous,
    past: history.past.slice(0, -1),
    future: [history.present, ...history.future],
    lastAt: 0,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future;
  if (next === undefined) return history;
  return { present: next, past: [...history.past, history.present], future: rest, lastAt: 0 };
}

/** A new present that is not a step (the record was refreshed from storage): the history stays. */
export const replacePresent = <T>(history: History<T>, present: T): History<T> => ({
  ...history,
  present,
});

export const canUndo = (h: History<unknown>) => h.past.length > 0;
export const canRedo = (h: History<unknown>) => h.future.length > 0;
