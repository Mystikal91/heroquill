import { signal } from "@preact/signals";

/**
 * What the DM chooses to show the players at the online table. They belong to this device, like the other
 * settings of the DM page (the ruleset, the groups of initiative), and are not in a transfer file.
 */
export interface OnlineSettings {
  /** The players see only whose turn it is, not the order or the initiatives. */
  hideOrder: boolean;
  /** The players do not see how hurt the creatures look. */
  hideBands: boolean;
  /** The creatures that are not the players' show as unknown creatures. */
  hideNames: boolean;
  /** Starting the fight asks the players at the table for their initiative. */
  askInitiative: boolean;
}

export const DEFAULT_ONLINE: OnlineSettings = {
  hideOrder: false,
  hideBands: false,
  hideNames: false,
  askInitiative: true,
};

const KEY = "dmOnlineSettings";

export function readOnline(raw: string | null): OnlineSettings {
  try {
    const data = JSON.parse(raw ?? "null") as Partial<Record<keyof OnlineSettings, unknown>> | null;
    const pick = (key: keyof OnlineSettings) =>
      typeof data?.[key] === "boolean" ? (data[key] as boolean) : DEFAULT_ONLINE[key];
    return {
      hideOrder: pick("hideOrder"),
      hideBands: pick("hideBands"),
      hideNames: pick("hideNames"),
      askInitiative: pick("askInitiative"),
    };
  } catch {
    return DEFAULT_ONLINE;
  }
}

export const onlineSettings = signal<OnlineSettings>(
  (() => {
    try {
      return readOnline(localStorage.getItem(KEY));
    } catch {
      return DEFAULT_ONLINE;
    }
  })(),
);

export function setOnline(change: Partial<OnlineSettings>) {
  onlineSettings.value = { ...onlineSettings.value, ...change };
  try {
    localStorage.setItem(KEY, JSON.stringify(onlineSettings.value));
  } catch {
    // The choice holds for this visit.
  }
}
