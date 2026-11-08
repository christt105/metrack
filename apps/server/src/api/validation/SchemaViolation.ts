/** The first rule a value broke, described the way the clients already receive it. */
export interface SchemaViolation {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, unknown>;
  message: string;
}
