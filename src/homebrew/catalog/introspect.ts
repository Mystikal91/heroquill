import { EntryIdSchema } from "../../data/schema";
import { type FieldSpec, type FieldType, field } from "./fields";

/**
 * Reads a valibot schema (the one the engine validates effects with) as the editor's field
 * descriptions. This is what keeps the editor in step with the engine: a new effect, or a new
 * field on one, shows up here without anyone writing a form for it.
 */

type AnySchema = {
  type: string;
  entries?: Record<string, AnySchema>;
  options?: unknown;
  wrapped?: AnySchema;
  item?: AnySchema;
  value?: unknown;
  literal?: unknown;
  getter?: () => AnySchema;
  pipe?: { type: string; requirement?: unknown }[];
};

/** Fields whose id is only ever one kind of entry, to say so in the description. */
export type RefHints = Record<string, readonly string[]>;

function numberType(schema: AnySchema): FieldType {
  const actions = (schema.pipe ?? []).slice(1);
  const requirement = (name: string) => {
    const found = actions.find((a) => a.type === name)?.requirement;
    return typeof found === "number" ? found : undefined;
  };
  const min = requirement("min_value");
  const max = requirement("max_value");
  return {
    type: "number",
    ...(actions.some((a) => a.type === "integer") && { integer: true }),
    ...(min !== undefined && { min }),
    ...(max !== undefined && { max }),
  };
}

export function typeOf(schema: AnySchema): FieldType {
  if (schema === (EntryIdSchema as unknown as AnySchema)) return { type: "ref" };
  switch (schema.type) {
    case "string":
      return { type: "text" };
    case "number":
      return numberType(schema);
    case "boolean":
      return { type: "boolean" };
    case "picklist":
      return { type: "choice", options: schema.options as string[] };
    case "literal":
      return { type: "literal", value: schema.literal as string | number | boolean };
    case "array":
      return { type: "list", of: typeOf(schema.item as AnySchema) };
    case "record":
      return { type: "record", of: typeOf(schema.value as AnySchema) };
    case "object":
      return { type: "object", fields: fieldsOf(schema) };
    case "optional":
    case "nullable":
      return typeOf(schema.wrapped as AnySchema);
    case "union":
      return { type: "union", of: (schema.options as AnySchema[]).map(typeOf) };
    case "lazy":
      // The only recursive schema is the list of effects inside `when`.
      return { type: "effects" };
    default:
      return { type: "json" };
  }
}

/** The fields of an object schema, in the order it lists them. */
export function fieldsOf(schema: AnySchema): FieldSpec[] {
  return Object.entries(schema.entries ?? {}).map(([key, child]) =>
    field(key, typeOf(child), { required: child.type !== "optional" }),
  );
}

/** The cases of a variant schema: the fields of each, by the value of its discriminating key. */
export function casesOf(schema: AnySchema, on: string): Record<string, FieldSpec[]> {
  const cases: Record<string, FieldSpec[]> = {};
  for (const option of schema.options as AnySchema[]) {
    const literal = option.entries?.[on]?.literal;
    if (typeof literal === "string")
      cases[literal] = fieldsOf(option).filter((spec) => spec.key !== on);
  }
  return cases;
}
