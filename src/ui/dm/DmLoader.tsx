import type { ComponentType } from "preact";
import { useEffect, useState } from "preact/hooks";
import { ui } from "../../i18n/ui";

/**
 * The Dungeon Master mode is its own piece of the app: a player never downloads it. It loads when
 * the page is opened.
 */
export function DmLoader() {
  const [Page, setPage] = useState<ComponentType | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let current = true;
    import("./DmPage").then(
      (module) => {
        if (current) setPage(() => module.DmPage);
      },
      () => {
        if (current) setFailed(true);
      },
    );
    return () => {
      current = false;
    };
  }, []);
  if (failed) return <p role="alert">{ui("app.loadError")}</p>;
  if (!Page) return <p>{ui("app.loading")}</p>;
  return <Page />;
}
