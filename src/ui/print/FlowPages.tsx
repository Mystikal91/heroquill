import type { VNode } from "preact";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { printSettings } from "../../app/printSettings";
import { Sheet } from "./PageFoot";
import { type FlowItem, type FlowPlan, planFlow } from "./flow";

export interface FlowBlock {
  key: string;
  node: VNode;
  /** A title: it stays with the block that follows it. */
  keep?: boolean;
  /** The pieces the block is cut into when it is taller than a whole column. */
  parts?: { key: string; node: VNode }[];
}

const heightOf = (root: HTMLElement, selector: string) =>
  root.querySelector<HTMLElement>(selector)?.getBoundingClientRect().height ?? 0;

/**
 * A long text on as many pages as it needs, in columns: the blocks are first drawn out of sight in
 * one column to measure them, then put on pages (`planFlow`). `head` opens the first page, and
 * `columnHead` (the head of a table) opens every column.
 */
export function FlowPages({
  blocks,
  head,
  columnHead,
  columns = 2,
  class: className = "",
}: {
  blocks: FlowBlock[];
  head?: VNode | null;
  columnHead?: VNode;
  columns?: number;
  class?: string;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [plan, setPlan] = useState<FlowPlan | null>(null);
  const paper = printSettings.value.paper;

  useLayoutEffect(() => {
    const root = measure.current;
    if (!root) return;
    const run = () => {
      const body = heightOf(root, ".p-measure-body");
      const top = heightOf(root, ".p-measure-head");
      const colHead = heightOf(root, ".p-measure-colhead");
      const height = (key: string) => heightOf(root, `[data-flow="${CSS.escape(key)}"]`);
      const items: FlowItem[] = blocks.map((b) => ({
        key: b.key,
        height: height(b.key),
        ...(b.keep ? { keep: true } : {}),
        ...(b.parts ? { parts: b.parts.map((p) => ({ key: p.key, height: height(p.key) })) } : {}),
      }));
      const next = planFlow(items, columns, body - top - colHead, body - colHead);
      setPlan((old) => (JSON.stringify(old) === JSON.stringify(next) ? old : next));
    };
    run();
    void document.fonts?.ready.then(run);
  });

  const nodes = new Map<string, VNode>();
  for (const b of blocks) {
    nodes.set(b.key, b.node);
    for (const p of b.parts ?? []) nodes.set(p.key, p.node);
  }
  const style = `--flow-cols: ${columns}`;

  return (
    <>
      {/* Out of sight: the blocks in one column, to know how tall each one is. */}
      <div
        class={`p-measure ${className}`.trim()}
        ref={measure}
        aria-hidden="true"
        data-paper={paper}
      >
        <div class="p-measure-body" />
        <div class="p-measure-head">{head}</div>
        <div class="p-flow-cols" style={style}>
          <div class="p-flow-col">
            {columnHead && <div class="p-measure-colhead">{columnHead}</div>}
            {blocks.flatMap((b) => [
              <div class="p-flow-item" data-flow={b.key} key={b.key}>
                {b.node}
              </div>,
              ...(b.parts ?? []).map((p) => (
                <div class="p-flow-item" data-flow={p.key} key={p.key}>
                  {p.node}
                </div>
              )),
            ])}
          </div>
        </div>
      </div>

      {plan?.map((page, i) => (
        <Sheet class={className} key={page[0]?.[0] ?? `page-${i + 1}`}>
          {i === 0 && head}
          <div class="p-flow-cols" style={style}>
            {Array.from({ length: columns }, (_, c) => (
              <div class="p-flow-col" key={`col-${c + 1}`}>
                {columnHead && (page[c]?.length ?? 0) > 0 && columnHead}
                {(page[c] ?? []).map((key) => (
                  <div class="p-flow-item" key={key}>
                    {nodes.get(key)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Sheet>
      ))}
    </>
  );
}
