import type { ApiClient } from '../src/api/ApiClient';

export type ApiOverrides = {
  [K in keyof ApiClient]?: Partial<ApiClient[K]>;
};
