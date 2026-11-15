import { signal } from "@preact/signals";
import { newHomebrewPack } from "../homebrew/pack";
import { showView } from "./navigation";
import { addUserPack, userPacks } from "./userPacks";

/** The homebrew pack open in the studio. */
export const editingPackId = signal<string | undefined>(undefined);

/** Starts a homebrew pack and opens it in the studio. */
export async function createHomebrewPack(name: string): Promise<void> {
  const record = newHomebrewPack(name);
  await addUserPack(record);
  openHomebrewPack(record.id);
}

export function openHomebrewPack(id: string): void {
  editingPackId.value = id;
  showView("homebrew");
}

/** Back to the studio with no pack open. */
export function closeHomebrewPack(): void {
  editingPackId.value = undefined;
}

/** Opens the studio with no pack open, from wherever it was last left. */
export function showHomebrewList(): void {
  closeHomebrewPack();
  showView("homebrew");
}

/** The entry belongs to a homebrew pack: the person wrote it. */
export function isHomebrewId(id: string): boolean {
  const pack = id.split(":")[0];
  return userPacks.value.some((p) => p.origin === "homebrew" && p.id === pack);
}
