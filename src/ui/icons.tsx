import type { ComponentChildren } from "preact";

const Icon = ({ children }: { children: ComponentChildren }) => (
  <svg
    class="ui-icon"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/** A quill: building a character. */
export const QuillIcon = () => (
  <Icon>
    <path d="M20 4C13 4 8.5 8 7.5 14l-3 6 6-3c6-1 10-6 9.500-13z" />
    <path d="M9 16l8-9" />
  </Icon>
);

/** A page with a folded corner: the sheet. */
export const SheetIcon = () => (
  <Icon>
    <path d="M6 3h9l4 4v14H6z" />
    <path d="M15 3v4h4M9 12h7M9 16h7" />
  </Icon>
);

/** A twenty-sided die: play. */
export const DieIcon = () => (
  <Icon>
    <path d="M12 2.5l8 4.5v10l-8 4.5-8-4.5V7z" />
    <path d="M12 8l4 7H8z" />
  </Icon>
);

/** An open book: the rules. */
export const BookIcon = () => (
  <Icon>
    <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z" />
    <path d="M12 6v13" />
  </Icon>
);

/** A printer. */
export const PrinterIcon = () => (
  <Icon>
    <path d="M7 8V3h10v5M6 17H4v-7h16v7h-2" />
    <path d="M7 14h10v7H7z" />
  </Icon>
);

/** A circle with an i. */
export const FlagIcon = () => (
  <Icon>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </Icon>
);

/** An arrow into a tray: put the app on the device. */
export const DownloadIcon = () => (
  <Icon>
    <path d="M12 4v11" />
    <path d="M7.5 11.5L12 16l4.500-4.500" />
    <path d="M5 20h14" />
  </Icon>
);

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.500v.5" />
  </Icon>
);

/** A box: content packs. */
export const BoxIcon = () => (
  <Icon>
    <path d="M12 3l8 4v10l-8 4-8-4V7z" />
    <path d="M4 7l8 4 8-4M12 11v10" />
  </Icon>
);

/** A flask: the homebrew editor. */
export const FlaskIcon = () => (
  <Icon>
    <path d="M9 3h6M10 3v6l-5 10a1.500 1.500 0 001.300 2h11.400a1.500 1.500 0 001.300-2l-5-10V3" />
    <path d="M8 14h8" />
  </Icon>
);

/** A globe: translation. */
export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
  </Icon>
);

/** A heart: credits. */
export const HeartIcon = () => (
  <Icon>
    <path d="M12 20s-7-4.400-7-10a4 4 0 017-2.500A4 4 0 0119 10c0 5.600-7 10-7 10z" />
  </Icon>
);

/** Two crossed swords: running a game (the Dungeon Master mode). */
export const SwordsIcon = () => (
  <Icon>
    <path d="M5 4l9 9M4 5l2-2 9 9-2 2zM19 4l-9 9M20 5l-2-2-9 9 2 2z" />
    <path d="M6 17l-2 2M18 17l2 2M8.500 15.500l-2.500 2.500M15.500 15.500l2.500 2.500" />
  </Icon>
);

/** Three columns: choosing the columns of a table. */
export const ColumnsIcon = () => (
  <Icon>
    <rect x="3.500" y="4.500" width="17" height="15" rx="1.500" />
    <path d="M9.500 4.500v15M15 4.500v15" />
  </Icon>
);

/** A plus: add. */
export const PlusIcon = () => (
  <Icon>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

/** A bar and a triangle to the left: the previous turn. */
export const StepBackIcon = () => (
  <Icon>
    <path d="M6 5v14M18 6v12l-9-6z" />
  </Icon>
);

/** Three dots: more. */
export const DotsIcon = () => (
  <Icon>
    <circle cx="5.500" cy="12" r="1.100" />
    <circle cx="12" cy="12" r="1.100" />
    <circle cx="18.500" cy="12" r="1.100" />
  </Icon>
);

/** A shield: a player character. */
export const ShieldIcon = () => (
  <Icon>
    <path d="M12 3.500l7 2.500v5.500c0 4.200-2.800 7.600-7 9-4.200-1.400-7-4.800-7-9V6z" />
  </Icon>
);

/** Three claw marks: a creature of the DM. */
export const PawIcon = () => (
  <Icon>
    <path d="M7 4c1.500 4 1.500 9 0 16M12 3.500c1.500 4.500 1.500 12 0 17M17 4c1.500 4 1.500 9 0 16" />
  </Icon>
);

/** A triangle and a bar to the right: the next turn. */
export const StepForwardIcon = () => (
  <Icon>
    <path d="M18 5v14M6 6v12l9-6z" />
  </Icon>
);
