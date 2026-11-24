import { ui } from "../i18n/ui";
import type { TrackerView } from "../relay/protocol";

/** What is going on around the fight, as far as the DM shows it: the effects of the lair with their rounds. */
export function TableEnvironment({ view }: { view: TrackerView }) {
  if (!view.environment?.length) return null;
  return (
    <div class="table-environment">
      <small class="muted">{ui("table.environment")}</small>
      {view.environment.map((x, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: two effects can have the same name
        <span key={i}>
          {x.name}
          {x.rounds !== undefined && ` · ${ui("play.roundsLeft", { n: x.rounds })}`}
        </span>
      ))}
    </div>
  );
}
