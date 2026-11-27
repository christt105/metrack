import { ApiClient } from '../src/api/ApiClient';

export function recorder(response: Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return response;
  }) as unknown as typeof fetch;
  return { calls, client: new ApiClient(fetchFn) };
}
