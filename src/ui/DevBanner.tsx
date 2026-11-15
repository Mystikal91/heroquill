import { ui } from "../i18n/ui";

/** True in the build of a branch that is shown to testers: it keeps to its own address and its own data. */
export const isDevelopBuild = import.meta.env.VITE_CHANNEL === "develop";

/** A line at the top of the preview, so that nobody takes it for the normal version. */
export function DevBanner() {
  if (!isDevelopBuild) return null;
  return (
    <aside class="dev-banner no-print" role="note">
      <span>{ui("dev.banner")}</span> <a href="https://heroquill.app/app/">{ui("dev.normal")}</a>
    </aside>
  );
}
