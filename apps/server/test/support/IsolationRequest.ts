/** One request the isolation test sends as user 2. */
export interface IsolationRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly url: string;
  readonly payload?: unknown;
}
