import { useEffect } from "preact/hooks";
import { showView } from "../app/navigation";
import { rulesFocus } from "../app/rulesView";

/**
 * The slash key opens the rules page with the cursor in its search field, from anywhere that is
 * not a field to type in. (The header had a button for it too; the Rules tab is the way there.)
 */
export function useSlashSearch() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      showView("rules");
      rulesFocus.value += 1;
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);
}
