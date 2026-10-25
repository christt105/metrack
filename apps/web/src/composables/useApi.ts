import { inject } from 'vue';
import { apiKey } from '../api/apiKey';
import type { ApiClient } from '../api/ApiClient';

/** The API client provided by the app root. */
export function useApi(): ApiClient {
  const api = inject(apiKey);
  if (!api) throw new Error('ApiClient was not provided');
  return api;
}
