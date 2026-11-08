import { coerceType } from './coerceType.js';
import type { JsonSchema } from './JsonSchema.js';
import type { SchemaViolation } from './SchemaViolation.js';

export interface SchemaResult {
  value: unknown;
  violation?: SchemaViolation;
}

function escapePointer(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fail(
  instancePath: string,
  schemaPath: string,
  keyword: string,
  params: Record<string, unknown>,
  message: string,
): SchemaResult {
  return { value: undefined, violation: { instancePath, schemaPath, keyword, params, message } };
}

function validateNode(
  schema: JsonSchema,
  input: unknown,
  instancePath: string,
  schemaPath: string,
): SchemaResult {
  let value = input;
  if (schema.type !== undefined) {
    const types = typeof schema.type === 'string' ? [schema.type] : schema.type;
    const coerced = coerceType(types, value);
    if (!coerced.ok) {
      return fail(
        instancePath,
        `${schemaPath}/type`,
        'type',
        { type: schema.type },
        `must be ${types.join(',')}`,
      );
    }
    value = coerced.value;
  }
  if (schema.const !== undefined && !equal(value, schema.const)) {
    return fail(
      instancePath,
      `${schemaPath}/const`,
      'const',
      { allowedValue: schema.const },
      'must be equal to constant',
    );
  }
  if (schema.enum !== undefined && !schema.enum.some((option) => equal(option, value))) {
    return fail(
      instancePath,
      `${schemaPath}/enum`,
      'enum',
      { allowedValues: schema.enum },
      'must be equal to one of the allowed values',
    );
  }
  if (typeof value === 'number') {
    if (schema.maximum !== undefined && value > schema.maximum) {
      return fail(
        instancePath,
        `${schemaPath}/maximum`,
        'maximum',
        { comparison: '<=', limit: schema.maximum },
        `must be <= ${schema.maximum}`,
      );
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      return fail(
        instancePath,
        `${schemaPath}/minimum`,
        'minimum',
        { comparison: '>=', limit: schema.minimum },
        `must be >= ${schema.minimum}`,
      );
    }
  }
  if (typeof value === 'string') {
    const length = [...value].length;
    if (schema.maxLength !== undefined && length > schema.maxLength) {
      return fail(
        instancePath,
        `${schemaPath}/maxLength`,
        'maxLength',
        { limit: schema.maxLength },
        `must NOT have more than ${schema.maxLength} characters`,
      );
    }
    if (schema.minLength !== undefined && length < schema.minLength) {
      return fail(
        instancePath,
        `${schemaPath}/minLength`,
        'minLength',
        { limit: schema.minLength },
        `must NOT have fewer than ${schema.minLength} characters`,
      );
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      return fail(
        instancePath,
        `${schemaPath}/pattern`,
        'pattern',
        { pattern: schema.pattern },
        `must match pattern "${schema.pattern}"`,
      );
    }
  }
  if (Array.isArray(value) && schema.items) {
    for (let index = 0; index < value.length; index += 1) {
      const result = validateNode(
        schema.items,
        value[index],
        `${instancePath}/${index}`,
        `${schemaPath}/items`,
      );
      if (result.violation) return result;
      value[index] = result.value;
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return validateObject(schema, value as Record<string, unknown>, instancePath, schemaPath);
  }
  return { value };
}

function validateObject(
  schema: JsonSchema,
  object: Record<string, unknown>,
  instancePath: string,
  schemaPath: string,
): SchemaResult {
  const properties = schema.properties ?? {};
  for (const [key, property] of Object.entries(properties)) {
    if (object[key] === undefined && property.default !== undefined) object[key] = property.default;
  }
  if (schema.minProperties !== undefined && Object.keys(object).length < schema.minProperties) {
    return fail(
      instancePath,
      `${schemaPath}/minProperties`,
      'minProperties',
      { limit: schema.minProperties },
      `must NOT have fewer than ${schema.minProperties} properties`,
    );
  }
  for (const key of schema.required ?? []) {
    if (object[key] === undefined) {
      return fail(
        instancePath,
        `${schemaPath}/required`,
        'required',
        { missingProperty: key },
        `must have required property '${key}'`,
      );
    }
  }
  if (schema.additionalProperties === false) {
    const extra = Object.keys(object).find((key) => !(key in properties));
    if (extra !== undefined) {
      return fail(
        instancePath,
        `${schemaPath}/additionalProperties`,
        'additionalProperties',
        { additionalProperty: extra },
        'must NOT have additional properties',
      );
    }
  }
  for (const [key, property] of Object.entries(properties)) {
    if (object[key] === undefined) continue;
    const result = validateNode(
      property,
      object[key],
      `${instancePath}/${escapePointer(key)}`,
      `${schemaPath}/properties/${escapePointer(key)}`,
    );
    if (result.violation) return result;
    object[key] = result.value;
  }
  return { value: object };
}

/** Checks a value against a schema, converting values the way the API always has; reports the first rule broken. */
export function validateSchema(schema: object, value: unknown): SchemaResult {
  return validateNode(schema as JsonSchema, value, '', '#');
}
