import type { ReleaseAlert, WatchlistEntry } from '@metrack/domain';
import type { HttpTransport } from '../HttpTransport';

export class FollowingApi {
  constructor(private readonly transport: HttpTransport) {}

  listWatchlist(): Promise<WatchlistEntry[]> {
    return this.transport.request('GET', '/watchlist');
  }

  follow(collection: 'movies' | 'series', id: number): Promise<void> {
    return this.transport.request('PUT', `/watchlist/${collection}/${id}`);
  }

  unfollow(collection: 'movies' | 'series', id: number): Promise<void> {
    return this.transport.request('DELETE', `/watchlist/${collection}/${id}`);
  }

  listAlerts(): Promise<ReleaseAlert[]> {
    return this.transport.request('GET', '/alerts');
  }
}
