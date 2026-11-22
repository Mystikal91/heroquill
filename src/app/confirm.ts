import { signal } from "@preact/signals";

/** A question for the person before something that cannot be taken back. */
export interface ConfirmRequest {
  title: string;
  /** The button that goes ahead. */
  confirm: string;
  /** The button that does not. */
  /** The button that does not; a question that only needs reading has none. */
  cancel?: string;
}

/** The question being asked, and how to answer it. */
export const confirmRequest = signal<
  (ConfirmRequest & { answer: (ok: boolean) => void }) | undefined
>(undefined);

/**
 * Asks in a dialog of the app, instead of the browser's own box: resolves to true when the person
 * goes ahead and to false when they do not (or close the dialog). Use it only for what cannot be
 * undone; for the rest do the thing and `offerUndo`.
 */
export function askConfirm(request: ConfirmRequest): Promise<boolean> {
  return new Promise((resolve) => {
    // A second question while one is open answers the first with no.
    confirmRequest.value?.answer(false);
    confirmRequest.value = {
      ...request,
      answer: (ok) => {
        confirmRequest.value = undefined;
        resolve(ok);
      },
    };
  });
}
