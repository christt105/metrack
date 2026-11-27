import type { ApiClient } from '../src/api/ApiClient';
import type { ApiOverrides } from './ApiOverrides';

export function fakeApi(overrides: ApiOverrides = {}): ApiClient {
  return overrides as ApiClient;
}
