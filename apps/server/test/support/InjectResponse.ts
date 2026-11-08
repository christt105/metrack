/** An answer read in full, shaped for assertions. */
export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  rawPayload: Buffer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json<T = any>(): T;
}
