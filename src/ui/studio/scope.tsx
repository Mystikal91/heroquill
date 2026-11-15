import { createContext } from "preact";
import { useContext } from "preact/hooks";
import { applyChange } from "../../app/studio";
import type { UserPackRecord } from "../../storage/packs";

/**
 * Where the changes of a form go. In the studio they go to the open pack, with its history and its
 * saving; a window that edits a pack of its own (a spell written from a character, an item customized
 * from the inventory) gives its own, so the same forms work in both.
 */
export interface EditScope {
  /** Takes the pack as it is after the change; `key` joins quick changes of one thing into one step. */
  apply: (next: UserPackRecord, key?: string) => void;
}

const EditContext = createContext<EditScope>({ apply: applyChange });

export const EditProvider = EditContext.Provider;
export const useEdit = (): EditScope => useContext(EditContext);
