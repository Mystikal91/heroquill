import type { EntryKind } from "./kinds";

/**
 * How the editor sees a value: the small language the catalog describes entries in. The effects
 * are read from the schema of the engine (`introspect.ts`); the `data` of each kind is written
 * here by hand (`data.ts`). Either way the editor, the validation and the coverage tests all work
 * from these descriptions, so a field exists in one place only.
 */
export type FieldType =
  /** Free text; `pick` says it is one of a short closed list the editor offers by name (kinds of damage). */
  | { type: "text"; pick?: "damage" | "color" | "column" | "reserve" }
  | { type: "number"; integer?: boolean; min?: number; max?: number; unit?: "distance" | "weight" }
  | { type: "boolean" }
  | { type: "choice"; options: readonly string[] }
  | { type: "literal"; value: string | number | boolean }
  /** The id of an entry (`pack:kind/slug`), of one of these kinds when they are named. */
  | { type: "ref"; kinds?: readonly EntryKind[] }
  /** The slug of an entry of a kind (a skill, a school, a language): the form the rules write it in. */
  | { type: "slug"; kind: EntryKind }
  /** A dice expression: `1d8`, `2d6+3`, `1d8 + MOD`. */
  | { type: "dice" }
  | { type: "list"; of: FieldType }
  | { type: "object"; fields: FieldSpec[] }
  /** Values by key; `keys` lists the keys that make sense (the abilities, the speeds...). */
  | {
      type: "record";
      of: FieldType;
      keys?: readonly string[];
      /** The keys are levels: of the spell slot (1 to 9) or of the character (1 to 20). */
      levels?: "slot" | "character";
    }
  | { type: "union"; of: FieldType[] }
  | { type: "variant"; on: string; cases: Record<string, FieldSpec[]> }
  /** A list of effects, as in `when`. */
  | { type: "effects" }
  /** Any value, kept as it was written: for what the engine reads loosely and the editor cannot yet describe. */
  | { type: "json" };

/**
 * Who a field is for: `guided` fields are what a beginner is shown; `advanced` ones are there for
 * the person who wants every control.
 */
export type FieldLevel = "guided" | "advanced";

export interface FieldSpec {
  key: string;
  type: FieldType;
  optional: boolean;
  level: FieldLevel;
  /** A line for developers (and, later, for the help of the editor). */
  doc?: string;
}

/** Shorthand for writing a list of field specs. */
export const field = (
  key: string,
  type: FieldType,
  options: { required?: boolean; level?: FieldLevel; doc?: string } = {},
): FieldSpec => ({
  key,
  type,
  optional: !options.required,
  level: options.level ?? (options.required ? "guided" : "advanced"),
  ...(options.doc && { doc: options.doc }),
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const ENTRY_ID = /^[a-z0-9]+:[a-z]+\/[a-z0-9]+(-+[a-z0-9]+)*$/;

/** What is wrong with a value for a type, as short messages that start with the path. Empty when it fits. */
export function checkValue(type: FieldType, value: unknown, path = ""): string[] {
  const bad = (what: string) => [`${path || "value"}: ${what}`];
  switch (type.type) {
    case "text":
    case "dice":
      return typeof value === "string" ? [] : bad("expected text");
    case "number": {
      if (typeof value !== "number" || !Number.isFinite(value)) return bad("expected a number");
      if (type.integer && !Number.isInteger(value)) return bad("expected a whole number");
      if (type.min !== undefined && value < type.min) return bad(`must be at least ${type.min}`);
      if (type.max !== undefined && value > type.max) return bad(`must be at most ${type.max}`);
      return [];
    }
    case "boolean":
      return typeof value === "boolean" ? [] : bad("expected true or false");
    case "choice":
      return typeof value === "string" && type.options.includes(value)
        ? []
        : bad(`expected one of ${type.options.join(", ")}`);
    case "literal":
      return value === type.value ? [] : bad(`expected ${String(type.value)}`);
    case "ref":
      return typeof value === "string" && ENTRY_ID.test(value) ? [] : bad("expected an entry id");
    case "slug":
      return typeof value === "string" && value !== "" ? [] : bad("expected a name of the rules");
    case "list":
      return Array.isArray(value)
        ? value.flatMap((item, i) => checkValue(type.of, item, `${path}[${i}]`))
        : bad("expected a list");
    case "record":
      return isObject(value)
        ? Object.entries(value).flatMap(([k, item]) =>
            checkValue(type.of, item, path ? `${path}.${k}` : k),
          )
        : bad("expected an object");
    case "object":
      return checkFields(type.fields, value, path);
    case "union": {
      const tries = type.of.map((t) => checkValue(t, value, path));
      return tries.some((t) => t.length === 0) ? [] : (tries[0] ?? bad("no match"));
    }
    case "variant": {
      if (!isObject(value)) return bad("expected an object");
      const key = value[type.on];
      const fields = typeof key === "string" ? type.cases[key] : undefined;
      if (!fields) return bad(`${type.on} must be one of ${Object.keys(type.cases).join(", ")}`);
      // The key that tells the cases apart is part of every case.
      const tag = field(type.on, { type: "literal", value: key as string }, { required: true });
      return checkFields([tag, ...fields], value, path);
    }
    case "effects":
      return Array.isArray(value) ? [] : bad("expected a list of effects");
    case "json":
      return [];
  }
}

/** Checks an object against the fields of a kind: missing required fields, wrong types, unknown keys. */
export function checkFields(fields: FieldSpec[], value: unknown, path = ""): string[] {
  if (!isObject(value)) return [`${path || "value"}: expected an object`];
  const problems: string[] = [];
  const known = new Set(fields.map((f) => f.key));
  for (const key of Object.keys(value))
    if (!known.has(key)) problems.push(`${path ? `${path}.` : ""}${key}: unknown field`);
  for (const spec of fields) {
    const here = path ? `${path}.${spec.key}` : spec.key;
    const item = value[spec.key];
    if (item === undefined) {
      if (!spec.optional) problems.push(`${here}: required`);
      continue;
    }
    problems.push(...checkValue(spec.type, item, here));
  }
  return problems;
}
