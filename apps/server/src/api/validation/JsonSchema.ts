/** The subset of JSON Schema the API schemas use. */
export interface JsonSchema {
  type?: string | readonly string[];
  enum?: readonly unknown[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  minProperties?: number;
}
