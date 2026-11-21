import { useEffect, useState } from "preact/hooks";

/**
 * A whole number the person types. While it is being typed the text is kept as it is (an emptied
 * field stays empty); a valid number is passed on at once, an empty one as `undefined`, and when
 * the field is left it shows the stored value again.
 */
export function NumberField({
  value,
  onChange,
  min,
  max,
  placeholder,
  label,
  class: className,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  label: string;
  class?: string;
}) {
  const shown = value === undefined ? "" : String(value);
  const [text, setText] = useState(shown);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(shown);
  }, [shown, editing]);
  return (
    <input
      type="number"
      class={className}
      inputMode="numeric"
      aria-label={label}
      title={label}
      placeholder={placeholder}
      min={min}
      max={max}
      value={editing ? text : shown}
      onFocus={() => setEditing(true)}
      onInput={(e) => {
        const raw = e.currentTarget.value;
        setText(raw);
        if (raw.trim() === "") return onChange(undefined);
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n)) return;
        onChange(
          Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, n)),
        );
      }}
      onBlur={() => {
        setEditing(false);
        setText(shown);
      }}
    />
  );
}
