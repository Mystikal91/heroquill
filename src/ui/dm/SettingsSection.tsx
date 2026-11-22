import { type OnlineSettings, onlineSettings, setOnline } from "../../app/dmSettings";
import { type UiKey, ui } from "../../i18n/ui";

const ROWS: { key: keyof OnlineSettings; label: UiKey; hint: UiKey }[] = [
  { key: "hideOrder", label: "dm.set.hideOrder", hint: "dm.set.hideOrderHint" },
  { key: "hideBands", label: "dm.set.hideBands", hint: "dm.set.hideBandsHint" },
  { key: "hideNames", label: "dm.set.hideNames", hint: "dm.set.hideNamesHint" },
  { key: "askInitiative", label: "dm.set.askInitiative", hint: "dm.set.askInitiativeHint" },
];

/** What the DM keeps from the players at the online table. Each one takes effect at once. */
export function SettingsSection() {
  const now = onlineSettings.value;
  return (
    <div class="dm-settings">
      <section>
        <h3>{ui("dm.set.online")}</h3>
        <p class="muted">{ui("dm.set.onlineHint")}</p>
        <ul class="plain dm-set-list">
          {ROWS.map((row) => (
            <li key={row.key}>
              <label class="dm-check">
                <input
                  type="checkbox"
                  checked={now[row.key]}
                  onChange={(e) => setOnline({ [row.key]: e.currentTarget.checked })}
                />
                <span>{ui(row.label)}</span>
              </label>
              <small class="muted">{ui(row.hint)}</small>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
