import { ApiError } from '../ApiError.js';
import { validateSchema } from './validateSchema.js';

export type InputSource = 'params' | 'body' | 'querystring';

/** The input converted to what the schema asks for, or a 400 with `validation_error`. */
export function validateInput(source: InputSource, schema: object, value: unknown): unknown {
  const result = validateSchema(schema, value);
  if (result.violation) {
    throw new ApiError(
      400,
      'validation_error',
      `${source}${result.violation.instancePath} ${result.violation.message}`,
      [result.violation],
    );
  }
  return result.value;
}
