import { useState } from "preact/hooks";
import { language } from "../../app/language";
import { printSettings } from "../../app/printSettings";
import { ui } from "../../i18n/ui";
import { printedCharacter } from "./printSource";

/** A name for the file: the character's, in plain letters, or "blank sheet". */
function fileName(name: string): string {
  const plain = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${plain || "character-sheet"}.pdf`;
}

/**
 * Makes the PDF with fields from the pages on screen and hands it over as a file. The writer and
 * its fonts are loaded only when the button is pressed.
 */
export function PdfButton({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const make = async () => {
    const paper = document.getElementById("print-paper");
    if (!paper) return;
    setState("busy");
    try {
      const { writePdf } = await import("./pdf/writePdf");
      const settings = printSettings.value;
      const name = settings.blank ? ui("print.blankSheet") : printedCharacter.value.name;
      const bytes = await writePdf(paper, {
        paper: settings.paper,
        title: name || ui("sheet.unnamed"),
        lang: language.value,
      });
      const url = URL.createObjectURL(
        new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(name);
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setState("idle");
    } catch (error) {
      console.error("Making the PDF failed", error);
      setState("failed");
    }
  };
  return (
    <>
      <button type="button" onClick={make} disabled={disabled || state === "busy"}>
        {state === "busy" ? ui("print.pdfBusy") : ui("print.pdf")}
      </button>
      {state === "failed" && (
        <p class="print-error" role="alert">
          {ui("print.pdfFailed")}
        </p>
      )}
    </>
  );
}
