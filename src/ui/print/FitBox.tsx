import { useLayoutEffect, useRef } from "preact/hooks";
import { printSettings } from "../../app/printSettings";

/** Type sizes to try, largest first, in points. */
const SIZES = [9.5, 8.5, 7.5, 6.8, 6.2, 5.6];

function shorten(text: string, chars: number): string {
  if (chars >= text.length) return text;
  const cut = text.slice(0, chars);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > chars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Handwritten-style free text that fills its frame: it uses the largest type that fits, and
 * only if even the smallest overflows does it cut the text. Line breaks are kept as typed.
 */
export function FitBox({ text }: { text: string }) {
  const box = useRef<HTMLDivElement>(null);
  const paper = printSettings.value.paper;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new paper size changes the frame size, so the text must be measured again
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fits = () => el.scrollHeight <= el.clientHeight + 1;

    const run = () => {
      el.textContent = text;
      for (const size of SIZES) {
        el.style.fontSize = `${size}pt`;
        if (fits()) return;
      }
      // Even the smallest type overflows: keep the longest start of the text that fits.
      const smallest = SIZES[SIZES.length - 1] ?? 5.6;
      el.style.fontSize = `${smallest}pt`;
      let low = 0;
      let high = text.length;
      while (high - low > 12) {
        const mid = Math.floor((low + high) / 2);
        el.textContent = shorten(text, mid);
        if (fits()) low = mid;
        else high = mid;
      }
      el.textContent = shorten(text, low);
    };

    run();
    // Fonts load after the first paint and change the metrics: measure again once ready.
    void document.fonts?.ready.then(run);
    // The frame can change size without this component re-rendering (zoom, layout changes).
    let lastHeight = el.clientHeight;
    const observer = new ResizeObserver(() => {
      if (el.clientHeight === lastHeight) return;
      lastHeight = el.clientHeight;
      run();
      lastHeight = el.clientHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, paper]);

  // The whole text, for the field of the PDF, even when the frame shows only its start.
  return <div class="p-fit" ref={box} data-value={text} />;
}
