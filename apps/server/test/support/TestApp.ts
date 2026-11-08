import type { Hono } from 'hono';
import type { ApiEnv } from '../../src/api/ApiEnv.js';
import type { InjectOptions } from './InjectOptions.js';
import type { InjectResponse } from './InjectResponse.js';

/** The API app plus a way to send it a request without a network. */
export type TestApp = Hono<ApiEnv> & {
  inject(options: InjectOptions): Promise<InjectResponse>;
  close(): Promise<void>;
};
