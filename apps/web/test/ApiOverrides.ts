import type { ApiClient } from '../src/api/ApiClient';

export type ApiOverrides = {
  [K in keyof ApiClient]?: ApiClient[K] extends (...args: never[]) => unknown
    ? ApiClient[K]
    : Partial<ApiClient[K]>;
};
