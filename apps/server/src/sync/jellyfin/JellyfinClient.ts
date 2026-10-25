import type { FetchFn } from '../../http/FetchFn.js';
import { getJson } from '../../http/getJson.js';
import type { QueryParams } from '../../http/getJson.js';
import type { JellyfinConfig } from '../JellyfinConfig.js';
import type { JellyfinItem } from './JellyfinItem.js';
import type { JellyfinItemPage } from './JellyfinItemPage.js';
import type { JellyfinUser } from './JellyfinUser.js';

const PAGE_SIZE = 500;
const FIELDS = 'ProviderIds,ProductionYear,PremiereDate,RunTimeTicks';

/**
 * Read-only Jellyfin client. Jellyfin 12 only accepts the `Authorization: MediaBrowser Token="..."`
 * header; the older `X-Emby-Token` header and `api_key` query are disabled.
 */
export class JellyfinClient {
  private readonly base: string;
  private readonly headers: Record<string, string>;
  private readonly userName: string | undefined;
  private userId: Promise<string | undefined> | undefined;

  constructor(
    private readonly fetchFn: FetchFn,
    config: JellyfinConfig,
  ) {
    this.base = config.url.replace(/\/+$/, '');
    this.userName = config.userName;
    this.headers = { Authorization: `MediaBrowser Token="${config.token}"` };
  }

  listMovies(): Promise<JellyfinItem[]> {
    return this.items({ IncludeItemTypes: 'Movie', Recursive: true });
  }

  listSeries(): Promise<JellyfinItem[]> {
    return this.items({ IncludeItemTypes: 'Series', Recursive: true });
  }

  listSeasons(seriesId: string): Promise<JellyfinItem[]> {
    return this.items({ ParentId: seriesId, IncludeItemTypes: 'Season' });
  }

  listEpisodes(seriesId: string): Promise<JellyfinItem[]> {
    return this.items({ ParentId: seriesId, IncludeItemTypes: 'Episode', Recursive: true });
  }

  private resolveUserId(): Promise<string | undefined> {
    this.userId ??= this.findUserId();
    return this.userId;
  }

  private async findUserId(): Promise<string | undefined> {
    if (!this.userName) return undefined;
    const users = await getJson<JellyfinUser[]>(
      this.fetchFn,
      `${this.base}/Users`,
      {},
      this.headers,
    );
    const wanted = this.userName.toLowerCase();
    const user = users.find((candidate) => candidate.Name.toLowerCase() === wanted);
    if (!user) throw new Error(`Jellyfin user not found: ${this.userName}`);
    return user.Id;
  }

  private async items(params: QueryParams): Promise<JellyfinItem[]> {
    const userId = await this.resolveUserId();
    const all: JellyfinItem[] = [];
    for (;;) {
      const page = await getJson<JellyfinItemPage>(
        this.fetchFn,
        `${this.base}/Items`,
        { ...params, UserId: userId, Fields: FIELDS, StartIndex: all.length, Limit: PAGE_SIZE },
        this.headers,
      );
      all.push(...page.Items);
      if (page.Items.length === 0 || all.length >= page.TotalRecordCount) return all;
    }
  }
}
