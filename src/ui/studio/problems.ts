import { ui } from "../../i18n/ui";
import { fieldLabel } from "./labels";

/**
 * What the catalog says is wrong with a value (`damage[0].damageType.index: required`) in words a
 * person can act on. What it does not know how to say is shown as it is.
 */
export function explainProblem(raw: string): string {
  const at = raw.indexOf(": ");
  if (at < 0) return raw;
  const path = raw.slice(0, at);
  const what = raw.slice(at + 2);
  const key =
    path
      .split(/[.[\]]/)
      .filter((part) => part && !/^\d+$/.test(part))
      .pop() ?? path;
  const field = fieldLabel(key);
  if (what === "required") return ui("studio.p.required", { field });
  if (/^expected a (whole )?number$/.test(what)) return ui("studio.p.number", { field });
  const min = /^must be at least (-?[\d.]+)$/.exec(what);
  if (min) return ui("studio.p.min", { field, n: min[1] ?? "" });
  const max = /^must be at most (-?[\d.]+)$/.exec(what);
  if (max) return ui("studio.p.max", { field, n: max[1] ?? "" });
  if (what === "unknown field") return ui("studio.p.unknown", { field });
  if (/^expected (text|true or false|an entry id|a name of the rules|one of )/.test(what))
    return ui("studio.p.pick", { field });
  return raw;
}
