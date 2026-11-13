import { useEffect, useRef } from "preact/hooks";
import { diceOpen } from "../../app/playView";
import { ui } from "../../i18n/ui";
import { DiceTray, RollHistory } from "./Rolls";

const close = () => {
  diceOpen.value = false;
};

/** A round button that opens the dice and the roll history; shown on a phone only. */
export function DiceButton({ inHead }: { inHead?: boolean }) {
  return (
    <button
      type="button"
      class={inHead ? "dice-head" : "dice-fab"}
      title={ui("play.dice")}
      aria-label={ui("play.dice")}
      onClick={() => {
        diceOpen.value = true;
      }}
    >
      d20
    </button>
  );
}

/** The dice and the roll history in a sheet over the screen, so they take no room in the page. */
export function DiceDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const open = diceOpen.value;
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialog}
      class="dice-drawer"
      onClose={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
      onClick={(e) => {
        // A tap on the dark area around the sheet closes it.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div class="dice-drawer-body">
        <div class="drawer-close">
          <button type="button" class="link" aria-label={ui("transfer.close")} onClick={close}>
            {"✕"}
          </button>
        </div>
        <DiceTray />
        <RollHistory />
      </div>
    </dialog>
  );
}
