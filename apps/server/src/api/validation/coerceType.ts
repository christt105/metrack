const NOT_COERCED = Symbol('not coerced');

function matches(type: string, value: unknown): boolean {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return false;
  }
}

function convert(type: string, value: unknown): unknown {
  const scalar = typeof value;
  switch (type) {
    case 'string':
      if (scalar === 'number' || scalar === 'boolean') return String(value);
      return value === null ? '' : NOT_COERCED;
    case 'number':
    case 'integer': {
      let number: number | undefined;
      if (scalar === 'boolean') number = value ? 1 : 0;
      else if (value === null) number = 0;
      else if (scalar === 'string' && value !== '' && value === String(+(value as string))) {
        number = +(value as string);
      }
      if (number === undefined) return NOT_COERCED;
      return matches(type, number) ? number : NOT_COERCED;
    }
    case 'boolean':
      if (value === 'false' || value === 0) return false;
      return value === 'true' || value === 1 ? true : NOT_COERCED;
    case 'null':
      return value === '' || value === 0 || value === false ? null : NOT_COERCED;
    default:
      return NOT_COERCED;
  }
}

/**
 * Finds the value as one of the wanted types: as it is, or converted the way query strings and loose JSON need
 * (numbers and booleans from text, a one-item list as its item, a single value as a list).
 */
export function coerceType(
  types: readonly string[],
  value: unknown,
): { ok: boolean; value: unknown } {
  if (types.some((type) => matches(type, value))) return { ok: true, value };
  const scalarTypes = types.filter((type) => type !== 'array' && type !== 'object');
  let candidate = value;
  if (Array.isArray(value) && value.length === 1 && scalarTypes.length > 0) {
    candidate = value[0];
    if (scalarTypes.some((type) => matches(type, candidate))) return { ok: true, value: candidate };
  }
  for (const type of scalarTypes) {
    const converted = convert(type, candidate);
    if (converted !== NOT_COERCED) return { ok: true, value: converted };
  }
  if (types.includes('array') && !Array.isArray(value)) return { ok: true, value: [value] };
  return { ok: false, value };
}
